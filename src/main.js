/*
 * 新工程唯一的入口代码。
 *
 * 为什么不是直接 console.log：
 *   插件脚本如果跑得太早，可能会在 B 站页面的 DOM 或数据（window.__INITIAL_STATE__，
 *   例如 related / availableVideoList 数组）准备好之前执行。这里做两层“就绪”保护：
 *     1. 页面 DOM 就绪（DOMContentLoaded / document.readyState）
 *     2. B 站初始数据就绪（window.__INITIAL_STATE__，带超时兜底）
 *   之后才执行真正的业务逻辑（当前只是打印 hello world）。
 */
function whenDomReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
  } else {
    callback();
  }
}

function whenBiliDataReady(callback, timeoutMs) {
  const startedAt = Date.now();
  const limit = timeoutMs || 3000;
  const check = () => {
    if (window.__INITIAL_STATE__) {
      callback();
      return;
    }
    if (Date.now() - startedAt > limit) {
      // 数据迟迟未出现（或页面不在 B 站）时也照常启动，避免无限等待
      callback();
      return;
    }
    setTimeout(check, 100);
  };
  check();
}

whenDomReady(function () {
  whenBiliDataReady(function () {
    console.log('hello world');
  });
});
