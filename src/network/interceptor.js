/*
 * 网络拦截模块（占位，默认不启用）
 * -----------------------------------------------------------
 * 目标：在“网络层”拦截 B 站页面的 Fetch / XHR 请求，用于后续读取或处理
 * 推荐/相关接口数据（例如 /x/web-interface/wbi/index/top/feed/rcmd）。
 *
 * 重要说明：
 *   - 需要 patch 的是“页面上下文”的 window.fetch 与 XMLHttpRequest，
 *     因此使用 unsafeWindow（由加载器 @grant unsafeWindow 提供）。
 *   - 默认不启用：installNetworkInterceptors() 需手动调用，避免给页面上
 *     所有请求都包一层代理带来不必要的开销。
 *   - 只对 urlPatterns 命中的 URL 回调 onFetch / onXhr，其余请求零影响。
 *   - 干扰/改写响应体较复杂（需构造新的 Response / 处理 XHR responseText），
 *     建议先从“只读观察”开始，确认接口结构后再考虑改写。
 */
var NET_INTERCEPT = {
  enabled: false,
  // 后续填 B 站推荐 / 相关接口的关键字（命中才处理）
  urlPatterns: [
    // "/x/web-interface/wbi/index/top/feed/rcmd",
    // "/x/web-interface/wbi/index/feed",
    // "/x/web-interface/archive/related"
  ],
  // 页面上下文的全局对象（优先 unsafeWindow）
  page: (typeof unsafeWindow !== "undefined") ? unsafeWindow : window
};

/**
 * 判断某个 URL 是否命中要拦截的接口。
 * @param {string} url
 * @returns {boolean}
 */
function netUrlMatches(url) {
  var patterns = NET_INTERCEPT.urlPatterns;
  for (var i = 0; i < patterns.length; i++) {
    if (url.indexOf(patterns[i]) !== -1) return true;
  }
  return false;
}

/**
 * Fetch 命中后的回调（占位）。
 * @param {string} url           请求 URL
 * @param {string} responseText  响应文本
 */
function onFetch(url, responseText) {
  // TODO: 解析 / 拦截 B 站推荐接口数据
}

/**
 * XHR 命中后的回调（占位）。
 * @param {string} url           请求 URL
 * @param {string} responseText  响应文本
 */
function onXhr(url, responseText) {
  // TODO: 解析 / 拦截 B 站推荐接口数据
}

/**
 * 安装网络拦截器（作用于页面上下文）。
 * 只会执行一次；命中 urlPatterns 时才触发 onFetch / onXhr。
 */
function installNetworkInterceptors() {
  if (NET_INTERCEPT.enabled) return;
  var page = NET_INTERCEPT.page;
  if (!page || typeof page.fetch !== "function") return;
  NET_INTERCEPT.enabled = true;

  // ---- Fetch 拦截 ----
  var originFetch = page.fetch.bind(page);
  page.fetch = function (input, init) {
    var url = "";
    if (typeof input === "string") {
      url = input;
    } else if (input && input.url) {
      url = input.url;
    } else if (init && init.url) {
      url = init.url;
    }
    return originFetch(input, init).then(function (res) {
      if (url && netUrlMatches(url)) {
        res.clone().text().then(function (text) {
          onFetch(url, text);
        });
      }
      return res;
    });
  };

  // ---- XHR 拦截 ----
  var X = page.XMLHttpRequest;
  if (X && X.prototype) {
    var originOpen = X.prototype.open;
    var originSend = X.prototype.send;
    X.prototype.open = function (method, url) {
      this.__blacklistUrl = url;
      return originOpen.apply(this, arguments);
    };
    X.prototype.send = function () {
      var self = this;
      this.addEventListener("load", function () {
        if (netUrlMatches(self.__blacklistUrl || "")) {
          onXhr(self.__blacklistUrl || "", self.responseText);
        }
      });
      return originSend.apply(this, arguments);
    };
  }
}