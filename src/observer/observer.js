/*
 * 观察器模块
 * -----------------------------------------------------------
 * 增量 MutationObserver：只处理新插入的卡片，避免全量重扫。
 */
// (未启用) 页面可见性暂停处理已被移除

// 增量观察：只处理“新插入”的卡片，不做全量重扫
const INCREMENTAL_CARD_SELECTOR = ".bili-video-card, .video-page-card-small, .feed-card";
const seenCards = new WeakSet();

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

  // 广告屏蔽（适度延迟合并，避免频繁）
  setTimeout(() => {
    if (isCurrentPageMain()) blockMainPageAds();
    if (isCurrentPageVideo()) blockVideoPageAds();
  }, globalPluginConfig.blockScanInterval);
});

/**
 * 在指定容器上初始化MutationObserver。
 * @param {string} containerIdOrSelector - 要观察的容器的ID或CSS选择器。
 */
function initializeObserver(containerIdOrSelector) {
  const rootNode =
    document.getElementById(containerIdOrSelector) ||
    document.querySelector(containerIdOrSelector) ||
    document.documentElement; // 默认观察整个文档

  contentObserver.observe(rootNode, {
    childList: true,
    subtree: true,
  });
}