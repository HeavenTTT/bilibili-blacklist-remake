/*
 * 核心模块
 * -----------------------------------------------------------
 * 卡片查找 / 屏蔽 / 黑名单增删 / 主页布局修正。
 */
let tempUnblockButton;
let managerPanel;
let exactMatchListElement;
let regexMatchListElement;
let tagNameListElement;
let configListElement;
let blockCountTitleElement;
let blockCountDisplayElement = null;

// 内部状态变量
let isShowAllVideos = false; // 是否显示全部视频卡片
let isBlockingOperationInProgress = false; // 是否正在执行BlockCard扫描操作
let lastBlockScanExecutionTime = 0; // 上次执行BlockCard扫描的时间戳
let blockedVideoCards = new Set(); // 存储已屏蔽的视频卡片元素
let processedVideoCards = new WeakSet(); // 记录已处理过的卡片(避免重复处理，包括 UP主/标题检查和 tname 获取)
let videoCardProcessQueue = new Set(); // 存储待处理的卡片，用于统一的队列处理
let isVideoCardQueueProcessing = false; // 是否正在处理队列
let countBlockInfo = 0; // 已屏蔽视频计数
let countBlockAD = 0; // 已屏蔽广告计数
let countBlockTName = 0; // 已屏蔽标签名计数
let countBlockVertical = 0; // 已屏蔽竖屏计数
let countBlockCM = 0; // 已屏蔽cm.bilibili.com软广计数

// “未处理”卡片：进入视频页时先用 CSS filter 遮盖（不插按钮/kirby 遮罩子元素），
// 避免与 B 站 header 渲染竞争。该 WeakSet 记录已加 filter 的卡片，判定完成后清除。
const pendingFilterCards = new WeakSet();

// “未处理”遮盖使用的 filter 参数（单一真源）。
// 卡片走 JS 逐元素设置 style.filter；播放页广告走 ads.js 里的同参数 CSS 规则，
// 两边视觉完全一致，调整时只需改这一处。
const PENDING_FILTER_STYLE = "blur(8px) grayscale(0.5) opacity(0.4)";

// 用于不同页面UP主名称选择器
// 注意：把具体/作者专用的选择器排在前面，`.name` 这类宽泛选择器放最后作兜底，
// 避免在视频播放页等结构里优先匹配到“游戏名/标签/评论者”等非 UP 名的 `.name`。
const UP_NAME_SELECTORS = [
  ".bili-video-card__info--author", // 主页
  ".bili-video-card__author", // 分类页面 -> span title
  ".upname a span", // 视频播放页“接下来播放/相关推荐”卡片（新版结构）
  ".upname a",
  ".upname",
  ".name", // 视频播放页旧版结构（兜底，放最后）
];
// 作者链接兜底：视频卡片里指向用户空间的链接通常承载 UP 名
const UP_NAME_SPACE_LINK_SELECTOR = 'a[href*="space.bilibili.com"]';

// 用于不同页面视频标题选择器
const VIDEO_TITLE_SELECTORS = [
  ".bili-video-card__info--tit", // 主页
  ".bili-video-card__title", // 分类页面 -> span title
  ".title", // 视频播放页
  ".video-title", // 视频播放页新版标题类
];
// 标题兜底：卡片内指向 /video/ 的链接文本
const VIDEO_TITLE_LINK_SELECTOR = 'a[href*="/video/"]';

// 屏蔽类型对应的原因文案
const BLOCK_REASON_MAP = {
  info: "标题/UP主名",
  ad: "广告",
  tname: "分类标签",
  cm: "软广",
  vertical: "竖屏视频",
};

/**
 * 获取视频卡片上容器应挂载的宿主元素，并确保宿主可被绝对定位。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 * @returns {HTMLElement} 容器宿主元素。
 */
function getBlockContainerHost(cardElement) {
  // 视频播放页面的视频卡片结构特殊，需要调整位置
  if (isCurrentPageVideo()) {
    const cardBox = cardElement.querySelector(".card-box");
    if (cardBox) {
      cardBox.style.position = "relative";
      cardBox.classList.add("bilibili-blacklist-block-container-host");
      return cardBox;
    }
  } else if (isCurrentPageCategory()) {
    // 分类页面的视频卡片结构特殊，需要调整位置
    const biliVideoCard = cardElement.querySelector(".bili-video-card");
    if (biliVideoCard) {
      biliVideoCard.classList.add("bilibili-blacklist-block-container-host");
      return biliVideoCard;
    }
  }
  // 默认宿主：确保可被绝对定位的子元素正常显示
  const hostStyle = getComputedStyle(cardElement);
  if (hostStyle.position === "static" || !hostStyle.position) {
    cardElement.style.position = "relative";
  }
  cardElement.classList.add("bilibili-blacklist-block-container-host");
  return cardElement;
}

/**
 * 确保视频卡片上存在屏蔽容器，不存在则创建（用于广告等未走扫描流程的卡片）。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 * @returns {HTMLElement} 已存在的或新创建的容器元素。
 */
function ensureBlockContainerOnCard(cardElement) {
  const existing = cardElement.querySelector(
    ".bilibili-blacklist-block-container"
  );
  if (existing) return existing;
  const container = document.createElement("div");
  container.classList.add("bilibili-blacklist-block-container");
  const host = getBlockContainerHost(cardElement);
  host.appendChild(container);
  return container;
}

/**
 * 为视频卡片添加屏蔽按钮容器。
 * @param {string} upName - UP主名称。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 * @returns {HTMLElement} 创建的容器元素。
 */
function addBlockContainerToCard(upName, cardElement) {
  const container = ensureBlockContainerOnCard(cardElement);
  if (!container.querySelector(".bilibili-blacklist-block-btn")) {
    const blockButton = createBlockUpButton(upName, cardElement);
    container.appendChild(blockButton);
  }
  return container;
}

/**
 * 给一张卡片应用“未处理”filter 遮盖（模糊 2px + 灰度 20%）。
 * 只修改卡片元素的 style.filter，不插入任何按钮/遮罩子元素 —— 避免与 B 站 header
 * 的 Vue 渲染竞争。记录到 pendingFilterCards（WeakSet），判定完成后由 clearPendingFilter 清除。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 */
function applyPendingFilter(cardElement) {
  if (!cardElement) return;
  const real = getRealVideoCardElement(cardElement);
  if (!real) return;
  if (pendingFilterCards.has(real)) return; // 已遮盖，避免重复
  pendingFilterCards.add(real);
  real.style.filter = PENDING_FILTER_STYLE;
}

/**
 * 清除一张卡片的“未处理”filter 遮盖，恢复原样。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 */
function clearPendingFilter(cardElement) {
  if (!cardElement) return;
  const real = getRealVideoCardElement(cardElement);
  if (!real) return;
  pendingFilterCards.delete(real);
  real.style.filter = "";
}

/**
 * 把当前页面已渲染的所有视频卡片标记为“未处理”（应用 filter 遮盖）。
 * 用于视频页进入时：立即遮住推荐卡片，但不启动观察器/不判定，规避 header 渲染竞争。
 */
function markAllVideoCardsPending() {
  const cards = queryAllVideoCards();
  if (!cards) return;
  cards.forEach((card) => applyPendingFilter(card));
}

/**
 * 隐藏给定的视频卡片。
 * @param {HTMLElement} cardElement - 要隐藏的视频卡片元素。
 * @param {string} type - 隐藏类型，默认为"none"。
 * @returns {void}
 *
 */
/**
 * 计算某屏蔽类型最终使用的显示模式（支持按类型覆盖全局）。
 * @param {string} type - 屏蔽类型：info/ad/tname/cm/vertical
 * @returns {string} blur | kirby | hide
 */
function getEffectiveDisplayMode(type) {
  const perTypeMap = {
    info: globalPluginConfig.displayModeInfo,
    ad: globalPluginConfig.displayModeAD,
    tname: globalPluginConfig.displayModeTName,
    cm: globalPluginConfig.displayModeCM,
    vertical: globalPluginConfig.displayModeVertical,
  };
  const per = perTypeMap[type];
  if (per && per !== "inherit") return per;
  return globalPluginConfig.blockDisplayMode;
}

function hideVideoCard(cardElement, type = "none") {
  const realCardToBlock = getRealVideoCardElement(cardElement);
  if (!realCardToBlock) {
    console.warn(
      "[bililili-blacklist] hideVideoCard: realCardToBlock is null"
    );
    return;
  }
  if (blockedVideoCards.has(realCardToBlock)) {
    return;
  }
  blockedVideoCards.add(realCardToBlock);
  if (type === "info") {
    countBlockInfo++;
  }
  if (type === "ad") {
    countBlockAD++;
  }
  if (type === "tname") {
    countBlockTName++;
  }
  if (type === "cm") {
    countBlockCM++;
  }
  if (type === "vertical") {
    countBlockVertical++;
  }

  const mode = getEffectiveDisplayMode(type);
  if (mode === "hide") {
    realCardToBlock.style.display = "none";
    realCardToBlock.style.visibility = "";
  } else {
    realCardToBlock.style.display = "block";
    realCardToBlock.style.visibility = "visible"; // 立即隐藏阶段用的是 visibility，需恢复显示遮罩
    addDisplayOverlayToCard(cardElement, mode);
  }

  setBlockReasonOnCard(cardElement, type);
}

/**
 * 在卡片的屏蔽按钮容器中设置屏蔽原因。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 * @param {string} type - 屏蔽类型。
 */
function setBlockReasonOnCard(cardElement, type) {
  const reasonText = BLOCK_REASON_MAP[type];
  if (!reasonText) return;
  // 广告等卡片未经过 scanAndBlockVideoCards 流程，可能不存在容器，需确保创建。
  // 播放页广告位的 DOM 结构与视频卡片完全不同（没有 .card-box，且常依赖自身定位/浮动布局），
  // 走 ads.js 里独立的 ensureAdBlockContainer()，避免 getBlockContainerHost 的卡片专用分支。
  const isVideoPageAd =
    type === "ad" &&
    isCurrentPageVideo() &&
    typeof ensureAdBlockContainer === "function";
  const container = isVideoPageAd
    ? ensureAdBlockContainer(cardElement)
    : ensureBlockContainerOnCard(cardElement);
  if (!container) return;
  let reasonElement = container.querySelector(
    ".bilibili-blacklist-block-reason"
  );
  if (!reasonElement) {
    reasonElement = document.createElement("span");
    reasonElement.className = "bilibili-blacklist-block-reason";
    // 位于"屏蔽"按钮之后、标签组之前
    const tnameGroup = container.querySelector(
      ".bilibili-blacklist-tname-group"
    );
    if (tnameGroup) {
      container.insertBefore(reasonElement, tnameGroup);
    } else {
      container.appendChild(reasonElement);
    }
  }
  reasonElement.textContent = `屏蔽原因: ${reasonText}`;
}

/**
 * 移除卡片上的屏蔽原因显示。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 */
function removeBlockReason(cardElement) {
  const container = cardElement.querySelector(
    ".bilibili-blacklist-block-container"
  );
  if (!container) return;
  const reasonElement = container.querySelector(
    ".bilibili-blacklist-block-reason"
  );
  if (reasonElement) {
    reasonElement.remove();
  }
}

/**
 * 获取应该被屏蔽的卡片的真正父元素。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 * @returns {HTMLElement} 应用显示更改的实际元素。
 */
function getRealVideoCardElement(cardElement) {
  // 搜索页面的视频卡片父元素是上一级
  if (isCurrentPageSearch()) {
    return cardElement.parentElement;
  }
  // 主页视频卡片可能有多层父元素
  if (isCurrentPageMain()) {
    if (cardElement.parentElement.classList.contains("bili-feed-card")) {
      cardElement = cardElement.parentElement;
      if (cardElement.parentElement.classList.contains("feed-card")) {
        cardElement = cardElement.parentElement;
      }
    }
  }
  return cardElement;
}

/**
 * 根据当前页面选择所有视频卡片。
 * @returns {NodeListOf<HTMLElement> | null} 视频卡片元素的NodeList，如果不是识别的页面则返回null。
 */
function queryAllVideoCards() {
  if (isCurrentPageMain()) {
    return document.querySelectorAll(".bili-video-card");
  } else if (isCurrentPageVideo()) {
    return document.querySelectorAll(".video-page-card-small");
  } else if (isCurrentPageCategory()) {
    return document.querySelectorAll(".feed-card");
  } else if (isCurrentPageSearch()) {
    return document.querySelectorAll(".bili-video-card");
  } else if (isCurrentPageRanking()) {
    return document.querySelectorAll(
      ".bili-video-card, .rank-item, .video-card, .rank-card"
    );
  }
  return null;
}

/**
 * 扫描并处理视频卡片进行屏蔽。
 */
  /**
 * 处理单张卡片：加「屏蔽」按钮、立即隐藏/遮挡、压入队列（后续走 API 判断）。
 * @param {HTMLElement} card - 视频卡片元素。
 */
function processCard(card) {
  // 如果卡片已经处理过，则跳过
  if (processedVideoCards.has(card)) {
    return;
  }
  const realCard = getRealVideoCardElement(card);

  // --- 未处理阶段：先用 CSS filter 遮盖（模糊2px+灰度20%）---
  // 不往卡片插入按钮/kirby 遮罩子元素、不改 visibility，避免与 B 站 header 的 Vue 渲染竞争
  // 卡片先处于“未处理”状态，待队列判定后再提交：
  //   命中 → hideVideoCard（正式遮蔽）+ clearPendingFilter；未命中 → clearPendingFilter（去 filter 恢复）。
  if (globalPluginConfig.flagHideOnLoad && !isShowAllVideos && realCard) {
    applyPendingFilter(card);
  }

  const { upName, videoTitle } = getVideoCardInfo(card);
  // 只要解析到 UP 主名称就添加“屏蔽”按钮（按钮按 UP 名屏蔽，不需要标题；
  // 有些卡片标题解析失败但仍可通过 UP 名手动屏蔽，避免“按钮缺失导致无法屏蔽”）。
  // 视频页 header 正常后才由 scanAndBlockVideoCards 触发，此时插入按钮不再干扰 header。
  if (upName && realCard) {
    addBlockContainerToCard(upName, card);
  }

  // 将卡片添加到处理队列
  videoCardProcessQueue.add(card);
}

function scanAndBlockVideoCards() {
  const now = Date.now();
  // 限制扫描频率，防止性能问题
  if (
    isBlockingOperationInProgress ||
    now - lastBlockScanExecutionTime < globalPluginConfig.blockScanInterval
  ) {
    return;
  }

  isBlockingOperationInProgress = true;
  lastBlockScanExecutionTime = now;

  try {
    const videoCards = queryAllVideoCards();
    if (!videoCards) return;

    videoCards.forEach(processCard);

    // 如果队列中有待处理的卡片且当前未在处理中，则开始处理队列
    if (videoCardProcessQueue.size > 0 && !isVideoCardQueueProcessing) {
      processVideoCardQueue();
    }

    // 刷新屏蔽计数显示
    refreshBlockCountDisplay();
    // 修正主页布局
    fixMainPageLayout();
  } finally {
    isBlockingOperationInProgress = false;
  }
}

/**
 * 修正主页在屏蔽后的布局。
 */
function fixMainPageLayout() {
  if (!isCurrentPageMain()) return;
  const container = document.querySelector(
    ".recommended-container_floor-aside .container"
  );
  if (container) {
    const children = container.children;
    let visibleIndex = 0;
    // 屏蔽后把可见卡片的垂直间距规整为 B 站默认（首行顶部 0、第二行 24px），
    // 避免隐藏卡片后剩余卡片的 top 不对齐（旧版修复；当前主页该容器仍存在）。
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (
        child.style.display !== "none" &&
        child.style.visibility !== "hidden"
      ) {
        if (visibleIndex <= 6) {
          child.style.marginTop = "0px";
        } else if (visibleIndex < 12) {
          child.style.marginTop = "24px";
        } else {
          break;
        }
        visibleIndex++;
      }
    }
  }
}

/**
 * 切换所有被屏蔽视频卡片的显示。
 */
function toggleShowAllBlockedVideos() {
  isShowAllVideos = !isShowAllVideos;
  blockedVideoCards.forEach((card) => {
    const overlay = card.querySelector("#bilibili-blacklist-kirby");
    if (overlay) {
      if (isShowAllVideos) {
        overlay.style.display = "none";
      } else {
        fadeInKirbyOverlay(overlay);
      }
      card.style.display = "block";
      card.style.visibility = "visible";
    } else {
      card.style.display = isShowAllVideos ? "block" : "none";
      card.style.visibility = isShowAllVideos ? "visible" : "";
    }
  });
  tempUnblockButton.textContent = isShowAllVideos ? "恢复屏蔽" : "取消屏蔽";
  tempUnblockButton.style.background = isShowAllVideos
    ? "#dddddd"
    : "#fb7299";
}

/**
 * 从视频卡片中检索UP主名称和视频标题。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 * @returns {{upName: string, videoTitle: string}} 包含UP主名称和视频标题的对象。
 */
function getVideoCardInfo(cardElement) {
  let upName = "";
  let videoTitle = "";

  // UP主名称：优先具体作者选择器；未取到再用“指向用户空间的链接”兜底
  const upNameElements = cardElement.querySelectorAll(
    UP_NAME_SELECTORS.join(", ")
  );
  if (upNameElements.length > 0) {
    upName = upNameElements[0].textContent.trim();
  }
  if (!upName) {
    const spaceLinks = cardElement.querySelectorAll(UP_NAME_SPACE_LINK_SELECTOR);
    for (const a of spaceLinks) {
      const t = (a.textContent || "").trim();
      if (t) {
        upName = t;
        break;
      }
    }
  }
  if (isCurrentPageCategory()) {
    // 分类页面的UP主名称可能包含其他信息，需要进一步处理
    upName = upName.split(" · ")[0].trim();
  }
  // 去掉误带进来的“ · 时间/日期”后缀（如 “ · 08-23”、“ · 昨天”），
  // 保证精确匹配与“屏蔽按 UP 名”用的是干净的 UP 名。
  upName = upName.replace(/\s*·\s*(刚刚|\d{1,2}[-/]\d{1,2}(-\d{2,4})?|昨天|前天|今天|\d+小时前|\d+天前|\d+分钟前|\d+-\d+-\d+.*)$/i, "").trim();

  // 视频标题：优先标题选择器；未取到再用“指向 /video/ 的链接文本”兜底
  const titleElements = cardElement.querySelectorAll(
    VIDEO_TITLE_SELECTORS.join(", ")
  );
  if (titleElements.length > 0) {
    videoTitle = titleElements[0].textContent.trim();
  }
  if (!videoTitle) {
    const videoLinks = cardElement.querySelectorAll(VIDEO_TITLE_LINK_SELECTOR);
    for (const a of videoLinks) {
      const t = (a.textContent || "").trim();
      if (t) {
        videoTitle = t;
        break;
      }
    }
  }
  return { upName, videoTitle };
}

/**
 * 检查UP主名称或标题是否在黑名单中。
 * @param {string} upName - 要检查的UP主名称。
 * @param {string} title - 要检查的视频标题。
 * @returns {boolean} 如果在黑名单中则返回true，否则返回false。
 */
function isBlacklisted(upName, title) {
  upName = upName || "";
  title = title || "";
  const lowerCaseUpName = upName.toLowerCase();
  // 检查精确匹配黑名单
  if (
    exactMatchBlacklist.some((item) => item.toLowerCase() === lowerCaseUpName)
  ) {
    return true;
  }

  // 检查正则匹配黑名单（支持 /pattern/flags，默认 i；无效正则自动跳过）
  for (let i = 0; i < regexMatchBlacklist.length; i++) {
    const re = compileRegex(regexMatchBlacklist[i]);
    if (!re) continue;
    if (testRegex(re, upName) || testRegex(re, title)) return true;
  }
  return false;
}

/**
 * 用编译后的正则测试文本；先重置 lastIndex，避免 g/y 状态残留。
 * @param {RegExp} re
 * @param {string} text
 * @returns {boolean}
 */
function testRegex(re, text) {
  re.lastIndex = 0;
  return re.test(text);
}

/**
 * 将UP主名称添加到精确匹配黑名单并刷新。
 * @param {string} upName - 要添加的UP主名称。
 * @param {HTMLElement} [cardElement=null] - 添加后要隐藏的视频卡片元素。
 */
function addToExactBlacklist(upName, cardElement = null) {
  try {
    if (!upName) return;
    if (!exactMatchBlacklist.includes(upName)) {
      exactMatchBlacklist.push(upName);
      saveBlacklistsToStorage();
      refreshAllPanelTabs();
      if (cardElement) {
        hideVideoCard(cardElement, "info");
      }
      hideAllCardsByUpName(upName);
    }
  } catch (e) {
    console.error("[🫥BlackList] 添加黑名单出错:", e);
  }
}

/**
 * 从精确匹配黑名单中移除UP主名称。
 * @param {string} upName - 要移除的UP主名称。
 */
function removeFromExactBlacklist(upName) {
  try {
    if (exactMatchBlacklist.includes(upName)) {
      const index = exactMatchBlacklist.indexOf(upName);
      exactMatchBlacklist.splice(index, 1);
      saveBlacklistsToStorage();
      refreshExactMatchList();
    }
  } catch (e) {
    console.error("[🫥BlackList] 移除黑名单出错:", e);
  }
}

/**
 * 将标签名添加到黑名单并刷新。
 * @param {string} tagName - 要添加的标签名。
 * @param {HTMLElement} [cardElement=null] - 添加后要隐藏的视频卡片元素。
 */
function addToTagNameBlacklist(tagName, cardElement = null) {
  try {
    if (!tagName) {
      return;
    }
    if (!tagNameBlacklist.includes(tagName)) {
      tagNameBlacklist.push(tagName);
      saveBlacklistsToStorage();
      refreshAllPanelTabs();
      if (cardElement) {
        hideVideoCard(cardElement, "tname");
      }
      hideAllCardsByTagName(tagName);
    }
  } catch (e) {
    console.error("[🫥BlackList] 添加标签黑名单出错:", e);
  }
}

/**
 * 从黑名单中移除标签名。
 * @param {string} tagName - 要移除的标签名。
 */
function removeFromTagNameBlacklist(tagName) {
  try {
    if (tagNameBlacklist.includes(tagName)) {
      const index = tagNameBlacklist.indexOf(tagName);
      tagNameBlacklist.splice(index, 1);
      saveBlacklistsToStorage();
      refreshTagNameList();
    }
  } catch (e) {
    console.error("[🫥BlackList] 移除标签黑名单出错:", e);
  }
}

/**
 * 隐藏所有匹配指定UP主名称的视频卡片。
 * @param {string} upName - 要匹配的UP主名称。
 */
function hideAllCardsByUpName(upName) {
  const videoCards = queryAllVideoCards();
  if (!videoCards) return;
  videoCards.forEach(card => {
    const { upName: cardUpName, videoTitle } = getVideoCardInfo(card);
    if (cardUpName && isBlacklisted(cardUpName, videoTitle)) {
      hideVideoCard(card, "info");
    }
  });
}

/**
 * 隐藏所有匹配指定标签名的视频卡片。
 * @param {string} tagName - 要匹配的标签名。
 */
function hideAllCardsByTagName(tagName) {
  const videoCards = queryAllVideoCards();
  if (!videoCards) return;
  videoCards.forEach(card => {
    if (isCardBlacklistedByTagName(card)) {
      hideVideoCard(card, "tname");
    }
  });
}