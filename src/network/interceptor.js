/*
 * 网络拦截模块（占位，默认不启用）
 * -----------------------------------------------------------
 * 目标：在“网络层”拦截 B 站页面的 Fetch / XHR 请求，处理推荐/相关接口数据。
 *
 * 开关：
 *   - NET_INTERCEPT.enabled：是否已安装代理；
 *   - NET_INTERCEPT.rewrite ：是否命中后“改写响应”（删除黑名单条目）再交给页面。
 *
 * 说明：
 *   - 需要 patch 的是“页面上下文”的 window.fetch 与 XMLHttpRequest，
 *     因此使用 unsafeWindow（由加载器 @grant unsafeWindow 提供）。
 *   - 默认不启用安装，避免给所有请求套一层代理带来开销。
 *   - 只对 urlPatterns 命中的 URL 回调，其余请求零影响。
 *   - Fetch 支持改写响应；XHR 的 responseText 只读、很难安全改写，
 *     因此 XHR 暂作“只读观察”，改写建议优先走 Fetch。
 */
var NET_INTERCEPT = {
  enabled: false,
  rewrite: true,   // true=命中后删除黑名单条目再交给页面；false=只读观察
  // B 站推荐 / 相关接口关键字（命中才处理）
  urlPatterns: [
    "/x/web-interface/wbi/index/top/feed/rcmd",
    "/x/web-interface/wbi/index/feed",
    "/x/web-interface/wbi/index/web/feed/rcmd",
    "/x/web-interface/archive/related"
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
 * 处理 / 改写推荐接口响应文本（占位）。
 * @param {string} url           请求 URL
 * @param {string} responseText  原始响应文本
 * @returns {string}             交给页面的响应文本（当前原样返回）
 */
function rewriteRecommendation(url, responseText) {
  try {
    var parsed = JSON.parse(responseText);
    if (!parsed || typeof parsed !== "object") return responseText;

    // 推荐流：data.item 数组（wbi/index/top/feed/rcmd、wbi/index/feed）
    if (parsed.data && Array.isArray(parsed.data.item)) {
      var before = parsed.data.item.length;
      parsed.data.item = parsed.data.item.filter(function (item) {
        if (!item) return true;
        var upName = (item.owner && item.owner.name) || "";
        var title = item.title || "";
        if (!upName && !title) return true;
        return !isBlacklisted(upName, title);
      });
      if (parsed.data.item.length !== before) {
        console.log(
          "[🫥BlackList] 网络拦截: 推荐流已过滤 " +
          (before - parsed.data.item.length) + " 条"
        );
      }
      return JSON.stringify(parsed);
    }

    // 相关推荐：data 本身是数组（archive/related）
    if (Array.isArray(parsed.data)) {
      var countBefore = parsed.data.length;
      parsed.data = parsed.data.filter(function (item) {
        if (!item) return true;
        var upName = (item.owner && item.owner.name) || "";
        var title = item.title || "";
        if (!upName && !title) return true;
        return !isBlacklisted(upName, title);
      });
      if (parsed.data.length !== countBefore) {
        console.log(
          "[🫥BlackList] 网络拦截: 相关推荐已过滤 " +
          (countBefore - parsed.data.length) + " 条"
        );
      }
      return JSON.stringify(parsed);
    }

    return JSON.stringify(parsed);
  } catch (e) {
    return responseText;
  }
}

/**
 * Fetch 命中后的回调（只读，用于观察 / 调试）。
 * @param {string} url           请求 URL
 * @param {string} responseText  响应文本
 */
function onFetch(url, responseText) {
  // TODO: 观察 / 记录推荐接口数据结构
}

/**
 * XHR 命中后的回调（只读，用于观察 / 调试）。
 * @param {string} url           请求 URL
 * @param {string} responseText  响应文本
 */
function onXhr(url, responseText) {
  // TODO: 观察 / 记录推荐接口数据结构
}

/**
 * 安装网络拦截器（作用于页面上下文）。
 * 只会执行一次；命中 urlPatterns 时才触发 onFetch / onXhr；
 * 若 NET_INTERCEPT.rewrite=true，Fetch 会用改写后的响应替换原始响应。
 */
function installNetworkInterceptors() {
  if (NET_INTERCEPT.enabled) return;
  var page = NET_INTERCEPT.page;
  if (!page || typeof page.fetch !== "function") return;
  NET_INTERCEPT.enabled = true;

  // ---- Fetch 拦截（支持改写）----
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
      if (!url || !netUrlMatches(url)) return res;
      return res.clone().text().then(function (text) {
        onFetch(url, text);
        if (!NET_INTERCEPT.rewrite) return res;
        var rewritten = rewriteRecommendation(url, text);
        if (rewritten === text) return res;
        return new Response(rewritten, {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers
        });
      });
    });
  };

  // ---- XHR 拦截（只读观察，改写较难，暂不覆盖 responseText）----
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
