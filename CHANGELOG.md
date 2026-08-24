# 更新记录 (Changelog)

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