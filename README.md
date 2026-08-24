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
│   │   └── cards.js             # 卡片查找与字段提取（含 collectCards，返回卡片本体 el）
│   ├── observer/
│   │   └── observer.js          # MutationObserver 监听新增卡片
│   └── main.js                  # 主入口：启动扫描与观察
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

打开 B 站页面后，脚本会观察页面上的**全部视频卡片**，并为每张卡片打印：

```
[🫥BlackList] 视频卡片 - <视频标题>
title : <视频标题>
up    : <UP 主名字>
bvid  : <BV 号>
```

- 初次扫描打印页面已有的卡片；
- 通过 `MutationObserver` 监听新增卡片（无限滚动 / SPA 加载），只对新出现的卡片打印；
- 结果数组会暴露为 `window.__blacklistCards`，每一项为 `{ title, up, bvid, el }`，其中 **`el` 就是卡片 DOM 本体**，可直接用于后续改卡片 / 加按钮。

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