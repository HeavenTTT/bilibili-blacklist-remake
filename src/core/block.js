/*
 * 校验与屏蔽模块
 * -----------------------------------------------------------
 * 核心职责（参考旧版 Bilibili-BlackList）：
 *   - 命中黑名单后，按 globalConfig.flagKirby 选择“覆盖模糊层”或“直接隐藏”；
 *   - 给每张卡片加一个“屏蔽”按钮（悬停显示），点击可加入精确黑名单；
 *   - 记录已屏蔽卡片，支持“临时取消屏蔽 / 恢复屏蔽”。
 */
var BLOCK_CONFIG = {
  mode: "cover",       // cover=覆盖模糊层 | hide=直接隐藏（保留给未来切换）
  addControls: true,   // 是否在卡片上添加「屏蔽」按钮
  reason: ""
};
var blockedVideoCards = new Set();   // 已屏蔽的卡片（用于显示全部 / 恢复）
var blockCountInfo = 0;              // 已屏蔽计数
var isShowAllVideos = false;         // 是否临时显示全部被屏蔽卡片

/**
 * 校验一张卡片是否需要屏蔽。
 * @param {{bvid: string, title: string, up: string}} card
 * @returns {boolean}
 */
function validateCard(card) {
  return isBlacklisted(card.up, card.title, card.bvid);
}

/**
 * 屏蔽一张卡片：加覆盖层或隐藏，并记录计数。
 * @param {{bvid: string, title: string, up: string}} card
 * @param {HTMLElement} el   卡片节点（内层）
 */
function blockCard(card, el) {
  var realCard = getRealCardElement(el);
  if (blockedVideoCards.has(realCard)) return;
  blockedVideoCards.add(realCard);
  blockCountInfo++;
  updateBlockCount();

  if (globalConfig.flagKirby) {
    applyCover(card, realCard);
  } else {
    applyHide(card, realCard);
  }
  setBlockReasonOnCard(card, realCard);
}

/**
 * 得到真正应被隐藏 / 遮挡的卡片节点。
 * 主页结构：bili-video-card -> bili-feed-card -> feed-card。
 * @param {HTMLElement} el
 * @returns {HTMLElement}
 */
function getRealCardElement(el) {
  if (el.classList.contains("bili-video-card")) {
    var p = el.parentElement;
    if (p && p.classList.contains("bili-feed-card")) {
      var gp = p.parentElement;
      if (gp && gp.classList.contains("feed-card")) return gp;
    }
  }
  return el;
}

/**
 * 覆盖模式：在卡片上铺一层带模糊的遮挡层。
 * @param {{bvid: string, title: string, up: string}} card
 * @param {HTMLElement} el
 */
function applyCover(card, el) {
  addKirbyOverlayToCard(card, el);
}

/**
 * 隐藏模式：直接隐藏卡片。
 * @param {{bvid: string, title: string, up: string}} card
 * @param {HTMLElement} el
 */
function applyHide(card, el) {
  el.style.display = "none";
}

/**
 * 在遮挡层上标注屏蔽原因。
 * @param {{bvid: string, title: string, up: string}} card
 * @param {HTMLElement} el
 */
function setBlockReasonOnCard(card, el) {
  var overlay = el.querySelector("#bilibili-blacklist-kirby");
  if (!overlay) return;
  var reason = overlay.querySelector(".bilibili-blacklist-reason");
  if (!reason) {
    reason = document.createElement("div");
    reason.className = "bilibili-blacklist-reason";
    overlay.appendChild(reason);
  }
  reason.textContent = "已屏蔽（标题/UP主名）";
}

/**
 * 给卡片添加一个“屏蔽”按钮（悬停显示），点击加入精确黑名单并屏蔽。
 * @param {{bvid: string, title: string, up: string}} card
 * @param {HTMLElement} el   卡片节点（内层）
 */
function addBlockButton(card, el) {
  if (!card.up) return;
  if (el.querySelector(".bilibili-blacklist-block-btn")) return;

  var host = getBlockContainerHost(el);
  var container = host.querySelector(".bilibili-blacklist-block-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "bilibili-blacklist-block-container";
    host.appendChild(container);
  }

  var btn = document.createElement("div");
  btn.className = "bilibili-blacklist-block-btn";
  btn.textContent = "屏蔽";
  btn.title = "屏蔽: " + card.up;
  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    addExactBlacklistItem(card.up);
    blockCard(card, el);
  });
  container.appendChild(btn);
}

/**
 * 确保卡片可作为容器宿主（可被绝对定位）。
 * @param {HTMLElement} el
 * @returns {HTMLElement}
 */
function getBlockContainerHost(el) {
  var host = el;
  var st = getComputedStyle(host);
  if (st.position === "static" || !st.position) host.style.position = "relative";
  return host;
}

/**
 * 给卡片添加遮挡层（参考旧版卡比遮挡）。
 * @param {{bvid: string, title: string, up: string}} card
 * @param {HTMLElement} el
 */
function addKirbyOverlayToCard(card, el) {
  if (el.querySelector("#bilibili-blacklist-kirby")) return;
  var wrapper = document.createElement("div");
  wrapper.innerHTML = getKirbySVG();
  wrapper.id = "bilibili-blacklist-kirby";

  var st = getComputedStyle(el);
  if (st.position === "static" || !st.position) el.style.position = "relative";
  el.appendChild(wrapper);
}

/**
 * 临时显示全部 / 恢复屏蔽所有卡片。
 */
function toggleShowAllBlockedVideos() {
  isShowAllVideos = !isShowAllVideos;
  blockedVideoCards.forEach(function (card) {
    var overlay = card.querySelector("#bilibili-blacklist-kirby");
    if (overlay) {
      overlay.style.display = isShowAllVideos ? "none" : "flex";
      card.style.display = ""; // 覆盖模式下卡片本身保持显示
    } else {
      card.style.display = isShowAllVideos ? "" : "none"; // 隐藏模式下切换显示
    }
  });
  if (tempUnblockButton) {
    tempUnblockButton.textContent = isShowAllVideos ? "恢复屏蔽" : "取消屏蔽";
    tempUnblockButton.style.background = isShowAllVideos ? "#dddddd" : "#fb7299";
  }
}

/**
 * 重新扫描并屏蔽所有匹配的卡片（添加黑名单后调用）。
 */
function blockAllMatchingCards() {
  var nodes = getCardNodes();
  for (var i = 0; i < nodes.length; i++) {
    var card = extractCard(nodes[i]);
    if (card.bvid && validateCard(card)) {
      blockCard(card, nodes[i]);
    }
  }
}