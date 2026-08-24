/*
 * 视频卡片核心模块
 * -----------------------------------------------------------
 * 负责：查找页面上的视频卡片、提取 bvid / 标题 / UP 主名字，
 * 并返回包含卡片本体 el 的信息，便于后续改卡片、加按钮等。
 */

/**
 * 查找页面上的卡片节点（去嵌套，只保留最内层卡片）。
 * @returns {HTMLElement[]} 卡片节点数组
 */
function getCardNodes() {
  var all = document.querySelectorAll(SELECTORS.card.join(","));
  var list = Array.prototype.slice.call(all);
  // 若外层容器包着另一个卡片节点，则跳过外层，只取最内层卡片，避免重复
  return list.filter(function (el) {
    return !list.some(function (other) {
      return other !== el && el.contains(other);
    });
  });
}

/**
 * 从卡片中提取 bvid：优先取 data-bvid 属性，否则从链接里提取 BV 号。
 * @param {HTMLElement} el  卡片节点
 * @returns {string}        视频 BV 号；找不到返回空字符串
 */
function getBvid(el) {
  var attr = queryFirst(el, SELECTORS.bvidAttr.map(function (name) {
    return "[" + name + "]";
  }));
  if (attr) return (attr.getAttribute("data-bvid") || "").trim();

  var a = queryFirst(el, SELECTORS.bvidLink);
  if (!a) return "";
  var href = a.getAttribute("href") || "";
  var m = href.match(/BV[0-9A-Za-z]{6,}/);
  return m ? m[0] : "";
}

/**
 * 提取卡片标题。
 * @param {HTMLElement} el  卡片节点
 * @returns {string}        标题文本；找不到返回空字符串
 */
function getTitle(el) {
  var elTitle = queryFirst(el, SELECTORS.title);
  if (!elTitle) return "";
  // 首页 h3 用 title 属性；其它页面一般用文本
  return ((elTitle.getAttribute("title") || "") || elTitle.textContent || "").trim();
}

/**
 * 提取 UP 主名字。
 * @param {HTMLElement} el  卡片节点
 * @returns {string}        UP 主名字；找不到返回空字符串
 */
function getUpName(el) {
  return queryFirstText(el, SELECTORS.upName);
}

/**
 * 收集页面上全部视频卡片信息。
 * 返回数组每一项：{ title, up, bvid, el }，其中 el 为卡片 DOM 本体，
 * 方便后续直接改卡片、注入按钮等。
 * @returns {Array<{title: string, up: string, bvid: string, el: HTMLElement}>}
 */
function collectCards() {
  var cards = getCardNodes().map(function (el) {
    return {
      bvid: getBvid(el),
      title: getTitle(el),
      up: getUpName(el),
      el: el   // 卡片本体，供后续改卡片 / 添加按钮
    };
  });
  // 只保留真正的视频卡片：必须解析到 bvid
  return cards.filter(function (c) {
    return !!c.bvid;
  });
}
