/*
 * 主入口模块
 * -----------------------------------------------------------
 * 页面功能初始化在 src/pages/pages.js（分页初始化 + 管理面板）。
 * 本文件负责：当构建在 DOMContentLoaded 之后、load 之前被注入时，
 * 在所有模块求值完毕后立即初始化一次（兼容 dev 加载器的晚注入场景）。
 * 调试/测试入口已迁移到 src/debug/dev-test.js，仅随 dev 构建注入，
 * 发布构建（npm run build）不会包含任何测试方法。
 */

// 兼容 dev 加载器晚注入：当构建在 DOMContentLoaded 之后、load 之前被 eval 时
// （document.readyState === "interactive"/"complete"），上面的 DOMContentLoaded 监听已错过，
// 需要在全部模块求值完毕后立即初始化一次。
// 注意：必须放在本 IIFE 的最后。initializeScript() 会依赖 interceptor.js 的 NET_INTERCEPT、
// ads.js、autoplay.js 等在 pages.js 之后求值的模块；在 pages.js 段同步调用会因这些
// 变量尚未求值（NET_INTERCEPT 为 undefined）而抛错。这里所有模块已求值，可安全调用。
if (
  (document.readyState === "complete" || document.readyState === "interactive") &&
  typeof isfirstLoad !== "undefined" &&
  isfirstLoad
) {
  initializeScript();
}
