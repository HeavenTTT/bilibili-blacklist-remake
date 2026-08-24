/*
 * 主入口模块
 * -----------------------------------------------------------
 * 负责启动：等 DOM 就绪 + B 站初始数据就绪后，
 * 执行初次扫描并开启新增卡片观察。
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

// 启动：就绪后扫描一次，并把结果暴露到控制台，再开启观察
whenDomReady(function () {
  whenBiliDataReady(function () {
    var cards = scan();
    window.__helloCards = cards;   // 每项含 { title, up, bvid, el }
    console.log("[HelloWorld] 初次扫描共观察到 " + cards.length + " 个视频卡片");
    observeCards();
  });
});
