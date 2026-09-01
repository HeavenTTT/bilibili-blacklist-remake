/*
 * 观察器模块
 * -----------------------------------------------------------
 * 增量 MutationObserver：只处理新插入的卡片/广告，避免全量重扫。
 *
 * 广告采用“双触发”：同一次 addedNodes 遍历里，新视频卡片或新广告元素任一出现，
 * 就合并调度一次广告的“覆盖 → 屏蔽”流程。
 *   - 用卡片当信号：卡片选择器稳定，切视频时右侧推荐必定重建，必定触发；
 *   - 用广告元素当信号：补上“广告晚于最后一批卡片插入、此后页面静止”的漏网场景；
 *   - 触发后走全量 querySelectorAll（由 AD_DONE_ATTR 去重），即使广告被包在未知容器里
 *     没能在 addedNodes 里被直接匹配到，也能被处理到。
 */
// (未启用) 页面可见性暂停处理已被移除

// 增量观察：只处理“新插入”的卡片，不做全量重扫
const INCREMENTAL_CARD_SELECTOR = ".bili-video-card, .video-page-card-small, .feed-card";
let seenCards = new WeakSet();
const seenAdElements = new WeakSet(); // 已被观察到的广告元素（仅用于判断“是否有新广告出现”）
let videoHeaderReady = false;
let observedRoot = null; // 当前实际 observe 的根节点（切视频后可能被整体替换）
let observedTarget = ""; // 对应的容器 id/选择器，供断连后重连使用
let headerButtonScheduled = false; // 顶栏管理按钮兜底重挂的合并调度标志

/**
 * 从一个新插入的节点里收集匹配指定选择器的元素。
 * 节点自身/祖先命中，或节点内部含有多个命中元素，都会被收集。
 * @param {HTMLElement} node - 新插入的元素节点。
 * @param {string} selectorText - CSS 选择器串。
 * @param {HTMLElement[]} out - 输出数组。
 */
function collectMatchingElements(node, selectorText, out) {
  if (!selectorText) return;
  const self = node.closest ? node.closest(selectorText) : null;
  if (self) {
    out.push(self);
    return;
  }
  const inside = node.querySelectorAll ? node.querySelectorAll(selectorText) : [];
  for (let i = 0; i < inside.length; i++) out.push(inside[i]);
}

/**
 * 合并调度一次顶栏管理按钮的兜底重挂。
 * 原实现是每批 mutation 都排一个 setTimeout，切视频时会产生大量重复定时器。
 */
function scheduleHeaderButtonRefresh() {
  if (headerButtonScheduled) return;
  headerButtonScheduled = true;
  setTimeout(() => {
    headerButtonScheduled = false;
    addBlacklistManagerButton(); // 函数内部有幂等判断
  }, globalPluginConfig.blockScanInterval);
}

const contentObserver = new MutationObserver((mutations) => {
  const foundCards = [];
  const foundAds = [];
  const adSelectorText = isCurrentPageVideo()
    ? VIDEO_AD_SELECTOR_TEXT
    : MAIN_AD_SELECTOR_TEXT;

  mutations.forEach((mutation) => {
    const addedNodes = mutation.addedNodes;
    for (let i = 0; i < addedNodes.length; i++) {
      const node = addedNodes[i];
      if (node.nodeType !== 1) continue; // 只处理元素
      collectMatchingElements(node, INCREMENTAL_CARD_SELECTOR, foundCards);
      collectMatchingElements(node, adSelectorText, foundAds);
    }
  });

  // 卡片去重（弱引用，卡片移除后自动释放）
  const fresh = [];
  for (let k = 0; k < foundCards.length; k++) {
    const card = foundCards[k];
    if (seenCards.has(card)) continue;
    seenCards.add(card);
    fresh.push(card);
    processCard(card); // 加按钮、立即隐藏/遮挡、压入队列
  }

  // 广告去重：这里只用来判断“本批是否出现了新广告元素”，
  // 真正的屏蔽去重由 AD_DONE_ATTR 负责。
  let freshAdCount = 0;
  for (let k = 0; k < foundAds.length; k++) {
    const adElement = foundAds[k];
    if (seenAdElements.has(adElement)) continue;
    seenAdElements.add(adElement);
    freshAdCount++;
  }

  // 有新卡片才处理队列（队列内部串行+限速）
  if (fresh.length > 0) {
    if (videoCardProcessQueue.size > 0 && !isVideoCardQueueProcessing) {
      processVideoCardQueue();
    }
    refreshBlockCountDisplay();
    if (isCurrentPageMain()) fixMainPageLayout();
  }

  // 双触发：新卡片或新广告任一出现，就合并调度一次广告处理
  if (fresh.length > 0 || freshAdCount > 0) {
    if (isCurrentPageVideo()) {
      scheduleVideoAdProcessing();
    } else if (isCurrentPageMain() || isCurrentPageSearch()) {
      scheduleMainPageAdProcessing();
    }
  }

  // 顶栏管理按钮若被 B 站重渲染顶掉，这里兜底重新挂载（合并调度，幂等）
  scheduleHeaderButtonRefresh();
});

/**
 * 轮询等待某个元素出现后执行回调（用于容器延迟渲染的情况）。
 * @param {string} selector - 容器ID或CSS选择器（按 id 优先，兼容纯 id 写法）
 * @param {(el: HTMLElement) => void} onFound - 找到后回调
 * @param {number} intervalMs - 轮询间隔（毫秒）
 * @param {number} timeoutMs - 总超时（毫秒），超时后放弃观察（由定时补扫兜底）
 */
function waitForContainer(selector, onFound, intervalMs = 250, timeoutMs = 15000) {
  const find = () => {
    const el = document.getElementById(selector) || document.querySelector(selector);
    if (el) {
      clearInterval(timer);
      clearTimeout(timeout);
      onFound(el);
    }
  };
  const timer = setInterval(find, intervalMs);
  const timeout = setTimeout(() => clearInterval(timer), timeoutMs);
  find();
}

/**
 * 重置“已观察到的卡片”记录。
 *
 * 观察器按元素引用去重，若 B 站复用同一批卡片节点只替换内容（搜索页翻页常见），
 * 这些节点会被永远判为“已处理”而跳过。翻页时重置即可让它们重新参与处理。
 */
function resetSeenCards() {
  seenCards = new WeakSet();
}

/**
 * 在指定容器上初始化MutationObserver。
 * @param {string} containerIdOrSelector - 要观察的容器的ID或CSS选择器。
 */
function initializeObserver(containerIdOrSelector) {
  observedTarget = containerIdOrSelector;
  const rootNode =
    document.getElementById(containerIdOrSelector) ||
    document.querySelector(containerIdOrSelector);

  if (rootNode) {
    observedRoot = rootNode;
    contentObserver.observe(rootNode, {
      childList: true,
      subtree: true,
    });
    return;
  }

  // 容器尚未挂载时按页面区分处理：
  // - 视频播放页：为避免与 B 站顶栏的 Vue 渲染竞争（把 header 顶掉），保持
  //   “等待容器出现后再观察”，不回退整页；等待期间由视频页自身的 2.5s 定期补扫兜底。
  // - 其它页面（主页/搜索页/分类页/排行榜等）：不需要这种特殊处理。主页与搜索页
  //   只有一次性的 800ms 补扫，若容器 id 与当前 B 站 DOM 不一致，观察器若一直等待
  //   就会漏掉滚动加载/翻页出现的新卡片，因此直接回退观察整篇文档，保证新卡片被捕获。
  if (isCurrentPageVideo()) {
    console.log(
      "[🫥BlackList] 观察容器尚未挂载，等待其出现后再观察（避免回退整页干扰 header）:",
      containerIdOrSelector
    );
    waitForContainer(containerIdOrSelector, (el) => {
      observedRoot = el;
      contentObserver.observe(el, {
        childList: true,
        subtree: true,
      });
    });
    return;
  }

  // 非视频页：回退观察整篇文档，避免漏掉动态插入的新卡片。
  observedRoot = document.documentElement;
  contentObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

/**
 * 检查观察根节点是否仍在文档中；若已被整体替换（页面内切视频常见），则重新绑定观察器。
 *
 * 播放页 observe 的是 #right-container 这个具体节点，B 站切视频若把它整个换掉，
 * 观察器就会绑在游离节点上，此后新卡片/新广告都不再触发回调。
 * @returns {boolean} 是否执行了重连。
 */
function ensureObserverAttached() {
  if (!observedTarget) return false;
  if (observedRoot && observedRoot.isConnected) return false;
  console.log("[🫥BlackList] 观察根节点已失效，重新绑定观察器:", observedTarget);
  contentObserver.disconnect();
  observedRoot = null;
  initializeObserver(observedTarget);
  return true;
}
