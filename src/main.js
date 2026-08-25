/*
 * 主入口模块
 * -----------------------------------------------------------
 * 页面功能初始化在 src/pages/pages.js（分页初始化 + 管理面板）。
 * 本文件只负责：在 DOM 就绪后暴露调试 / 网络拦截入口。
 */
document.addEventListener("DOMContentLoaded", function () {
  window.__blacklistConfig = globalConfig;
  window.__blacklistInterceptors = {
    install: installNetworkInterceptors,
    config: NET_INTERCEPT
  };
  window.__blacklistExpose = {
    stats: function () {
      return {
        blocked: blockedVideoCards.size,
        info: countBlockInfo,
        ad: countBlockAD,
        cm: countBlockCM,
        tname: countBlockTName
      };
    }
  };
});
