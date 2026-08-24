# 更新记录 (Changelog)

## [0.2.0] - 卡片观察

### 新增
- 观察 B 站页面上的全部视频卡片，提取并打印 **标题 / UP 主名字 / bvid**
- 初次扫描 + `MutationObserver` 监听新增卡片（无限滚动 / SPA 加载），按 bvid 去重
- 结果数组暴露为 `window.__helloCards`

### 修复
- 所有 CSS 选择器集中到 `SELECTORS` 数组，便于统一修改
- 主页 `feed-card` 结构（`feed-card > bili-feed-card > bili-video-card`）下的标题 / UP 名识别修复
  - 标题：`h3.bili-video-card__info--tit`（优先用其 `title` 属性）
  - UP 名：`span.bili-video-card__info--author`（位于 `a.bili-video-card__info--owner` 内）

## [0.1.0] - 初始重写版

### 新增
- 从 `bilibili-blacklist` 完全重写而来的新分支工程
- 沿用相同的 build / dev 开发方式（`npm run build` / `npm run dev`）
- 更精细的构建管理：
  - userscript 元数据集中到 `build.config.json`
  - 模块合并顺序由 `build.config.json` 的 `src.modules` 管理
  - 输出文件名 / 目录由配置驱动
- 当前仅包含一个源码入口 `src/main.js`，向控制台打印 `hello world`
- 执行时机管理：
  - 新增 `@run-at document-idle`
  - `src/main.js` 增加 DOM 就绪 + B 站初始数据（`window.__INITIAL_STATE__`）就绪保护
- 新增 `@noframes`，避免 B 站视频页多子框架导致脚本多次执行
