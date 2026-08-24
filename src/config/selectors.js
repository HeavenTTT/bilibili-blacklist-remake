/*
 * 选择器配置模块
 * -----------------------------------------------------------
 * 集中管理所有 CSS 选择器。B 站改版时，只需要增删这里的数组项，
 * 无需再去改其它文件。
 */
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

  // 视频标题（首页是 h3.bili-video-card__info--tit，带 title 属性）
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

  // bvid：优先取内嵌属性
  bvidAttr: [
    "data-bvid"
  ],
  // bvid：其次从视频链接里提取 BV 号
  bvidLink: [
    "a.bili-video-card__image--link",
    "a[href*=\"/video/\"]"
  ]
};
