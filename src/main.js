/*
 * 主入口模块
 * -----------------------------------------------------------
 * 启动顺序：
 *   1. 等 DOM + B 站数据就绪；
 *   2. 先初始化界面（样式 / 顶栏入口 / 管理面板）；
 *   3. 初次扫描已有卡片；
 *   4. 开启 MutationObserver 增量监听；
 *   5. 暴露调试 / 配置入口。
 */
function whenDomReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  } else {
    callback();
  }
}

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

whenDomReady(function () {
  whenBiliDataReady(function () {
    initUi();                     // 样式 + 顶栏入口 + 管理面板
    var processed = scanInitial(); // 初次扫描已有卡片
    console.log("[🫥BlackList] 初次扫描共观察到 " + processed + " 个视频卡片");
    observeCards();               // 之后走增量

    window.__blacklistStats = STATS;
    window.__blacklistConfig = BLOCK_CONFIG;
    window.__blacklistConfig.global = globalConfig;
    window.__blacklistInterceptors = {
      install: installNetworkInterceptors,
      config: NET_INTERCEPT
    };
  });
});
