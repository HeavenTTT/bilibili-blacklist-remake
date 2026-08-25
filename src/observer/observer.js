/*
 * 变动观察模块（增量处理）
 * -----------------------------------------------------------
 * 原则：不做“全量搜寻” —— 每张卡片只在插入时处理一次。
 *   - 初次启动仍会对页面“已存在”的卡片做一次扫描（无法避免）；
 *   - 之后只通过 MutationObserver 监听新增节点，对“新增卡片”即时校验 + 屏蔽。
 *
 * 去重：用 WeakSet 记录“已处理过的 DOM 节点”。节点被移除后会被浏览器回收，
 *       不会像全局数组那样无限累积，也不会强引用 el。
 */
var PROCESSED_CARDS = new WeakSet();  // 已处理过的卡片 DOM 节点（弱引用）
var RENDER_OBSERVER = null;           // MutationObserver 实例，方便调试时停止
var STATS = { processed: 0, blocked: 0 };

/**
 * 根据一个新增节点找到“它本身或它内部”的卡片节点。
 * @param {Element} node  新增的元素节点
 * @returns {HTMLElement[]}
 */
function collectCardEls(node) {
  var cardSel = SELECTORS.card.join(",");
  var out = [];
  // 1) 节点本身或向上能匹配到卡片
  var self = node.closest ? node.closest(cardSel) : null;
  if (self) {
    out.push(self);
    return out;
  }
  // 2) 节点是容器，内部可能包含多张卡片
  var inside = node.querySelectorAll ? node.querySelectorAll(cardSel) : [];
  for (var i = 0; i < inside.length; i++) out.push(inside[i]);
  return out;
}

/**
 * 处理单张卡片：提取 -> 校验 -> 屏蔽 -> 打印。
 * @param {HTMLElement} cardEl  卡片节点
 */
function handleCard(cardEl) {
  if (PROCESSED_CARDS.has(cardEl)) return;

  var card = extractCard(cardEl);
  if (!card.bvid) return;   // 信息未就绪，等子节点变更时再触发

  PROCESSED_CARDS.add(cardEl);
  STATS.processed++;

  if (validateCard(card)) {
    blockCard(card, cardEl);
    STATS.blocked++;
  }
  printCard(card);
}

/**
 * MutationObserver 回调：只处理“新增”的节点，不做全量扫描。
 * @param {MutationRecord[]} mutations
 */
function onMutations(mutations) {
  for (var i = 0; i < mutations.length; i++) {
    var added = mutations[i].addedNodes;
    for (var j = 0; j < added.length; j++) {
      var node = added[j];
      if (node.nodeType !== 1) continue;   // 只处理元素节点
      var els = collectCardEls(node);
      for (var k = 0; k < els.length; k++) handleCard(els[k]);
    }
  }
}

/**
 * 初次扫描页面“已存在”的卡片。
 * @returns {number} 已处理卡片数
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
