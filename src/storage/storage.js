/*
 * 存储模块
 * -----------------------------------------------------------
 * 黑名单与全局配置的加载 / 保存（基于 GM_getValue / GM_setValue）。
 */
var STORAGE_KEYS = {
  exact: "exactBlacklist",
  regex: "regexBlacklist",
  config: "globalConfig"
};

// 精确匹配黑名单（UP 主名）
var exactMatchBlacklist = GM_getValue(STORAGE_KEYS.exact, []);
// 正则匹配黑名单（UP 主名 / 标题）
var regexMatchBlacklist = GM_getValue(STORAGE_KEYS.regex, []);
// 全局配置
var globalConfig = Object.assign({
  flagInfo: true,       // 按 UP 主名 / 标题屏蔽
  flagKirby: true,      // 是否使用“遮挡覆盖层”而非直接隐藏
  flagHideOnLoad: true, // 加载后立即屏蔽
  blockScanInterval: 200
}, GM_getValue(STORAGE_KEYS.config, {}));

/** 把黑名单写入存储 */
function saveBlacklists() {
  GM_setValue(STORAGE_KEYS.exact, exactMatchBlacklist);
  GM_setValue(STORAGE_KEYS.regex, regexMatchBlacklist);
}

/** 把全局配置写入存储 */
function saveGlobalConfig() {
  GM_setValue(STORAGE_KEYS.config, globalConfig);
}

/** 添加一条精确匹配项（最新在前），成功返回 true */
function addExactBlacklistItem(item) {
  item = String(item == null ? "" : item).trim();
  if (!item) return false;
  if (exactMatchBlacklist.indexOf(item) === -1) {
    exactMatchBlacklist.unshift(item);
    saveBlacklists();
    return true;
  }
  return false;
}

/** 移除一条精确匹配项，成功返回 true */
function removeExactBlacklistItem(item) {
  var idx = exactMatchBlacklist.indexOf(item);
  if (idx !== -1) {
    exactMatchBlacklist.splice(idx, 1);
    saveBlacklists();
    return true;
  }
  return false;
}

/** 添加一条正则匹配项（校验正则合法性），成功返回 true */
function addRegexBlacklistItem(regex) {
  regex = String(regex == null ? "" : regex).trim();
  if (!regex) return false;
  try { new RegExp(regex); } catch (e) { return false; }
  if (regexMatchBlacklist.indexOf(regex) === -1) {
    regexMatchBlacklist.unshift(regex);
    saveBlacklists();
    return true;
  }
  return false;
}

/** 移除一条正则匹配项，成功返回 true */
function removeRegexBlacklistItem(regex) {
  var idx = regexMatchBlacklist.indexOf(regex);
  if (idx !== -1) {
    regexMatchBlacklist.splice(idx, 1);
    saveBlacklists();
    return true;
  }
  return false;
}
