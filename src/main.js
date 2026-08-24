/*
 * 观察 B 站页面上的全部视频卡片，并提取每个卡片的：
 *   - title  视频标题
 *   - up     UP 主名字
 *   - bvid   视频 BV 号
 *
 * 流程：
 *   1. 等 DOM 就绪 + B 站初始数据就绪（见 build.config.json 的 @run-at document-idle 与下方就绪保护）
 *   2. 初次扫描页面已有卡片并打印
 *   3. 用 MutationObserver 监听新增卡片（B 站无限滚动 / SPA 加载），只对新出现的卡片打印
 */

var SEEN_BVID = new Set();   // 已打印过的 bvid，避免重复
var OBSERVER = null;         // 对外暴露，便于调试时停止

/* ---------- 就绪保护 ---------- */
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

/* ---------- 卡片查找（去嵌套） ---------- */
function getCardNodes() {
  var all = document.querySelectorAll(".bili-video-card, .video-card, .feed-card");
  var list = Array.prototype.slice.call(all);
  // 若外层容器包着另一个卡片节点，则跳过外层，只取最内层卡片，避免重复
  return list.filter(function (el) {
    return !list.some(function (other) {
      return other !== el && el.contains(other);
    });
  });
}

/* ---------- 提取单个字段 ---------- */
function getBvid(el) {
  var direct = el.getAttribute("data-bvid");
  if (direct) return direct;
  var a = el.querySelector("a[href*=\"/video/\"]");
  if (!a) return "";
  var href = a.getAttribute("href") || "";
  var m = href.match(/BV[0-9A-Za-z]{6,}/);
  return m ? m[0] : "";
}

function getTitle(el) {
  var t = el.querySelector(
    "a.bili-video-card__info--tit, .bili-video-card__info--tit, .title, [class*=\"tit\"]"
  );
  return t ? (t.textContent || "").trim() : "";
}

function getUpName(el) {
  var candidates = [
    ".bili-video-card__info--author-name",      // 新版纯昵称
    ".bili-video-card__info--author a",
    ".bili-video-card__info--author",
    ".up-name",
    ".name"
  ];
  for (var i = 0; i < candidates.length; i++) {
    var u = el.querySelector(candidates[i]);
    if (u) {
      var text = (u.textContent || "").trim();
      if (text) return text;
    }
  }
  return "";
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

/* ---------- 打印 ---------- */
function printCard(card) {
  if (SEEN_BVID.has(card.bvid)) return;
  SEEN_BVID.add(card.bvid);

  console.groupCollapsed("[HelloWorld] 视频卡片 - " + (card.title || "(无标题)"));
  console.log("title :", card.title);
  console.log("up    :", card.up);
  console.log("bvid  :", card.bvid);
  console.groupEnd();
}

/* ---------- 扫描 + 观察 ---------- */
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
    window.__helloCards = cards; // 暴露给控制台，便于直接查看数组
    console.log("[HelloWorld] 初次扫描共观察到 " + cards.length + " 个视频卡片");
    observeCards();
  });
});
