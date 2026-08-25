# Bilibili-BlackList Remake

> 从 `bilibili-blacklist` 完全重写而来的新分支工程：**沿用相同的 build / dev 工作流**，但项目结构、构建配置与开发脚本都更精细、更干净。源码按功能拆分为多个模块，当前用于观察 B 站视频卡片并提取 标题 / UP 名 / bvid。

---

## 📦 工程定位

| 方面 | 旧工程（bilibili-blacklist） | 新工程（本工程） |
| ---- | ---- | ---- |
| 代码规模 | 多个业务模块 | 按功能拆分的多个模块 |
| 模块顺序 | 硬编码在 `build.js` | 配置在 `build.config.json` |
| userscript 元数据 | 硬编码在 `build.js` | 配置在 `build.config.json` |
| 输出文件名/目录 | 硬编码 | 配置驱动 |
| 模块组织 | 依赖 `src/main.js` 特殊去包装逻辑 | 所有模块均为纯代码，统一由构建器包裹 |

---

## 🗂️ 目录结构

```
bilibili-blacklist-remake/
├── build.js                     # 构建脚本（合并模块 -> 单个 .user.js）
├── build.config.json            # 构建配置（元数据 + 模块顺序 + 输出文件）
├── package.json                 # npm 脚本（build / dev）
├── README.md                    # 本说明
├── CHANGELOG.md                 # 更新记录
├── .gitignore                   # 忽略 dist、node_modules 等
├── .gitattributes               # 统一 LF
├── src/
│   ├── config/
│   │   └── selectors.js         # 所有 CSS 选择器（数组，便于修改）
│   ├── utils/
│   │   ├── query.js             # 查询工具（queryFirst / queryFirstText）
│   │   └── log.js               # 控制台日志输出
│   ├── core/
│   │   ├── cards.js             # 卡片查找与字段提取（extractCard，不含 el）
│   │   ├── matcher.js           # 黑名单匹配（精确 / 正则）
│   │   └── block.js             # 校验 + 屏蔽（遮挡 / 隐藏、屏蔽按钮）
│   ├── storage/
│   │   └── storage.js           # 黑名单 + 配置（GM 存储）
│   ├── ui/
│   │   └── ui.js                # 顶栏入口 + 管理面板
│   ├── observer/
│   │   └── observer.js          # 增量 MutationObserver（只处理新增卡片）
│   ├── network/
│   │   └── interceptor.js       # Fetch / XHR 拦截（占位，默认不启用）
│   └── main.js                  # 主入口：初始化界面 + 初次扫描 + 增量监听
├── scripts/
│   └── dev.js                   # 一键开发脚本
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

### 开发（推荐）

#### 1. 一次性安装加载器

打开 `test/bilibili-blacklist-remake.dev.user.js`，按油猴提示安装（或用浏览器访问 `http://localhost:5173/test/bilibili-blacklist-remake.dev.user.js` 安装）。

#### 2. 启动开发环境

```bash
npm run dev
```

或双击 `test\s.bat`。

启动后自动完成：

1. 首次构建产物到 `dist/bilibili-blacklist-remake.user.js`；
2. 监听 `src/` 目录，代码变更后自动重新构建（防抖 150ms）；
3. 在 `http://localhost:5173` 启动静态服务器（`no-cache` + CORS）。

#### 3. 开始开发

修改 `src/` 下的代码并保存 → 控制台提示“构建完成” → 刷新页面即可看到最新效果。

---

## 🧪 当前功能

打开 B 站页面后，脚本会：

- 在卡片**悬停时显示「屏蔽」按钮**，点击把该 UP 主加入精确黑名单并立即屏蔽；
- 命中黑名单（**精确匹配 UP 主名** / **正则匹配 UP 名或标题**）的卡片，会被 **遮挡模糊层** 或 **直接隐藏**（可在插件配置切换）；
- 顶栏右侧（或右上角兜底）出现**卡比入口 + 已屏蔽计数**，点击打开管理面板：
  - **精确匹配(UP名)**：添加 / 移除 UP 主名；
  - **正则匹配(UP/标题)**：添加 / 移除正则规则；
  - **插件配置**：开关「按 UP/标题屏蔽」「遮挡模式」，以及「取消屏蔽 / 恢复屏蔽」。

控制台仍会打印每张卡片的信息：

```
[🫥BlackList] 视频卡片 - <视频标题>
title : <视频标题>
up    : <UP 主名字>
bvid  : <BV 号>
```

- 初次扫描页面已有的卡片；
- 之后通过 `MutationObserver` **增量监听**：只在“新卡片插入时”即时 提取 → 校验 → 屏蔽，**不做全量重扫**；
- 用 `WeakSet` 记录已处理卡片（弱引用），卡片被移除后随 GC 释放，**不保存 el，也不累积数组**；
- 调试统计：`window.__blacklistStats = { processed, blocked }`；
- 网络拦截器（Fetch / XHR）已预留，默认不启用：后续用 `window.__blacklistInterceptors.install()` 开启。

### 选择器管理（易改）

所有 CSS 选择器都集中在 `src/config/selectors.js` 的 `SELECTORS` 数组里（卡片根 / 标题 / UP 名 / bvid 链接），
B 站改版时只需增删数组项即可，不用到处改代码。

### 执行时机（重要）

脚本不会在页面加载一开始就抢跑，而是做了两层“就绪”保护：

1. **`@run-at document-idle`**：由 `build.config.json` 控制，让脚本在页面解析完成后才注入；
2. **`src/main.js` 内的兜底等待**：等待 `DOMContentLoaded`，再等待 B 站初始数据 `window.__INITIAL_STATE__`（其中含 `related` / `availableVideoList` 等数组）就绪，带 3 秒超时兜底，避免无限等待。

这样真正接入业务逻辑时，不会因为“跑得比网页数据加载还早”而读不到 DOM 或数据。

---

## 📋 更新记录

详见 [CHANGELOG.md](./CHANGELOG.md)。

---

## 📜 开源许可

MIT License.