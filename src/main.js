/*
 * 主入口模块
 * -----------------------------------------------------------
 * 负责启动：
 *   1. 等 DOM 就绪 + B 站初始数据就绪；
 *   2. 初次扫描页面已有的卡片；
 *   3. 开启 MutationObserver 增量监听；
 *   4. 暴露网络拦截器的安装入口（默认不启用）。
 */

/**
 * 页面 DOM 就绪后再执行回调。
 * @param {Function} callback
 */
function whenDomReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  } else {
    callback();
  }
}

/**
 * 等 B 站初始数据 window.__INITIAL_STATE__ 就绪后再执行回调（带超时兜底）。
 * @param {Function} callback
 * @param {number} [timeoutMs=3000]
 */
function whenBiliDataReady(callback, timeoutMs) {
  var startedAt = Date.now();
  var limit = timeoutMs || 3000;
  var check = function () {
    if (window.__INITIAL_STATE__) {
      callback();
      return;
    }
    if (Date.now() - startedAt > limit) {
      callback();
      return;
    }
    setTimeout(check, 100);
  };
  check();
}

// 启动：初次扫描已有卡片 -> 开启增量监听 -> 暴露调试/网络入口
whenDomReady(function () {
  whenBiliDataReady(function () {
    var processed = scanInitial();
    console.log("[🫥BlackList] 初次扫描共观察到 " + processed + " 个视频卡片");
    observeCards();

    // 调试统计
    window.__blacklistStats = STATS;
    // 网络拦截器：默认不启用，后续需要时手动调用：
    window.__blacklistInterceptors = {
      install: installNetworkInterceptors,
      config: NET_INTERCEPT
    };
  });
});
