/*
 * 观察 B 站页面上的全部视频卡片，并提取每个卡片的：
 *   - title  视频标题
 *   - up     UP 主名字
 *   - bvid   视频 BV 号
 *
 * 流程：
 *   1. 等 DOM 就绪 + B 站初始数据就绪
 *   2. 初次扫描页面已有卡片并打印
 *   3. 用 MutationObserver 监听新增卡片（SPA / 无限滚动），只对新卡片打印
 *
 * 说明：所有 CSS 选择器都集中放在下方 SELECTORS 数组里，改结构时只需改这里。
 */

/* ============ 选择器配置（改这里即可） ============ */
var SELECTORS = {
  // 卡片根：从内到外都可，代码会自动去嵌套，只保留最内层
  card: [
    ".bili-video-card",          // 首页 / 播放页通用卡片
    ".feed-card",                // 首页外层
    ".bili-feed-card",           // 首页中间层
    ".video-card",               // 旧版卡片
    ".floor-single-card",        // 分区/栏目卡片
    ".card-box"                  // 旧版包裹层
  ],

  // 视频标题（首页是 <h3 class="bili-video-card__info--tit" title="...">）
  title: [
    "h3.bili-video-card__info--tit",
    ".bili-video-card__info--tit",
    "a.bili-video-card__info--tit",
    ".title",
    "[class*=\"tit\"]"
  ],

  // UP 主名字
  upName: [
    ".bili-video-card__info--author-name",
    ".bili-video-card__info--author",                       // 首页：<span class="...author" title="XX">XX</span>
    "a.bili-video-card__info--owner span.bili-video-card__info--author",
    "a.bili-video-card__info--owner span",
    ".up-name",
    ".name"
  ],

  // bvid：优先内嵌属性，再取链接里的 BV 号
  bvidAttr: [
    "data-bvid"
  ],
  bvidLink: [
    "a.bili-video-card__image--link",
    "a[href*=\"/video/\"]"
  ]
};

/* ============ 通用查询工具（基于选择器数组） ============ */
function queryFirst(root, selectors) {
  for (var i = 0; i < selectors.length; i++) {
    var el = root.querySelector(selectors[i]);
    if (el) return el;
  }
  return null;
}

function queryFirstText(root, selectors) {
  var el = queryFirst(root, selectors);
  if (!el) return "";
  return (el.textContent || "").trim();
}

/* ============ 状态 ============ */
var SEEN_BVID = new Set();   // 已打印过的 bvid
var OBSERVER = null;

/* ============ 就绪保护 ============ */
function whenDomReady(callback) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  } else {
    callback();
  }
}

function whenBiliDataReady(callback, timeoutMs) {
  var startedAt = Date.now();
  var limit = timeoutMs || 3000;
  var check = function () {
    if (window.__INITIAL_STATE__) {
      callback();
      return;
    }
    if (Date.now() - startedAt > limit) {
      callback();
      return;
    }
    setTimeout(check, 100);
  };
  check();
}

/* ============ 卡片查找（去嵌套） ============ */
function getCardNodes() {
  var all = document.querySelectorAll(SELECTORS.card.join(","));
  var list = Array.prototype.slice.call(all);
  // 若外层容器包着另一个卡片节点，则跳过外层，只取最内层卡片
  return list.filter(function (el) {
    return !list.some(function (other) {
      return other !== el && el.contains(other);
    });
  });
}

/* ============ 提取单个字段 ============ */
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

function getTitle(el) {
  var elTitle = queryFirst(el, SELECTORS.title);
  if (!elTitle) return "";
  // 首页 h3 用 title 属性，其他页面一般用文本
  return ((elTitle.getAttribute("title") || "") || elTitle.textContent || "").trim();
}

function getUpName(el) {
  return queryFirstText(el, SELECTORS.upName);
}

function collectCards() {
  var cards = getCardNodes().map(function (el) {
    return {
      bvid: getBvid(el),
      title: getTitle(el),
      up: getUpName(el)
    };
  });
  // 只保留真正的视频卡片：必须解析到 bvid
  return cards.filter(function (c) {
    return !!c.bvid;
  });
}

/* ============ 打印 ============ */
function printCard(card) {
  if (SEEN_BVID.has(card.bvid)) return;
  SEEN_BVID.add(card.bvid);

  console.groupCollapsed("[HelloWorld] 视频卡片 - " + (card.title || "(无标题)"));
  console.log("title :", card.title);
  console.log("up    :", card.up);
  console.log("bvid  :", card.bvid);
  console.groupEnd();
}

/* ============ 扫描 + 观察 ============ */
function scan() {
  var list = collectCards();
  for (var i = 0; i < list.length; i++) printCard(list[i]);
  return list;
}

function observeCards() {
  var debounce = null;
  OBSERVER = new MutationObserver(function () {
    clearTimeout(debounce);
    debounce = setTimeout(scan, 200);
  });
  OBSERVER.observe(document.body, { childList: true, subtree: true });
}

whenDomReady(function () {
  whenBiliDataReady(function () {
    var cards = scan();
    window.__helloCards = cards;
    console.log("[HelloWorld] 初次扫描共观察到 " + cards.length + " 个视频卡片");
    observeCards();
  });
});
