/*
 * 变动观察模块（增量处理）
 * -----------------------------------------------------------
 * 只在“新卡片插入”时即时处理：提取 -> 加屏蔽按钮 -> 校验 -> 屏蔽。
 * 用 WeakSet 记录已处理节点，节点移除后随 GC 释放，不累积 el。
 */
var PROCESSED_CARDS = new WeakSet();
var RENDER_OBSERVER = null;
var STATS = { processed: 0, blocked: 0 };

/**
 * 根据新增节点找到“它本身或内部”的卡片节点。
 * @param {Element} node
 * @returns {HTMLElement[]}
 */
function collectCardEls(node) {
  var cardSel = SELECTORS.card.join(",");
  var out = [];
  var self = node.closest ? node.closest(cardSel) : null;
  if (self) { out.push(self); return out; }
  var inside = node.querySelectorAll ? node.querySelectorAll(cardSel) : [];
  for (var i = 0; i < inside.length; i++) out.push(inside[i]);
  return out;
}

/**
 * 处理单张卡片：加“屏蔽”按钮；若命中黑名单则屏蔽并计数。
 * @param {HTMLElement} cardEl  卡片节点
 */
function handleCard(cardEl) {
  if (PROCESSED_CARDS.has(cardEl)) return;

  var card = extractCard(cardEl);
  if (!card.bvid) return;   // 信息未就绪，等子节点变更时再触发

  PROCESSED_CARDS.add(cardEl);
  STATS.processed++;

  // 通用“屏蔽”按钮（悬停显示）
  addBlockButton(card, cardEl);

  // 黑名单校验 + 屏蔽
  if (validateCard(card)) {
    blockCard(card, cardEl);
    STATS.blocked++;
  }
  printCard(card);
}

/**
 * MutationObserver 回调：只处理“新增”节点，不做全量扫描。
 * @param {MutationRecord[]} mutations
 */
function onMutations(mutations) {
  for (var i = 0; i < mutations.length; i++) {
    var added = mutations[i].addedNodes;
    for (var j = 0; j < added.length; j++) {
      var node = added[j];
      if (node.nodeType !== 1) continue;
      var els = collectCardEls(node);
      for (var k = 0; k < els.length; k++) handleCard(els[k]);
    }
  }
}

/**
 * 初次扫描页面“已存在”的卡片。
 * @returns {number}
 */
function scanInitial() {
  var nodes = getCardNodes();
  for (var i = 0; i < nodes.length; i++) handleCard(nodes[i]);
  return STATS.processed;
}

/**
 * 开启增量监听：监听 body 的 childList 变化。
 */
function observeCards() {
  RENDER_OBSERVER = new MutationObserver(onMutations);
  RENDER_OBSERVER.observe(document.body, { childList: true, subtree: true });
}
