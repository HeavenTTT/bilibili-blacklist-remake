/*
 * 校验与屏蔽模块（接口占位，参考旧版行为设计）
 * -----------------------------------------------------------
 * 设计目标（与旧插件行为一致）：
 *   - 命中黑名单后，在卡片表面覆盖一层“模糊/遮挡”控件；
 *   - 在遮挡层上提供「屏蔽 / 屏蔽原因」等操作按钮；
 *   - 可通过 BLOCK_CONFIG.mode 在「覆盖(cover)」与「隐藏(hide)」之间切换。
 *
 * 当前 validateCard 与 applyXXX / addXXX 均为空实现（TODO），先搭好接口。
 */
var BLOCK_CONFIG = {
  mode: "cover",        // "cover" 覆盖模糊层 | "hide" 直接隐藏
  addControls: true,    // 是否在遮挡层上添加「屏蔽 / 屏蔽原因」按钮
  reason: ""            // 屏蔽原因（后续可扩展）
};

/**
 * 校验一张卡片是否符合屏蔽条件。
 * @param {{bvid: string, title: string, up: string}} card  卡片轻量信息
 * @returns {boolean}  true=需要屏蔽；false=放行（当前默认放行）
 */
function validateCard(card) {
  // TODO: 参考旧版 Bilibili-BlackList，接入 bvid / UP 名 / 标题的精确 + 正则匹配
  return false;
}

/**
 * 屏蔽一张卡片：按 BLOCK_CONFIG.mode 选择「覆盖」或「隐藏」。
 * @param {{bvid: string, title: string, up: string}} card  卡片轻量信息
 * @param {HTMLElement} el   卡片 DOM 节点
 */
function blockCard(card, el) {
  if (BLOCK_CONFIG.mode === "hide") {
    applyHide(card, el);
    return;
  }
  // 默认：覆盖模糊层 + 添加操作按钮
  applyCover(card, el);
  if (BLOCK_CONFIG.addControls) {
    addBlockControls(card, el);
  }
}

/**
 * 在卡片表面覆盖模糊/遮挡层，并标注“已屏蔽”。
 * @param {{bvid: string, title: string, up: string}} card
 * @param {HTMLElement} el
 */
function applyCover(card, el) {
  // TODO: 创建覆盖层（如 半透明 + 模糊），插入 el 内/外层，并标记已屏蔽
}

/**
 * 直接隐藏或移除卡片。
 * @param {{bvid: string, title: string, up: string}} card
 * @param {HTMLElement} el
 */
function applyHide(card, el) {
  // TODO: el.style.display = "none" 或 el.remove()
}

/**
 * 在遮挡层上添加「屏蔽 / 屏蔽原因」等控制按钮。
 * @param {{bvid: string, title: string, up: string}} card
 * @param {HTMLElement} el
 */
function addBlockControls(card, el) {
  // TODO: 添加按钮并绑定 onBlockClick / onBlockReason
}

/**
 * 「屏蔽」按钮点击回调。
 * @param {{bvid: string, title: string, up: string}} card
 */
function onBlockClick(card) {
  // TODO: 例如把 bvid/UP 名写入黑名单并重新屏蔽
}

/**
 * 「屏蔽原因」按钮点击回调。
 * @param {{bvid: string, title: string, up: string}} card
 */
function onBlockReason(card) {
  // TODO: 弹出原因填写 / 选择
}