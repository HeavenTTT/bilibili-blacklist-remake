/*
 * 校验与屏蔽模块（占位）
 * -----------------------------------------------------------
 * 面向“黑名单”场景预留接口：
 *   - validateCard(card)：根据规则校验一张卡片是否需要屏蔽
 *   - blockCard(card, el)：对需要屏蔽的卡片执行具体操作（隐藏 / 移除 / 打标记）
 *
 * 当前均为空实现（TODO），后续再接入真正的黑名单匹配与屏蔽逻辑。
 */

/**
 * 校验一张卡片是否符合屏蔽条件。
 * @param {{bvid: string, title: string, up: string}} card  卡片轻量信息
 * @returns {boolean}  true=需要屏蔽；false=放行（当前默认放行）
 */
function validateCard(card) {
  // TODO: 接入黑名单匹配（精确 / 正则匹配 UP 名、标题、bvid）
  return false;
}

/**
 * 屏蔽一张卡片。
 * @param {{bvid: string, title: string, up: string}} card  卡片轻量信息
 * @param {HTMLElement} el   卡片 DOM 节点
 */
function blockCard(card, el) {
  // TODO: 例如 el.style.display = "none" 或 el.remove()
  // 当前留空
}
