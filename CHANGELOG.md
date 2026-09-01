# 更新记录 (Changelog)

## [未发布]

### 新增
- 新增视频标签屏蔽功能：通过 `/x/tag/archive/tags` 读取 `data[].tag_name`，支持在卡片上直接添加规则。
- 管理面板新增「屏蔽标签」标签页，支持视频标签黑名单的添加、移除和持久化。
- 音乐标签（`tag_type=bgm/music` 或带 `music_id`）和话题标签（`tag_type=topic` 或名称以 `#` 开头）不会展示，也不会参与匹配。
- 视频标签屏蔽支持独立显示模式和卡片上的一键取消。

## [0.8.0] - 屏蔽原因可视化与一键取消（删除规则 + 刷新卡片）

### 变更
- **屏蔽原因显示具体内容**：被屏蔽的卡片不再显示「屏蔽」按钮（改为容器 `is-blocked` class 控制显隐，
  而非删除元素，避免重扫时按钮被重新加回），改为显示具体屏蔽原因按钮：
  - UP 名精确匹配 → `屏蔽原因: UP: xxx`；
  - 分类标签 → `屏蔽原因: 标签: xxx`；
  - 软广 / 竖屏 / 广告 → 类型文案；
  - 正则匹配 → `屏蔽原因: 正则匹配(无法定位具体规则,请在面板移除对应正则)`。
- **一键取消 = 删除黑名单规则 + 只刷新该卡片**：
  - 点击可取消的原因按钮（仅 UP 名精确匹配 / 分类标签支持）：
    1. 把对应规则从 `exactMatchBlacklist` / `tagNameBlacklist` 删除并持久化，面板列表同步刷新；
    2. 只对这张卡片做处理：恢复显示（撤销计数 / 移除原因与遮罩 / 清除隐藏样式）→ 重新入队完整判定，
       判定期间以 pending 模糊作为“重新检查中”的视觉反馈。
  - 重新判定时：若还有其它屏蔽原因（其它 UP 名规则 / 正则 / 其它标签 / 软广 / 竖屏 / 广告）
    会继续屏蔽并刷新为新原因；没有则保持显示 —— 满足“取消一次后重新完整检查”。
  - 正则匹配（无法定位具体规则）、软广、竖屏、广告不支持一键取消，仅展示原因。
- **队列判定对齐**：精确匹配命中即记录具体 UP 名；标签命中返回具体标签名（`getBlacklistedTagName`）；
  已有标签组的卡片（取消后重判）用缓存的接口数据补做 tname / 竖屏完整判定，不重复挂标签。

### 已知取舍
- 删除规则是全局的（黑名单本就如此）：取消某 UP 名的屏蔽会影响所有该 UP 名的卡片；
  卡片重判是按“被点击的那张 + 定时补扫/观察器”逐步进行的。
- 网络拦截层不改：命中黑名单的条目仍在推荐/相关接口响应层被删除，不生成卡片，因此没有取消入口。
- 遮挡模式为「隐藏卡片」时卡片不可见，无法点原因按钮；请先用面板「取消屏蔽」临时显示所有卡片再逐张操作。

## [0.7.7] - 播放页广告同节奏处理、切视频重处理、队列判定提速、搜索页翻页重置

本次包含两批改动：**播放页广告处理对齐视频卡片的三段式流程（覆盖 → 等初始化 → 判定）**，
以及**卡片队列判定分阶段提速 + 搜索页翻页状态重置**。

### 关键修复（队列 / 接口 / 搜索页）
- **搜索页翻页后屏蔽延迟十几秒**。三个原因叠加，全部处理：
  1. **旧卡片空转**：翻页后上一页遗留在队列里的卡片虽然已从 DOM 移除，循环照样给它们
     发一次接口请求 + 等一次 `processQueueInterval`，把新一页的卡片堵在队尾。
     现在出队时跳过 `isConnected === false` 的卡片。
     （刻意不做“清空队列”：已加过 pending 遮盖的卡片被清掉后就再没人给它 `clearPendingFilter`，
     会永久停在模糊态。）
  2. **无差别限速**：旧实现对每张卡片都 `await sleep(200)`，哪怕它压根没发请求，
     一页 30 张仅等待就要 6 秒。现在**只有真正发生网络请求时才限速**，
     纯本地判定的卡片立即处理下一张（连续 20 张会主动让出一次主线程避免长任务）。
  3. **接口请求没有超时**：一个挂起的请求会把整条串行队列永久卡死。
     现在用 `AbortController` 加 5 秒超时。
- **网络异常导致的误屏蔽**：`getBilibiliVideoApiData` 的 `catch` 分支**缺 `return`**，
  异常时返回 `undefined` 而非 `null`，会落到调用方的“解析失败”分支被当作应屏蔽处理。
  已修复为 `return null`。
- **解析不到 UP 名的卡片被误判为 tname 失败**：旧实现要求卡片上已存在按钮容器才挂标签组，
  没有容器的卡片永远解析不出标签 → 重试后被当作命中分类黑名单屏蔽。
  现在改用 `ensureBlockContainerOnCard()` 保证容器存在。

### 变更（队列判定与配置）
- **判定分两阶段，本地优先**（`processVideoCardQueue`）：
  - **阶段 A（零网络）**：软广链接 > UP主名精确匹配 > 正则匹配，命中即可直接提交，
    不发请求、不限速等待。`isBlacklisted` 拆为 `isExactBlacklisted` / `isRegexBlacklisted`，
    优先级在代码里显式表达。
  - **阶段 B（网络）**：只有阶段 A 未命中时，才请求 view 接口做分类标签 / 竖屏判定。
- **新增配置 `flagAlwaysFetchTName`（默认开启）**：
  - **开启**：阶段 A 已命中的卡片仍会补一次请求以显示分类标签按钮，但被放进**低优先级
    补标签队列**，等主队列判定完才处理 —— 标签始终可见，且不占用其它卡片的判定时间。
  - **关闭**：已命中的卡片不再请求接口，队列处理明显更快，代价是这些卡片上看不到分类标签。
  - 面板「插件配置」页新增「始终获取分类标签」开关。
- **搜索页翻页/换关键词处理**（`watchSearchPageChange`）：
  通过通用的 `installUrlChangeWatcher()`（`popstate` + `history.pushState/replaceState` 包装，
  另有 2s 低频比对兜底）识别翻页，随后重置 `processedVideoCards` / `tnameRetriedCards` /
  `seenCards`，清除卡片上可能被复用节点带过来的旧装饰（旧 UP 名按钮、旧分类标签、遮罩、
  隐藏样式），再立即重扫并在 400/1200/2500ms 补扫。
  页面标识只取 `keyword/page/order/duration/tids/search_type`，避免 B 站追加埋点参数时误触发。
- **撤销屏蔽时回退计数**：新增 `data-bl-block-type` 标记与 `unmarkBlockedCard()`，
  卡片被恢复显示时按原类型回退对应计数，避免面板上“总数 = 各类型之和”对不上。

### 变更（播放页广告与观察器）
- **播放页广告改为“先覆盖 → 等同样的初始化 → 再按选择行为屏蔽”**（与视频卡片一致的三段式）：
  - **P0 预覆盖**：`ads.js` 求值期即注入 CSS 规则并给 `<html>` 加
    `bilibili-blacklist-ad-pending`，用与卡片相同的 `PENDING_FILTER_STYLE`
    （`blur(8px) grayscale(0.5) opacity(0.4)`，`core.js` 单一真源）把广告位罩住。
    纯 CSS、不插 DOM、不改结构，因此不与 B 站 header 的 Vue 渲染竞争；**等待期内才被插入的
    广告位也会在出现瞬间自动被罩住**，这是 CSS 方案相对逐元素 JS 遮盖的关键优势。
  - **P1 等初始化**：不再单独处理，完全复用卡片那一套（`5s` + `.right-entry` 就绪），
    时序未做任何改动。
  - **P2 判定提交**：新增 `resolveVideoPageAds()`，按 `flagAD` +
    `displayModeAD`/`blockDisplayMode` 决定遮蔽形态（hide / blur / kirby），
    **全部判定完成后才解除预覆盖**，同帧提交，无闪烁。
    `blockVideoPageAds()` 保留为兼容包装。
- **切视频后重新处理广告（双触发）**：
  - `observer.js` 在同一次 `addedNodes` 遍历里同时收集**新卡片**与**新广告元素**，
    任一出现即合并调度一次广告处理；触发后走全量 `querySelectorAll`（由
    `data-bl-ad-done` 去重），因此广告被包在未知容器里没被直接匹配到也能处理到。
  - `pages.js` 新增 `watchVideoSwitch()` / `installVideoSwitchWatcher()`：
    包装 `history.pushState/replaceState` 并监听 `popstate`，**用 URL 里的 BV**
    （而非 `getCurrentBv()` 优先读的播放器，后者更新更晚）即时识别页面内切视频；
    切换瞬间由 `onVideoSwitchedAds()` 重新加上预覆盖，等观察到新元素后判定并解除，
    新页面没有广告插入时由 `1.5s` 兜底解除。
- **观察器加固**：`observer.js` 记录 `observedRoot`/`observedTarget`，新增
  `ensureObserverAttached()`；播放页 2.5s 兜底 tick 里检查观察根节点是否已被整体替换
  （切视频时 `#right-container` 可能被换掉，此前会导致观察器绑在游离节点上、新卡片与
  新广告全部漏处理），失效则自动重连。该 tick 同时补一次广告判定作为低频兜底。
- **广告独立的容器创建方法**：新增 `ensureAdBlockContainer()`（`ads.js`），
  不再走卡片专用的 `getBlockContainerHost()`（找 `.card-box` / `.bili-video-card`）。
  只在广告元素 `position` 为 `static` 时才补 `relative` 并打 `data-bl-ad-pos` 标记，
  已有定位上下文的广告位一律不动，避免破坏其浮动/绝对定位布局；仍复用
  `bilibili-blacklist-block-container-host` class，**“屏蔽原因: 广告”标签行为不变**。
- **调度合并**：观察器里“每批 mutation 各排一个 `setTimeout` 做广告全量重扫 + 重挂顶栏按钮”
  改为合并调度（`scheduleVideoAdProcessing` / `scheduleMainPageAdProcessing` /
  `scheduleHeaderButtonRefresh`），切视频时的 mutation 风暴不再产生大量重复定时器。
  主页/搜索页广告改为“出现新卡片或新广告元素时”触发，不再每批 mutation 无条件重扫。

### 已知取舍
- 若 `.right-entry` 始终不出现（`waitForContainer` 超时后不回调，本次按要求未改动该时序），
  播放页广告会与卡片一样**保持预覆盖状态**（模糊可见），而不是像以前那样完全裸露。
- `blockedVideoCards` 仍是强引用 Set，切视频后旧节点会累积（计数按要求保持累计，未清理）。

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
