/*
 * 黑名单匹配模块
 * -----------------------------------------------------------
 * 根据 精确 / 正则 黑名单判定某张卡片是否需要屏蔽。
 */
function isBlacklisted(upName, title, bvid) {
  if (!globalConfig.flagInfo) return false;
  var up = (upName || "").trim();
  var titleStr = (title || "").trim();
  var lowUp = up.toLowerCase();

  // 精确匹配：UP 主名
  for (var i = 0; i < exactMatchBlacklist.length; i++) {
    if (String(exactMatchBlacklist[i]).toLowerCase() === lowUp) return true;
  }

  // 正则匹配：UP 主名 / 标题
  for (var j = 0; j < regexMatchBlacklist.length; j++) {
    var re;
    try { re = new RegExp(String(regexMatchBlacklist[j]), "i"); } catch (e) { continue; }
    if (re.test(up) || re.test(titleStr)) return true;
  }
  return false;
}
