# Bilibili-BlackList HelloWorld

> 从 `bilibili-blacklist` 完全重写而来的新分支工程：**沿用相同的 build / dev 工作流**，但项目结构、构建配置与开发脚本都更精细、更干净。当前工程只包含**一个源代码文件**，向控制台打印 `hello world`。

---

## 📦 工程定位

| 方面 | 旧工程（bilibili-blacklist） | 新工程（本工程） |
| ---- | ---- | ---- |
| 代码规模 | 多个业务模块 | 当前仅 1 个入口文件 |
| 模块顺序 | 硬编码在 `build.js` | 配置在 `build.config.json` |
| userscript 元数据 | 硬编码在 `build.js` | 配置在 `build.config.json` |
| 输出文件名/目录 | 硬编码 | 配置驱动 |
| 模块组织 | 依赖 `src/main.js` 特殊去包装逻辑 | 所有模块均为纯代码，统一由构建器包裹 |

---

## 🗂️ 目录结构

```
bilibili-blacklist-helloworld/
├── build.js                     # 构建脚本（合并模块 -> 单个 .user.js）
├── build.config.json            # 构建配置（元数据 + 模块顺序 + 输出文件）
├── package.json                 # npm 脚本（build / dev）
├── README.md                    # 本说明
├── CHANGELOG.md                 # 更新记录
├── .gitignore                   # 忽略 dist、node_modules 等
├── .gitattributes               # 统一 LF
├── src/
│   └── main.js                  # 唯一的源代码：console.log('hello world')
├── scripts/
│   └── dev.js                   # 一键开发脚本
└── test/
    ├── bilibili-blacklist-helloworld.dev.user.js  # 油猴加载器（装一次）
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
dist/bilibili-blacklist-helloworld.user.js
```

### 开发（推荐）

#### 1. 一次性安装加载器

打开 `test/bilibili-blacklist-helloworld.dev.user.js`，按油猴提示安装（或用浏览器访问 `http://localhost:5173/test/bilibili-blacklist-helloworld.dev.user.js` 安装）。

#### 2. 启动开发环境

```bash
npm run dev
```

或双击 `test\s.bat`。

启动后自动完成：

1. 首次构建产物到 `dist/bilibili-blacklist-helloworld.user.js`；
2. 监听 `src/` 目录，代码变更后自动重新构建（防抖 150ms）；
3. 在 `http://localhost:5173` 启动静态服务器（`no-cache` + CORS）。

#### 3. 开始开发

修改 `src/` 下的代码并保存 → 控制台提示“构建完成” → 刷新页面即可看到最新效果。

---

## 🧪 当前功能

打开 B 站任意页面，控制台会输出：

```
hello world
```

---

## 📋 更新记录

详见 [CHANGELOG.md](./CHANGELOG.md)。

---

## 📜 开源许可

MIT License.
