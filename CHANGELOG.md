# 更新记录 (Changelog)

## [0.7.6] - AI 作者 / 免责声明，测试方法仅 dev 构建生效

### 变更
- **AI 作者与免责声明**：userscript 元数据 `@author` 改为 `DeepSeek Harness (AI)`；
  构建产物顶部加入**免责声明横幅**，强调本插件由 AI（DeepSeek Harness）自动编写，非人工逐行开发，
  使用前请自行评估风险。`README.md` 同步加入免责声明与作者说明；插件管理面板「插件配置」页底部也显示免责声明。
- **测试方法分离**：将原先写在 `src/main.js` 里的调试/测试入口（`__blockTestRun` /
  `restoreCardsForUp` / `window.__blacklistConfig` / `window.__blacklistInterceptors` /
  `window.__blacklistExpose`）迁移到独立的 **`src/debug/dev-test.js`** 模块。
- **仅 dev 构建注入**：`build.js` 新增 `--dev` 标志，dev 构建（`npm run dev` /
  `npm run build:dev`）会附加 `src.devModules`（即 `src/debug/dev-test.js`），
  并在 IIFE 内定义 `__DSH_DEV__`；发布构建（`npm run build`）**不会包含**任何测试方法。
- `scripts/dev.js` 改为调用 `node build.js --dev` 启动 dev 构建。
- `package.json` 新增 `build:dev` 脚本；`author` 更新为 AI 作者，保留原版贡献者。

## [0.7.5] - 修复启动崩溃/闪烁/按钮失效/重复标签，新增网络拦截/遮挡模式重构/排行榜支持

### 关键修复
- **构建顺序导致的启动崩溃**：`pages.js` 段“立即初始化”会同步调用
  `installNetworkInterceptors()`，而 `interceptor.js` 的 `var NET_INTERCEPT` 尚未求值
  （为 `undefined`），抛 `Cannot read properties of undefined (reading 'enabled')`，
  导致整个脚本 eval 失败、页面无任何功能。已将“晚注入立即初始化”移到 IIFE 末尾
  （`src/main.js`），确保所有模块求值完毕后再初始化。
- **`flagHideOnLoad` 闪烁（问题 1）**：`processCard` 改为只要开启“加载时立即隐藏卡片”，
  就对**所有**新卡片先 `visibility:hidden`（不再只对解析到 UP名/标题的卡片），
  交给队列判定后再统一显示/保持隐藏，避免“先显示后隐藏”造成的重排闪烁。
- **重复 Tname 按钮（问题 2）**：新增 `addTNameButtonToGroup()`，按文本去重
  `data.tname / data.tname_v2 / tid_v2 映射的 name / name_v2`，同一标签只留一个按钮。
- **部分卡片无法获取 Tname 导致不显示（问题 3）**：移除队列里“无法解析 UP名/标题就视为应
  屏蔽（保持隐藏）”的启发式；无法解析的卡片统一恢复显示，避免误伤/永久空白。
  同时 `getVideoCardInfo` 增加“指向用户空间的作者链接 / 指向 /video/ 的标题链接”兜底，
  提高不同卡片结构下的提取成功率。
- **屏蔽 UP 名按钮失效（问题 4）**：改为统一事件委托——所有“屏蔽/标签”按钮不再各自
  `addEventListener`，改由 `document` 捕获阶段的一个监听统一处理，用 `data-up-name` /
  `data-tag-name` 标明目标，`findCardForButton()` 反查所属卡片。B 站重渲染后依然有效，
  点击穿透也被 `stopPropagation` 阻止。
- **/video/ 播放页被屏蔽卡片闪烁且按钮全部失效（问题 5）**：依赖上述修复。按钮只在解析到
  UP 名时就创建（不再强求标题），队列按 `upName || videoTitle` 参与判定（缺标题也能按 UP
  名精确匹配），故“屏蔽按钮无效/缺失但确实符合屏蔽要求”的卡片可被正确识别并隐藏。
- 新增非破坏性自动化测试入口 `window.__blacklistExpose.testBlock100(n)`，配合
  `TEST_FLOW.md §9` 验证 100 次不同 UP 屏蔽全部生效。
- **tname 解析失败重试**（本次补充）：开启 `flagTName` 时，若 view 接口返回 `null` 或解析不出
  任何分类标签，卡片会先被**重排到队列末尾**重试一次（队列中仅它时相当于立即重试）；再次失败
  则**按屏蔽处理**（当作分类标签命中，直接遮挡/隐藏），避免因 API 偶发失败导致本应屏蔽的卡片
  漏网。用 `tnameRetriedCards`（WeakSet）记录已重试卡片，防止无限重试。

### 新增功能
- **网络拦截真正落地**（`src/network/interceptor.js`）：`NET_INTERCEPT.rewrite` 置为 `true`，
  `rewriteRecommendation()` 解析推荐/相关接口 JSON，按 `isBlacklisted(up, title)` 过滤
  `data.item` 与 `data`（数组）中的命中条目后再交回页面；`urlPatterns` 填入
  `wbi/index/top/feed/rcmd`、`wbi/index/feed`、`wbi/index/web/feed/rcmd`、
  `archive/related`。由新配置 `flagNetworkIntercept` 控制，默认开启。
- **遮挡方式重构**：`flagKirby` 布尔替换为全局 `blockDisplayMode`
  （`blur`=模糊遮盖 / `kirby`=模糊遮盖加卡比 / `hide`=隐藏卡片），并新增按屏蔽类型独立覆盖的
  `displayModeInfo` / `displayModeAD` / `displayModeTName` / `displayModeCM` /
  `displayModeVertical`（`inherit`=继承全局）；`hideVideoCard()` 通过
  `getEffectiveDisplayMode(type)` 决定遮罩或隐藏，`addDisplayOverlayToCard(card, mode)`
  支持仅模糊（不带卡比）模式。
- **排行榜页支持**：新增 `isCurrentPageRanking()` / `initializeRankingPage()`；
  `queryAllVideoCards()` 增加排行页卡片选择器（`.rank-item` / `.video-card` / `.rank-card`）。
- **首屏/页面内补扫**：主页、搜索、分类页在观察器挂载后延迟 `800ms` 补一次
  `scanAndBlockVideoCards()`；视频页恢复每 `2500ms` 定时补扫（内部有节流与去重），
  并调整“恢复自动连播配置”仅在用户未改过（`flagSkipBlockedAutoplay === "off"`）时才恢复。
- **旧版黑名单一次性迁移**：新增 `src/storage/migration-data.js`（由 `test/testBlackList.json`
  生成，含旧版精确/正则/分类标签黑名单），首次启动合并进现存储，写 `migratedOldBlacklistV1`
  标记避免重复合并。
- **数值配置校验**：`clampNumber` 校准 `blockScanInterval` / `processQueueInterval` /
  `verticalScaleThreshold`；把旧 `flagKirby` 迁移为 `blockDisplayMode`；校验
  `blockDisplayMode` 与各 `displayMode*` 的取值。
- **自动连播多P感知**：新增 `getCurrentCid()`，取播放器 / URL `p` 参数 / 选区面板当前分P信息，
  并入自动连播签名，切分P（BV/标题/UP 均不变）也能正确触发处理。
- **管理按钮/油猴菜单**：新增 `flagHeaderButton`（顶栏管理按钮显隐）与
  `initTampermonkeyMenu()`（`GM_registerMenuCommand`：切换顶栏按钮 / 打开管理面板）；
  观察器定时兜底重挂 `addBlacklistManagerButton()`。
- **UP 名清洗**：`getVideoCardInfo()` 去除 UP 名中“ · 时间/日期”后缀
  （如 `· 08-23`、`· 昨天`），保证精确匹配与“屏蔽按 UP 名”用的是干净名字；
  并新增“指向用户空间链接 / 指向 /video/ 链接”的标题与 UP 兜底。
- **开发加载器健壮性**：`scripts/dev.js` 默认双栈监听 `::`（对外展示 `localhost`）；
  `test` 加载器改用 `127.0.0.1` 优先、`localhost` 备用，最多 6 次重试/交替，并加页面角标诊断。

### 变更
- `src/main.js`：移出 `DOMContentLoaded` 包裹，改为模块求值末尾挂暴露对象与立即初始化；
  新增 `__blockTestRun` / `restoreCardsForUp`；`stats` 增加 `vertical`。
- `src/core/core.js`：`processCard` 立即隐藏逻辑重排；`getVideoCardInfo` 增加兜底选择器与
  UP 名时间后缀清洗；`hideVideoCard` 改用 `getEffectiveDisplayMode` / `addDisplayOverlayToCard`；
  新增排行榜页选择器、`fixMainPageLayout` 兼容 `visibility:hidden`；竖屏计数独立为 `countBlockVertical`。
- `src/core/video-data.js`：队列判定条件放宽为 `upName || videoTitle`；Tname 去重；
  新增 `tnameRetriedCards` 重试与失败按屏蔽处理；view 接口数据 10 分钟缓存。
- `src/ui/ui.js`：`createBlockUpButton` / `createTNameBlockButton` 去掉单按钮点击，改为
  `data-*` + 事件委托；新增 `setupCardButtonDelegation` / `findCardForButton`；
  遮挡模式下拉与各类型独立显示模式、`flagHeaderButton` / `flagNetworkIntercept` 开关；
  遮罩支持仅模糊模式。
- `src/storage/storage.js`：新增旧版黑名单迁移、数值配置 clamp 校验、`flagKirby`→
  `blockDisplayMode` 迁移与显示模式校验；新增默认配置项。
- `src/network/interceptor.js`：`rewrite` 置 `true`，`rewriteRecommendation()` 实际过滤
  推荐/相关接口响应；填入推荐/相关接口关键字。
- `src/autoplay/autoplay.js`：新增 `getCurrentCid()`，连播签名加入分P信息。
- `src/pages/pages.js`：`initializeScript` 调用 `setupCardButtonDelegation` /
  `initTampermonkeyMenu`，按 `flagNetworkIntercept` 安装网络拦截；移除过早的立即初始化
  （已移到 main.js 末尾）；新增排行榜页初始化；主页/搜索/分类页延迟补扫；视频页恢复 2.5s 定时补扫。
- `src/observer/observer.js`：定时兜底重挂 `addBlacklistManagerButton()`。
- `build.config.json`：`@grant` 增加 `GM_registerMenuCommand`；模块列表加入
  `src/storage/migration-data.js`。
- `scripts/dev.js`：默认双栈监听 `::`，展示地址用 `localhost`。
- `test/bilibili-blacklist-remake.dev.user.js`：`127.0.0.1`/localhost 交替 + 最多 6 次重试 +
  页面角标诊断；`@grant` 增加 `GM_registerMenuCommand`。
- `.gitignore`：忽略 `test/testBlackList.json` 与 `TEST_FLOW.md`（迁移数据/文档不再入库）。

## [0.7.4] - 修复面板计数标题不显示

### 修复
- `createBlacklistPanel()` 创建面板后立即调用 `refreshBlockCountDisplay()`，保证第一次打开面板时「已屏蔽视频 (…)」标题即有内容，无需先切到「屏蔽分类」标签

## [0.7.3] - 正则表达式增强

### 变更
- 正则改为**编译后缓存**复用，不再每张卡片都 `new RegExp`
- 支持 `/pattern/flags` 写法（可指定 `g i m s u v y`，默认 `i`）
- 无效/非法正则会自动跳过并告警，不再让整段屏蔽逻辑崩溃
- `g/y` 标志测试前重置 `lastIndex`，避免状态残留
- 面板「正则匹配」提示改为 `/pattern/flags` 形式并校验更严格
- README 补充正则示例与 MDN 链接

## [0.7.2] - 代码规整

### 变更
- 修复 `main.js` 引用未定义 `globalConfig`（应为 `globalPluginConfig`）的隐患
- 移除未使用的 `rescanVideoPageTimer`、`isPageCurrentlyActive`（含其 `visibilitychange`/`focus`/`blur` 关联注释）
- 移除队列中“页面不可见即暂停”的判断（按你的选择不保留）
- 为各模块补充文件头职责注释；清理临时修复、`#region`、`用户修改 2` 等开发注释
- `isBlacklisted` 增加 `upName`/`title` 空值兜底

## [0.7.1] - 按你确认调整

### 变更
- 标签名列表缓存更新间隔改为 **60 秒**（原代码 6 秒，注释 24 小时，按 60 秒执行）
- 观察器恢复为**增量**：只在 `addedNodes` 里找新插入的卡片处理，不做全量重扫（靠 `WeakSet` 去重）
- 队列串行限速间隔保留 **200ms**（`processQueueInterval`）

## [0.7.0] - 完整移植旧版插件功能

### 功能（按你确认的取舍）
- 广告屏蔽(`flagAD`)、分类标签屏蔽(`flagTName`，view 接口)、cm软广(`flagCM`)、竖屏屏蔽(`flagVertical`)
- 悬停临时显示(`flagHoverReveal`)、自动连播处理(`flagSkipBlockedAutoplay`)、用户空间页屏蔽按钮
- 按旧版“分页各自初始化”（主页 / 搜索 / 播放 / 分类 / 用户空间）
- 保留优化：视频页延迟 5 秒、队列串行限速、标签名列表缓存、主页屏蔽后布局修正
- 默认黑名单采用旧版列表
- 移除（未选）：视频页每 2.5 秒补扫、页面不可见暂停、只扫描有尺寸的新节点

### 结构调整
- 移植旧版 `storage / core / video-data / ui / pages / ads / observer / autoplay / utils` 模块
- 保留 `network/interceptor.js`（网络拦截占位，默认不启用）
- 控制台前缀统一为 `[🫥BlackList]`

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