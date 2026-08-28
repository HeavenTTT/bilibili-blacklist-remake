/*
 * 观察器模块
 * -----------------------------------------------------------
 * 增量 MutationObserver：只处理新插入的卡片，避免全量重扫。
 */
// (未启用) 页面可见性暂停处理已被移除

// 增量观察：只处理“新插入”的卡片，不做全量重扫
const INCREMENTAL_CARD_SELECTOR = ".bili-video-card, .video-page-card-small, .feed-card";
const seenCards = new WeakSet();
let videoHeaderReady = false;

const contentObserver = new MutationObserver((mutations) => {
  const found = [];
  mutations.forEach((mutation) => {
    const addedNodes = mutation.addedNodes;
    for (let i = 0; i < addedNodes.length; i++) {
      const node = addedNodes[i];
      if (node.nodeType !== 1) continue;   // 只处理元素
      // 节点本身或祖先就是卡片
      const self = node.closest ? node.closest(INCREMENTAL_CARD_SELECTOR) : null;
      if (self) { found.push(self); continue; }
      // 容器整体插入，内部可能含多张卡片
      const inside = node.querySelectorAll ? node.querySelectorAll(INCREMENTAL_CARD_SELECTOR) : [];
      for (let j = 0; j < inside.length; j++) found.push(inside[j]);
    }
  });

  // 去重（弱引用，卡片移除后自动释放）
  const fresh = [];
  for (let k = 0; k < found.length; k++) {
    const card = found[k];
    if (seenCards.has(card)) continue;
    seenCards.add(card);
    fresh.push(card);
    processCard(card);   // 加按钮、立即隐藏/遮挡、压入队列
  }

  // 有新卡片才处理队列（队列内部串行+限速）
  if (fresh.length > 0) {
    if (videoCardProcessQueue.size > 0 && !isVideoCardQueueProcessing) {
      processVideoCardQueue();
    }
    refreshBlockCountDisplay();
    if (isCurrentPageMain()) fixMainPageLayout();
  }

  // 顶栏管理按钮若被 B 站重渲染顶掉，这里兜底重新挂载（函数内部有幂等判断）
  // 广告屏蔽（适度延迟合并，避免频繁）
  setTimeout(() => {
    addBlacklistManagerButton();
    if (isCurrentPageMain()) blockMainPageAds();
    if (isCurrentPageVideo()) blockVideoPageAds();
  }, globalPluginConfig.blockScanInterval);
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
 * 在指定容器上初始化MutationObserver。
 * @param {string} containerIdOrSelector - 要观察的容器的ID或CSS选择器。
 */
function initializeObserver(containerIdOrSelector) {
  const rootNode =
    document.getElementById(containerIdOrSelector) ||
    document.querySelector(containerIdOrSelector);

  if (rootNode) {
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
      contentObserver.observe(el, {
        childList: true,
        subtree: true,
      });
    });
    return;
  }

  // 非视频页：回退观察整篇文档，避免漏掉动态插入的新卡片。
  contentObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}