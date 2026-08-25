/*
 * 日志输出模块
 * -----------------------------------------------------------
 * 统一把识别到的视频卡片信息打印到控制台。
 */

/**
 * 打印一张已识别出的视频卡片信息。
 * @param {{title: string, up: string, bvid: string}} card  卡片轻量信息
 */
function printCard(card) {
  console.groupCollapsed("[🫥BlackList] 视频卡片 - " + (card.title || "(无标题)"));
  console.log("title :", card.title);
  console.log("up    :", card.up);
  console.log("bvid  :", card.bvid);
  console.groupEnd();
}
