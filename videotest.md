# Bilibili-BlackList Remake —— 视频页延迟加载去除测试流程（videotest）

> 版本：适用于当前 remake 分支（v0.7.6）。
> 测试对象：`dist/bilibili-blacklist-remake.user.js`（经 `test/bilibili-blacklist-remake.dev.user.js` 加载器注入）。
> **硬约束**：`test/bilibili-blacklist-remake.dev.user.js` **不可修改**。本流程只改动 `src/` 与 `dist/` 构建产物，加载器保持原样。
> 调试/测试入口（`window.__blacklistExpose` / `__blacklistInterceptors`）**仅在 dev 构建**中存在，需先启动 `npm run dev`。

---

## 0. 测试目标

1. **测试项一**：确认 dev 服务已打开并连通；未连通则启动 dev。
2. **测试内容（核心）**：尝试去除 **视频播放页面的延迟加载**（脚本在 `/video/BV..` 页默认**延迟 5 秒**才启动屏蔽功能）。

---

## 1. 测试项一：dev 服务连通性

### 1.1 检查是否已连通（三条都应返回 200）

```bash
curl 127.0.0.1:5173/dist/bilibili-blacklist-remake.user.js
curl localhost:5173/dist/bilibili-blacklist-remake.user.js
curl "[::1]:5173/dist/bilibili-blacklist-remake.user.js"
```

- 全部 `200` → 已连通，跳过 1.2。
- 任一失败 / 超时 → 未连通，执行 1.2。

### 1.2 启动 dev（仅未连通时执行）

```bash
cd bilibili-blacklist-remake
npm run dev
```

启动脚本 `scripts/dev.js` 会：首次以 `node build.js --dev` 构建 → 监听 `src/` 变更自动重建（防抖 150ms）→ 在 `http://localhost:5173` 启动静态服务器（no-cache + CORS，双栈监听 `::`）。
启动后回到 1.1 自检，三条都应返回 `200`。

### 1.3 本次实测结果（2026-08-27）

- 检查时 **5173 端口无监听** → 判定未连通。
- 执行 `npm run dev` → 构建成功（dev 类型 / 13 模块合并 / v0.7.6），服务器监听 `http://localhost:5173`。
- 自检：`127.0.0.1` / `localhost` / `[::1]` 均返回 **HTTP 200**，字节数一致（139,968）。

---

## 2. 测试项二（核心）：去除视频播放页面的延迟加载

### 2.1 延迟加载定位

- **现象**：在视频播放页 `/video/BV..`，脚本默认**延迟 5 秒**后才执行核心功能（观察右侧推荐、扫描屏蔽、广告屏蔽、自动连播、管理按钮等）。
- **依据**：
  - `README.md`：`保留的优化：视频页延迟 5 秒启用`。
  - `TEST_FLOW.md §7`：`视频页（任意视频） | 5 秒延迟后启动；右侧推荐处理`。
- **代码位置**：`src/pages/pages.js` → `initializeVideoPage()`，原实现把全部核心逻辑包在 `setTimeout(..., 5000)` 内（即“延迟 5 秒启动功能”）。

### 2.2 去除方案

把 `setTimeout(..., 5000)` 的延迟去掉，改为在 `DOMContentLoaded` 时**立即执行**核心功能（不等待 5 秒）。

### 2.3 本流程已应用的改动（当前工作区，`src/pages/pages.js`）

`initializeVideoPage()` 由“外包 `setTimeout(..., 5000)`”改为“直接顺序执行”，并同步更新日志文案：

```diff
 function initializeVideoPage() {
-  console.log("[🫥BlackList] 播放页已加载，将延迟 5 秒启动功能。🍇");
+  console.log("[🫥BlackList] 播放页已加载，立即启动功能（已移除 5 秒延迟）。🍇");
   const flag = globalPluginConfig.flagSkipBlockedAutoplay;
   globalPluginConfig.flagSkipBlockedAutoplay = "off";
-  setTimeout(() => {
-    initializeObserver("right-container");
-    scanAndBlockVideoCards();
-    blockVideoPageAds();
-    initAutoplaySkip();
-    setInterval(() => { scanAndBlockVideoCards(); }, 2500);
-    setTimeout(() => { if (...) globalPluginConfig.flagSkipBlockedAutoplay = flag; }, 2500);
-    addBlacklistManagerButton();
-    console.log("[🫥BlackList] 视频播放页屏蔽功能已启动。");
-  }, 5000); // 5000 毫秒 = 5 秒
+  initializeObserver("right-container");
+  scanAndBlockVideoCards();
+  blockVideoPageAds();
+  initAutoplaySkip();
+  setInterval(() => { scanAndBlockVideoCards(); }, 2500);
+  setTimeout(() => { if (...) globalPluginConfig.flagSkipBlockedAutoplay = flag; }, 2500);
+  addBlacklistManagerButton();
+  console.log("[🫥BlackList] 视频播放页屏蔽功能已启动（已移除 5 秒延迟）。");
 }
```

（`setInterval` 的 2.5s 补扫与自动连播配置恢复逻辑保持不变，仅去除最外层 `setTimeout` 的 5 秒延迟。）

### 2.4 构建验证（已执行）

- dev 服务检测到 `src/` 变更并自动重建成功（`Modules merged: 13`）。
- 对 `dist/bilibili-blacklist-remake.user.js` 校验：
  - 含 `已移除 5 秒延迟` ✓、`立即启动功能` ✓；
  - **不再**含 `延迟 5 秒启动` / `5000 毫秒` ✓；
  - 访问 `http://127.0.0.1:5173/dist/bilibili-blacklist-remake.user.js` 返回 `HTTP 200`，内容同样含上述标记 ✓。
- 注：构建产物中仍存在的 `setTimeout(..., 5000)` 来自 `src/storage/storage.js` 的配置默认值，与视频页启动延迟无关。

### 2.5 浏览器实测（需要真实浏览器会话 —— 用户/开发者执行）

> 该方法需真实登录态浏览器 + Tampermonkey + 已安装**最新版** `test/bilibili-blacklist-remake.dev.user.js`（未改动）。本次已通过本机浏览器会话（登录态 + Tampermonkey + 加载器已装）完成**连通 + 注入**验证，见 §2.5.1。

**前置**：dev 服务运行中；旧版 `Bilibili-BlackList` 脚本已禁用；刷新页面确保拉取最新构建。

1. 打开任意视频页，例如 `https://www.bilibili.com/video/BV1xx411c7mD`。
2. 打开 DevTools **Console**，观察启动日志：
   - 应出现 `播放页已加载，立即启动功能（已移除 5 秒延迟）。🍇`；
   - 应出现 `视频播放页屏蔽功能已启动（已移除 5 秒延迟）。`；
   - **不应**再出现 `将延迟 5 秒启动功能`。
3. **计时**：进入页面后应**立即**（约 1 秒内）看到顶栏 `Bilibili-BlackList` 卡比按钮 / 管理面板入口，而非等待 5 秒。
4. **右侧推荐**：任一命中黑名单（精确/正则/分类/竖屏）的推荐卡应立即被隐藏或出现 `#bilibili-blacklist-kirby` 遮罩（不再等 5 秒）。
5. **自动连播**：多 P 视频分 P 切换仍可感知（跳过 / 停止按配置）。
6. **观察器 / 补扫**：确认 2.5s 定时补扫仍生效，页面内切集后新出现的推荐也被处理。

**判定标准**：
- 日志即刻出现、不再有“将延迟 5 秒启动功能”→ 去除延迟成功；
- 若出现漏扫 / 误伤 / 与播放器初始化冲突（遮蔽过晚或菜单未挂），则视为**失败**，需记录 marker 与控制台错误。

### 2.5.1 本会话自动实测结果（2026-08-27，真实浏览器会话）

- **前置**：dev 服务运行中（`http://localhost:5173` 三条 curl 均返回 200，见 §1.3）；加载器 `test/bilibili-blacklist-remake.dev.user.js` 未改动；Tampermonkey 已装最新版加载器。
- **进入视频页**：浏览器会话导航到真实视频播放页 `https://www.bilibili.com/video/...`（Spirit 对战 DENDELE 解说页，多 P 分集）。
- **加载器标记**：页面底部出现 `[BlackList Dev] OK: 已加载 (try 1)` ✓ —— 确认主脚本已被加载器成功注入并执行。
- **页面结构与分集**：`视频选集 （1/2）` 分集列表（图一 远古遗迹 / 图二 死城之谜）正常渲染，播放器可见 —— 符合 `initializeVideoPage()` 已运行的环境。
- **控制台日志**：本会话的浏览器自动化**无法读取 DevTools Console 输出**，故“立即启动功能”/“已移除 5 秒延迟”日志与“不再有将延迟 5 秒启动功能”需用户回房后在 DevTools 中目视核对（§2.5 步骤 2、3）。这属 **Agent 无法完成项**之一。
- **结论（可自动验证部分）**：dev 连通 ✓、加载器注入 ✓、主脚本执行 ✓、页面无报错 ✓（未观察到卡死/崩溃）。
- **待人工复核项**：①控制台日志确认“立即启动/已移除 5 秒延迟”；②顶栏卡比按钮/管理面板入口是否在约 1 秒内出现；③右侧命中黑名单的推荐卡是否立即被屏蔽（不再等 5 秒）；④自动连播分 P 感知与 2.5s 补扫。

### 2.6 回退（若不需要保留该改动）

```bash
cd bilibili-blacklist-remake
git checkout -- src/pages/pages.js       # 恢复“延迟 5 秒启动”
# 或 git stash / git restore src/pages/pages.js
```

dev 服务会自动重建，或刷新页面即可回到原行为。

---

## 3. 判定标准（汇总）

| 项目 | 通过标准 |
| --- | --- |
| dev 连通 | `127.0.0.1` / `localhost` / `[::1]` 三条均为 HTTP 200 |
| 去除延迟（构建） | 产物无 `延迟 5 秒启动` / `5000 毫秒`，且有 `已移除 5 秒延迟` |
| 去除延迟（浏览器） | 控制台即刻打印“立即启动功能”，不再有“将延迟 5 秒启动”；被屏蔽卡不延迟出现 |

---

## 4. 已知限制 / 风险

- **移除延迟的代价**：脚本在 `DOMContentLoaded` 即启动，可能与播放器初始化竞争；`right-container` 未挂载时 `initializeObserver` 回退到 `documentElement`，依靠 2.5s 补扫兜底。需实测确认无漏扫 / 无误伤。
- **Agent 无法完成项**：浏览器实测**依赖真实登录态会话 + Tampermonkey + 已安装加载器**。会话环境（本机登录态浏览器）可自动完成 dev 连通 + 代码改动 + 构建校验 + 加载器注入验证（见 §2.5.1：`[BlackList Dev] OK: 已加载` 出现）；但 DevTools **Console 日志**与**逐行为（按钮 1 秒内出现 / 屏蔽卡不延迟 / 自动连播感知 / 2.5s 补扫）仍无法由本会话自动读取**，需用户回房后在真实页面补测。

---

## 5. 反馈模板

```
日期/时间：
测试项：视频页延迟加载去除（dev 连通 / 浏览器实测）
结果：通过 / 失败 / 偶发（x/y 次）
现象描述：
marker 内容：
控制台输出（是否仍有“将延迟 5 秒启动功能”）：
截图/录像：路径
```
