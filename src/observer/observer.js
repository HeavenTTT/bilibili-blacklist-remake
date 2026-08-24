/*
 * 变动观察模块
 * -----------------------------------------------------------
 * 负责：初次扫描 + 监听页面新增卡片（SPA / 无限滚动），并按 bvid 去重，
 * 避免同一张卡片被重复处理。
 */
var SEEN_BVID = new Set();   // 已处理过的 bvid 集合
var RENDER_OBSERVER = null;  // MutationObserver 实例，方便调试时停止

/**
 * 扫描并打印新出现的视频卡片。
 * @returns {Array} 当前收集到的卡片信息数组
 */
function scan() {
  var list = collectCards();
  for (var i = 0; i < list.length; i++) printCard(list[i]);
  return list;
}

/**
 * 监听 body 变化，出现新节点时防抖 200ms 后重新扫描。
 */
function observeCards() {
  var debounce = null;
  RENDER_OBSERVER = new MutationObserver(function () {
    clearTimeout(debounce);
    debounce = setTimeout(scan, 200);
  });
  RENDER_OBSERVER.observe(document.body, { childList: true, subtree: true });
}
