# 更新记录 (Changelog)

## [0.6.0] - 实现屏蔽与插件界面（参考旧版）

### 功能
- **黑名单存储**（`src/storage/storage.js`）：精确 / 正则黑名单 + 全局配置，基于 GM 存储持久化
- **匹配**（`src/core/matcher.js`）：`isBlacklisted` 精确匹配 UP 名、正则匹配 UP 名 / 标题
- **屏蔽**（`src/core/block.js`）：
  - 卡片悬停显示「屏蔽」按钮，点击加入精确黑名单并立即屏蔽
  - 命中黑名单后按 `flagKirby` 选择“遮挡模糊层”或“直接隐藏”
  - 记录已屏蔽卡片，支持“临时取消屏蔽 / 恢复屏蔽”
- **界面**（`src/ui/ui.js`）：
  - 顶栏右侧（或右上角兜底）卡比入口 + 已屏蔽计数
  - 管理面板：精确匹配(UP名) / 正则匹配(UP/标题) / 插件配置
- 观察器改为：新卡片插入即「加屏蔽按钮 → 校验 → 屏蔽」

## [0.5.0] - 增量处理 + 网络拦截占位

### 功能
- `MutationObserver` 改为**增量处理**：只在新增卡片插入时即时提取 / 校验 / 屏蔽，不再做全量重扫
- 新增校验 + 屏蔽占位接口：`validateCard(card)` / `blockCard(card, el)`
- 不再保存卡片 `el` / 不再累积数组：
  - 用 `WeakSet` 记录已处理节点（弱引用，随 GC 释放）
  - 卡片信息只保留轻量 `{ bvid, title, up }`
  - 调试统计改为 `window.__blacklistStats = { processed, blocked }`
- 新增网络拦截模块 `src/network/interceptor.js`：拦截 Fetch / XHR（基于 `unsafeWindow`），按 URL 过滤，默认不启用，后续可 `window.__blacklistInterceptors.install()` 开启
- `@grant` 增加 `unsafeWindow`
- 屏蔽接口细化到“覆盖/隐藏”（`BLOCK_CONFIG.mode`）与「屏蔽 / 屏蔽原因」按钮占位（`applyCover` / `applyHide` / `addBlockControls` 等）
- 网络拦截增加 `NET_INTERCEPT.rewrite` 开关：`true` 时 Fetch 命中接口会用 `rewriteRecommendation()` 改写响应后再交给页面（当前改写入口为空实现，返回原文）

## [0.4.0] - 重命名为 Remake

### 变更
- 工程名由 `bilibili-blacklist-helloworld` 改为 `bilibili-blacklist-remake`
- 油猴脚本名 / 加载器名改为 `Bilibili-BlackList Remake`
- 构建产物改为 `dist/bilibili-blacklist-remake.user.js`
- 控制台日志前缀 `[HelloWorld]` 改为 `[🫥BlackList]`
- 调试数组 `window.__helloCards` 改为 `window.__blacklistCards`

## [0.3.0] - 模块化拆分

### 重构
- 将 `src/main.js` 按功能拆分为多个模块：
  - `src/config/selectors.js`：所有 CSS 选择器
  - `src/utils/query.js`：查询工具
  - `src/utils/log.js`：控制台日志输出
  - `src/core/cards.js`：卡片查找与字段提取
  - `src/observer/observer.js`：变动观察
  - `src/main.js`：主入口
- 各文件增加简体中文说明注释，各方法增加简单 JSDoc 注释
- `collectCards()` 现在返回**卡片本体 `el`**：每项为 `{ title, up, bvid, el }`，便于后续直接改卡片 / 添加按钮

## [0.2.0] - 卡片观察

### 新增
- 观察 B 站页面上的全部视频卡片，提取并打印 **标题 / UP 主名字 / bvid**
- 初次扫描 + `MutationObserver` 监听新增卡片（无限滚动 / SPA 加载），按 bvid 去重
- 结果数组暴露为 `window.__blacklistCards`

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