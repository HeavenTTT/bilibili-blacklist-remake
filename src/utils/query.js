/*
 * 查询工具模块
 * -----------------------------------------------------------
 * 基于选择器数组做“按顺序尝试”的查询，用于简化取字段逻辑。
 */

/**
 * 返回 root 内按顺序第一个命中的节点。
 * @param {HTMLElement} root      查找范围
 * @param {string[]} selectors    候选选择器数组
 * @returns {HTMLElement|null}    命中节点；无命中返回 null
 */
function queryFirst(root, selectors) {
  for (var i = 0; i < selectors.length; i++) {
    var el = root.querySelector(selectors[i]);
    if (el) return el;
  }
  return null;
}

/**
 * 返回 root 内按顺序第一个命中节点的文本（去除首尾空白）。
 * @param {HTMLElement} root      查找范围
 * @param {string[]} selectors    候选选择器数组
 * @returns {string}              命中节点文本；无命中返回空字符串
 */
function queryFirstText(root, selectors) {
  var el = queryFirst(root, selectors);
  if (!el) return "";
  return (el.textContent || "").trim();
}
