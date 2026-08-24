/*
 * 日志输出模块
 * -----------------------------------------------------------
 * 统一把识别到的视频卡片信息打印到控制台。
 */

/**
 * 打印一张已识别出的视频卡片信息。
 * @param {{title: string, up: string, bvid: string, el: HTMLElement}} card  卡片信息
 */
function printCard(card) {
  console.groupCollapsed("[HelloWorld] 视频卡片 - " + (card.title || "(无标题)"));
  console.log("title :", card.title);
  console.log("up    :", card.up);
  console.log("bvid  :", card.bvid);
  console.log("el    :", card.el);   // 卡片本体 DOM，可直接在控制台展开查看
  console.groupEnd();
}
