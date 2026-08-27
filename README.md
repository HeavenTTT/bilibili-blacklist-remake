# Bilibili-BlackList Remake

> 从 `bilibili-blacklist` 移植/重写而来的新分支工程：**沿用相同的 build / dev 工作流**，但项目结构、构建配置与开发脚本都更精细、更干净。现已完整移植旧版功能：黑名单匹配、卡片屏蔽、广告屏蔽、分类标签/竖屏判断、自动连播处理、管理面板等。

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
│   └── main.js                  # 主入口：暴露调试 / 网络入口
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

已按你的选择完整移植旧版 Bilibili-BlackList：

- **黑名单**：精确匹配 UP 主名 + 正则匹配（UP/标题），GM 持久化（默认保留旧版列表）
- **卡片屏蔽**：命中黑名单 → 遮挡模糊层（卡比）或直接隐藏；卡片悬停显示「屏蔽」按钮
- **广告屏蔽**：主页 / 播放页推广、直播、游戏 / 活动等广告
- **分类标签屏蔽**：调 `view` 接口按分类标签名屏蔽（带标签按钮，点击可加黑名单）
- **cm 软广**：屏蔽 `cm.bilibili.com` 链接
- **竖屏屏蔽**：按 API 分辨率判断竖屏
- **悬停临时显示**：遮挡卡片悬停指定秒后临时显示
- **自动连播处理**：播放页连播遇被屏蔽视频 → 切换 / 停止 / 不处理
- **用户空间页**：UP 名旁「屏蔽 / 已屏蔽」按钮 + 删除线 + 灰度
- **分页初始化**：主页 / 搜索页 / 播放页 / 分类页 / 用户空间页分别初始化
- **管理面板**（四个标签页）：精确匹配(Up名字) / 正则匹配(Up/标题) / 屏蔽分类 / 插件配置，含「取消屏蔽 / 恢复屏蔽」、已屏蔽计数
- **保留的优化**：视频页延迟 5 秒启用、队列串行限速 `200ms`（防 API 限流）、标签名列表缓存（60 秒更新一次）、主页屏蔽后布局修正

控制台前缀统一为 `[🫥BlackList]`。

### 插件配置（面板内「插件配置」标签页）

按标题/UP主名(`flagInfo`)、广告(`flagAD`)、分类标签(`flagTName`)、cm软广(`flagCM`)、竖屏(`flagVertical`)、遮挡模式(`blockDisplayMode`，各类型可用 `displayModeInfo/AD/TName/CM/Vertical` 覆盖)、网络拦截(`flagNetworkIntercept`)、悬停临时显示(`flagHoverReveal`)、自动连播处理(`flagSkipBlockedAutoplay`) 等开关，以及标签缓存清除、悬停延迟、扫描间隔、竖屏阈值等设置。

### 正则表达式（正则匹配标签页）

- 支持**纯 pattern**：`小小.*Official`（默认忽略大小写）
- 支持**显式 flags**：`/小小.*Official/i`、`/吃鸡|pubg/gi`
- 常用示例：
  - `^米哈游` —— UP 名以“米哈游”开头
  - `官方# Bilibili-BlackList Remake

> 从 `bilibili-blacklist` 移植/重写而来的新分支工程：**沿用相同的 build / dev 工作流**，但项目结构、构建配置与开发脚本都更精细、更干净。现已完整移植旧版功能：黑名单匹配、卡片屏蔽、广告屏蔽、分类标签/竖屏判断、自动连播处理、管理面板等。

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
│   └── main.js                  # 主入口：暴露调试 / 网络入口
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

已按你的选择完整移植旧版 Bilibili-BlackList：

- **黑名单**：精确匹配 UP 主名 + 正则匹配（UP/标题），GM 持久化（默认保留旧版列表）
- **卡片屏蔽**：命中黑名单 → 遮挡模糊层（卡比）或直接隐藏；卡片悬停显示「屏蔽」按钮
- **广告屏蔽**：主页 / 播放页推广、直播、游戏 / 活动等广告
- **分类标签屏蔽**：调 `view` 接口按分类标签名屏蔽（带标签按钮，点击可加黑名单）
- **cm 软广**：屏蔽 `cm.bilibili.com` 链接
- **竖屏屏蔽**：按 API 分辨率判断竖屏
- **悬停临时显示**：遮挡卡片悬停指定秒后临时显示
- **自动连播处理**：播放页连播遇被屏蔽视频 → 切换 / 停止 / 不处理
- **用户空间页**：UP 名旁「屏蔽 / 已屏蔽」按钮 + 删除线 + 灰度
- **分页初始化**：主页 / 搜索页 / 播放页 / 分类页 / 用户空间页分别初始化
- **管理面板**（四个标签页）：精确匹配(Up名字) / 正则匹配(Up/标题) / 屏蔽分类 / 插件配置，含「取消屏蔽 / 恢复屏蔽」、已屏蔽计数
- **保留的优化**：视频页延迟 5 秒启用、队列串行限速 `200ms`（防 API 限流）、标签名列表缓存（60 秒更新一次）、主页屏蔽后布局修正

控制台前缀统一为 `[🫥BlackList]`。

### 插件配置（面板内「插件配置」标签页）

按标题/UP主名(`flagInfo`)、广告(`flagAD`)、分类标签(`flagTName`)、cm软广(`flagCM`)、竖屏(`flagVertical`)、遮挡模式(`blockDisplayMode`，各类型可用 `displayModeInfo/AD/TName/CM/Vertical` 覆盖)、网络拦截(`flagNetworkIntercept`)、悬停临时显示(`flagHoverReveal`)、自动连播处理(`flagSkipBlockedAutoplay`) 等开关，以及标签缓存清除、悬停延迟、扫描间隔、竖屏阈值等设置。

 —— 以“官方”结尾
  - `华为|荣耀` —— 或匹配
  - `\\d+` 或 `[0-9]+` —— 匹配数字
  - `/.*(混剪|解说).*/i` —— 标题含“混剪/解说”（忽略大小写）
- 无效正则会**自动跳过**并在控制台警告，不会影响其它卡片。
- 参考：
  - [MDN 正则表达式指南](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Regular_Expressions)
  - [MDN RegExp 对象](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/RegExp)

### 执行时机

`@run-at document-idle` + 页面就绪保护（旧版逻辑，按页初始化）。

## 📋 更新记录

详见 [CHANGELOG.md](./CHANGELOG.md)。

---

## 📜 开源许可

MIT License.