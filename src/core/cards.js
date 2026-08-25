/*
 * 视频卡片核心模块
 * -----------------------------------------------------------
 * 负责：查找页面上的视频卡片节点、从单个卡片中提取轻量信息
 * （bvid / 标题 / UP 主名字）。
 *
 * 注意：不再把 el 存进数组 —— 卡片只需要在“处理当下”操作一次，
 * 之后靠 WeakSet 去重；卡片被移除后引用随 GC 释放，不会无限累积。
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
 * 从一张卡片节点中提取“轻量”信息，不持有 el 引用。
 * @param {HTMLElement} el  卡片节点
 * @returns {{bvid: string, title: string, up: string}}
 */
function extractCard(el) {
  return {
    bvid: getBvid(el),
    title: getTitle(el),
    up: getUpName(el)
  };
}
