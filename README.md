# Bilibili-BlackList Remake

> 从 `bilibili-blacklist` 移植/重写而来的新分支工程：**沿用相同的 build / dev 工作流**，但项目结构、构建配置与开发脚本都更精细、更干净。现已完整移植旧版功能：黑名单匹配、卡片屏蔽、广告屏蔽、分类标签/竖屏判断、自动连播处理、管理面板等。

---

## ⚠️ 免责声明（Disclaimer）

- **本项目由人工智能（AI）编写**：Bilibili-BlackList Remake 由 **DeepSeek Harness（AI）** 自动生成与维护，并非由人类逐行手工开发。所有代码、方案与文案均由 AI 产出。
- 使用本插件会造成**第三方页面内容被隐藏/改写**，可能与本插件预期不符；请在**充分理解其行为**后再安装使用。
- 第三方站点（B 站）页面结构、接口与政策可能变化，本插件可能**失效、误伤或引发异常**。作者/生成者**不保证**其持续可用，也不承担因此产生的任何损失。
- 建议仅用于**个人学习、研究和受控测试**；使用前请自行评估风险。
- 插件管理面板「插件配置」标签页底部也会展示该免责声明与作者信息。

**作者（AI）**：DeepSeek Harness（AI）
**原版思路/基础**：HeavenTTT 的 [bilibili-blacklist](https://github.com/HeavenTTT/bilibili-blacklist)

---

## 📦 工程定位

| 方面 | 旧工程（bilibili-blacklist） | 新工程（本工程） |
| ---- | ---- | ---- |
| 代码规模 | 多个业务模块 | 按功能拆分的多个模块 |
| 模块顺序 | 硬编码在 `build.js` | 配置在 `build.config.json` |
| userscript 元数据 | 硬编码在 `build.js` | 配置在 `build.config.json` |
| 输出文件名/目录 | 硬编码 | 配置驱动 |
| 模块组织 | 依赖 `src/main.js` 特殊去包装逻辑 | 所有模块均为纯代码，统一由构建器包裹 |
| 测试方法 | 随构建注入 | **仅 dev 构建注入**（发布构建不包含） |

---

## 🗂️ 目录结构

```
bilibili-blacklist-remake/
├── build.js                     # 构建脚本（合并模块 -> 单个 .user.js，支持 --dev）
├── build.config.json            # 构建配置（元数据 + 模块顺序 + 输出文件 + devModules）
├── package.json                 # npm 脚本（build / build:dev / dev）
├── README.md                    # 本说明
├── CHANGELOG.md                 # 更新记录
├── .gitignore                   # 忽略 dist、node_modules 等
├── .gitattributes               # 统一 LF
├── src/
│   ├── storage/
│   │   └── storage.js           # 黑名单 + 配置（GM 存储）
│   ├── utils/
│   │   └── utils.js             # 标签名列表更新等工具
│   ├── core/
│   │   ├── core.js              # 卡片查找 / 屏蔽 / 黑名单增删 / 主页布局修正
│   │   └── video-data.js        # 队列处理 + 分类标签 / 竖屏 API 判断
│   ├── ui/
│   │   └── ui.js                # 顶栏入口 + 管理面板 + 遮挡层 / 屏蔽按钮
│   ├── observer/
│   │   └── observer.js          # 增量 MutationObserver（只处理新增卡片）
│   ├── pages/
│   │   └── pages.js             # 分页初始化（主页 / 搜索 / 播放 / 分类 / 空间）
│   ├── ads/
│   │   └── ads.js               # 广告屏蔽
│   ├── autoplay/
│   │   └── autoplay.js          # 自动连播处理
│   ├── network/
│   │   └── interceptor.js       # Fetch / XHR 拦截（占位，默认不启用）
│   ├── debug/
│   │   └── dev-test.js          # 调试/测试入口（**仅 dev 构建注入**，发布构建不包含）
│   └── main.js                  # 主入口：兼容晚注入的立即初始化
├── scripts/
│   └── dev.js                   # 一键开发脚本（以 dev 构建启动）
└── test/
    ├── bilibili-blacklist-remake.dev.user.js  # 油猴加载器（装一次）
    └── s.bat                    # Windows 双击启动开发环境
```

---

## 🚀 快速开始

### 构建（发布用）

```bash
npm run build
# 或
node build.js
```

构建产物：

```
dist/bilibili-blacklist-remake.user.js
```

> **注意**：发布构建**不会包含**调试/测试方法（`window.__blacklistExpose`、`window.__blacklistInterceptors`、`__blockTestRun` 等）。

### 开发（推荐）

#### 1. 一次性安装加载器

打开 `test/bilibili-blacklist-remake.dev.user.js`，按油猴提示安装（或用浏览器访问 `http://localhost:5173/test/bilibili-blacklist-remake.dev.user.js` 安装）。

#### 2. 启动开发环境

```bash
npm run dev
```

或双击 `test\s.bat`。

启动后自动完成：

1. 以 **dev 构建**（`node build.js --dev`）产物到 `dist/bilibili-blacklist-remake.user.js`；
2. 监听 `src/` 目录，代码变更后自动重新构建（防抖 150ms）；
3. 在 `http://localhost:5173` 启动静态服务器（`no-cache` + CORS）。

> dev 构建会在 `src/debug/dev-test.js` 里注入**仅用于开发**的调试/测试入口，方便控制台联调。它们**不会**出现在发布构建中。

#### 3. 开始开发

修改 `src/` 下的代码并保存 → 控制台提示“构建完成” → 刷新页面即可看到最新效果。

---

## 🧪 当前功能

已按你的选择完整移植旧版 Bilibili-BlackList：

- **黑名单**：精确匹配 UP 主名 + 正则匹配（UP/标题），GM 持久化（默认保留旧版列表）
- **卡片屏蔽**：命中黑名单 → 遮挡模糊层（卡比）或直接隐藏；卡片悬停显示「屏蔽」按钮
- **广告屏蔽**：主页 / 播放页推广、直播、游戏 / 活动等广告。播放页与视频卡片同节奏：
  进入页面先用 CSS 预覆盖罩住广告位 → 等 header 就绪 → 再按所选遮挡模式屏蔽；
  页面内切视频时重新覆盖，观察到新卡片或新广告元素即重新处理
- **分类标签屏蔽**：调 `view` 接口按分类标签名屏蔽（带标签按钮，点击可加黑名单）
- **cm 软广**：屏蔽 `cm.bilibili.com` 链接
- **竖屏屏蔽**：按 API 分辨率判断竖屏
- **悬停临时显示**：遮挡卡片悬停指定秒后临时显示
- **自动连播处理**：播放页连播遇被屏蔽视频 → 切换 / 停止 / 不处理
- **用户空间页**：UP 名旁「屏蔽 / 已屏蔽」按钮 + 删除线 + 灰度
- **分页初始化**：主页 / 搜索页 / 播放页 / 分类页 / 用户空间页分别初始化
- **管理面板**（四个标签页）：精确匹配(Up名字) / 正则匹配(Up/标题) / 屏蔽分类 / 插件配置，含「取消屏蔽 / 恢复屏蔽」、已屏蔽计数
- **保留的优化**：视频页延迟 5 秒启用、标签名列表缓存（60 秒更新一次）、主页屏蔽后布局修正
- **队列判定分两阶段**：先做零网络判定（软广链接 > UP主名精确 > 正则），命中即提交、不发请求也不限速；
  只有未命中的卡片才请求 `view` 接口做分类标签 / 竖屏判定，并按 `200ms` 限速（防 API 限流）。
  接口请求带 5 秒超时，避免单个挂起请求卡死整条队列；已从文档移除的卡片（翻页/切集后的旧卡片）直接跳过

控制台前缀统一为 `[🫥BlackList]`。

### 插件配置（面板内「插件配置」标签页）

按标题/UP主名(`flagInfo`)、广告(`flagAD`)、分类标签(`flagTName`)、始终获取分类标签(`flagAlwaysFetchTName`)、cm软广(`flagCM`)、竖屏(`flagVertical`)、遮挡模式(`blockDisplayMode`，各类型可用 `displayModeInfo/AD/TName/CM/Vertical` 覆盖)、网络拦截(`flagNetworkIntercept`)、悬停临时显示(`flagHoverReveal`)、自动连播处理(`flagSkipBlockedAutoplay`) 等开关，以及标签缓存清除、悬停延迟、扫描间隔、竖屏阈值等设置。

其中 `flagAlwaysFetchTName`（默认开启）控制“已被 UP主名/正则/软广命中的卡片是否仍请求接口以显示分类标签按钮”：
开启时这些请求会排在低优先级的补标签队列，标签始终可见且不拖慢其它卡片的判定；关闭则不再为这些卡片请求接口，
队列处理更快（搜索页翻页尤其明显），代价是这些卡片上看不到分类标签。

### 正则表达式（正则匹配标签页）

- 支持**纯 pattern**：`小小.*Official`（默认忽略大小写）
- 支持**显式 flags**：`/小小.*Official/i`、`/吃鸡|pubg/gi`
- 常用示例：
  - `^米哈游` —— UP 名以“米哈游”开头
  - `官方$` —— 以“官方”结尾
  - `华为|荣耀` —— 或匹配
  - `\d+` 或 `[0-9]+` —— 匹配数字
  - `/.*(混剪|解说).*/i` —— 标题含“混剪/解说”（忽略大小写）
- 无效正则会**自动跳过**并在控制台警告，不会影响其它卡片。
- 参考：
  - [MDN 正则表达式指南](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Regular_Expressions)
  - [MDN RegExp 对象](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/RegExp)

### 执行时机

`@run-at document-idle` + 页面就绪保护（旧版逻辑，按页初始化）。

---

## 🧪 开发/测试入口（仅 dev 构建）

发布构建（`npm run build`）**不包含**以下对象；dev 构建（`npm run dev` / `node build.js --dev`）才会注入：

- `window.__blacklistConfig`：当前全局配置对象引用
- `window.__blacklistInterceptors`：网络拦截安装 / 配置入口
- `window.__blacklistExpose`：
  - `stats()`：返回已屏蔽计数摘要
  - `testBlock100(n)`：非破坏性自动化测试“屏蔽 UP 按钮 100 次点击”（详见 `TEST_FLOW.md §9`）

> 这些入口仅用于**开发调试与测试**，不影响线上功能。

---

## 📋 更新记录

详见 [CHANGELOG.md](./CHANGELOG.md)。

---

## 📜 开源许可

MIT License。
