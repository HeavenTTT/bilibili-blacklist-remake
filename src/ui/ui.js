/*
 * 界面模块
 * -----------------------------------------------------------
 * 参考旧版 Bilibili-BlackList 界面：
 *   - 顶栏右侧“盾牌/卡比”入口 + 已屏蔽计数；
 *   - 管理面板：精确匹配(UP名) / 正则匹配(UP/标题) / 插件配置 三个标签页；
 *   - 卡片悬停显示「屏蔽」按钮由 block.js 负责。
 */
var managerPanel = null;
var blockCountDisplayElement = null;
var blockCountTitleElement = null;
var tempUnblockButton = null;
var exactMatchListElement = null;
var regexMatchListElement = null;
var configListElement = null;

/** 卡比图标 SVG（旧版同款） */
function getKirbySVG() {
  return '' +
    '<svg width="35" height="35" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">' +
    '<ellipse cx="70" cy="160" rx="30" ry="15" fill="#cc3333" />' +
    '<ellipse cx="130" cy="160" rx="30" ry="15" fill="#cc3333" />' +
    '<ellipse cx="50" cy="120" rx="20" ry="20" fill="#ffb6c1" />' +
    '<ellipse cx="150" cy="120" rx="20" ry="20" fill="#ffb6c1" />' +
    '<circle cx="100" cy="110" r="60" fill="#ffb6c1" />' +
    '<ellipse cx="80" cy="90" rx="10" ry="22" fill="blue" />' +
    '<ellipse cx="80" cy="88" rx="10" ry="15" fill="black" />' +
    '<ellipse cx="80" cy="82" rx="8" ry="12" fill="#ffffff" />' +
    '<ellipse cx="120" cy="90" rx="10" ry="22" fill="blue" />' +
    '<ellipse cx="120" cy="88" rx="10" ry="15" fill="black" />' +
    '<ellipse cx="120" cy="82" rx="8" ry="12" fill="#ffffff" />' +
    '<ellipse cx="60" cy="110" rx="8" ry="5" fill="#ff4466" />' +
    '<ellipse cx="140" cy="110" rx="8" ry="5" fill="#ff4466" />' +
    '<path d="M 90 118 Q 100 125, 110 118" stroke="black" strokeWidth="3" fill="transparent" />' +
    '</svg>';
}

/** 注入全局样式 */
function injectUiStyles() {
  GM_addStyle([
    // 屏蔽按钮容器（悬停显示）
    '.bilibili-blacklist-block-container{display:none;position:absolute;top:0;left:0;width:100%;padding:2px;font-size:12px;flex-direction:row;justify-content:space-between;align-items:center;gap:3px;z-index:9999;pointer-events:none;}',
    '.bili-video-card:hover .bilibili-blacklist-block-container{display:flex!important;}',
    '.bilibili-blacklist-block-btn{position:static;width:40px;display:flex;justify-content:center;align-items:center;height:20px;padding:0 6px;font-size:12px;line-height:1;color:#fff;text-align:center;white-space:nowrap;border:none;border-radius:2px;background-color:#fb7299dd;pointer-events:auto!important;cursor:pointer;}',
    // 遮挡层
    '#bilibili-blacklist-kirby{position:absolute;top:0;left:0;width:100%;height:100%;display:flex;justify-content:center;align-items:center;pointer-events:none;z-index:10;border-radius:6px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}',
    '#bilibili-blacklist-kirby svg{opacity:.15;margin-top:-40px;}',
    '.bilibili-blacklist-reason{position:absolute;bottom:6px;left:6px;background:#f56c6c;color:#fff;font-size:12px;padding:2px 6px;border-radius:2px;pointer-events:none;}',
    // 顶栏管理按钮
    '#bilibili-blacklist-manager-button{cursor:pointer;}',
    '#bilibili-blacklist-manager-button .right-entry-item{display:flex;flex-direction:column;align-items:center;justify-content:center;}',
    '#bilibili-blacklist-manager-button svg{transition:transform .2s;}',
    '#bilibili-blacklist-manager-button:hover svg{transform:scale(1.1);}',
    // 管理面板
    '#bilibili-blacklist-manager-panel{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;max-height:80vh;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.15);z-index:99999;overflow:hidden;display:none;flex-direction:column;font-size:15px;color:var(--text2,#000);background-color:var(--bg1,#fff);opacity:.9;}',
    '#bilibili-blacklist-manager-panel h3{margin:0;font-weight:500;}',
    '#bilibili-blacklist-manager-panel h4{font-weight:bold;margin-bottom:12px;}',
    '#bilibili-blacklist-manager-panel ul{list-style:none;padding:0;margin:0;}',
    '#bilibili-blacklist-manager-panel hr{margin:12px 0;border:none;border-top:2px solid #ddd;}',
    '#bilibili-blacklist-manager-panel input[type="text"]{flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;}',
    '#bilibili-blacklist-manager-panel input:focus{outline:none;border-color:#fb7299!important;}',
    '.bilibili-blacklist-tabs{display:flex;border-bottom:1px solid #f1f2f3;}',
    '.bilibili-blacklist-tab{padding:12px 16px;cursor:pointer;font-weight:500;}',
    '.bilibili-blacklist-panel-content{padding:16px;overflow-y:auto;flex:1;}',
    '.bilibili-blacklist-panel-header{padding:16px;border-bottom:1px solid #f1f2f3;display:flex;justify-content:space-between;align-items:center;}',
    '.bilibili-blacklist-panel-close{background:none;border:none;cursor:pointer;padding:0 8px;color:var(--text2,#000);}',
    '.bilibili-blacklist-panel-body{display:flex;flex-direction:column;flex:1;overflow:hidden;}',
    '.bilibili-blacklist-panel-row,.bilibili-blacklist-add-row{display:flex;align-items:center;gap:8px;margin-bottom:12px;}',
    '.bilibili-blacklist-panel-row>span:first-child{flex:1;}',
    '.bilibili-blacklist-list-item{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f2f3;}',
    '.bilibili-blacklist-list-item>span{flex:1;}',
    '.bilibili-blacklist-empty{text-align:center;padding:16px;color:#999;}',
    '.bilibili-blacklist-panel-btn,.bilibili-blacklist-config-btn,.bilibili-blacklist-primary-btn{color:#fff;border:none;cursor:pointer;}',
    '.bilibili-blacklist-panel-btn{padding:4px 8px;border-radius:4px;}',
    '.bilibili-blacklist-config-btn{padding:6px 12px;border-radius:4px;}',
    '.bilibili-blacklist-primary-btn{padding:8px 16px;background:#fb7299;border-radius:4px;}',
  ].join("\n"));
}

/** 建面板按钮 */
function createPanelButton(text, bg, onClick) {
  var b = document.createElement("button");
  b.className = "bilibili-blacklist-panel-btn";
  b.textContent = text;
  b.style.background = bg;
  b.addEventListener("click", onClick);
  return b;
}

/** 建黑名单列表项 */
function createBlacklistListItem(contentText, onRemove) {
  var li = document.createElement("li");
  li.className = "bilibili-blacklist-list-item";
  var span = document.createElement("span");
  span.textContent = contentText;
  var rm = createPanelButton("移除", "#f56c6c", onRemove);
  li.appendChild(span);
  li.appendChild(rm);
  return li;
}

/** 设置开关按钮 */
function createSettingToggleButton(labelText, configKey, title) {
  var row = document.createElement("div");
  row.className = "bilibili-blacklist-panel-row";
  if (title) row.title = title;
  var label = document.createElement("span");
  label.textContent = labelText;
  var btn = document.createElement("button");
  btn.className = "bilibili-blacklist-config-btn";
  function refresh() {
    btn.textContent = globalConfig[configKey] ? "开启" : "关闭";
    btn.style.background = globalConfig[configKey] ? "#fb7299" : "#909399";
  }
  btn.addEventListener("click", function () {
    globalConfig[configKey] = !globalConfig[configKey];
    saveGlobalConfig();
    refresh();
  });
  refresh();
  row.appendChild(label);
  row.appendChild(btn);
  return row;
}

/** 刷新精确匹配列表 */
function refreshExactMatchList() {
  if (!exactMatchListElement) return;
  exactMatchListElement.innerHTML = "";
  exactMatchBlacklist.forEach(function (item) {
    exactMatchListElement.appendChild(createBlacklistListItem(item, function () {
      removeExactBlacklistItem(item);
      refreshExactMatchList();
      blockAllMatchingCards();
    }));
  });
  if (exactMatchBlacklist.length === 0) {
    var empty = document.createElement("div");
    empty.className = "bilibili-blacklist-empty";
    empty.textContent = "暂无精确匹配屏蔽UP主";
    exactMatchListElement.appendChild(empty);
  }
}

/** 刷新正则匹配列表 */
function refreshRegexMatchList() {
  if (!regexMatchListElement) return;
  regexMatchListElement.innerHTML = "";
  regexMatchBlacklist.forEach(function (item) {
    regexMatchListElement.appendChild(createBlacklistListItem(item, function () {
      removeRegexBlacklistItem(item);
      refreshRegexMatchList();
      blockAllMatchingCards();
    }));
  });
  if (regexMatchBlacklist.length === 0) {
    var empty = document.createElement("div");
    empty.className = "bilibili-blacklist-empty";
    empty.textContent = "暂无正则匹配屏蔽规则";
    regexMatchListElement.appendChild(empty);
  }
}

/** 刷新配置区 */
function refreshConfigSettings() {
  if (!configListElement) return;
  configListElement.innerHTML = "";

  // 临时显示/恢复屏蔽
  var tempRow = document.createElement("div");
  tempRow.className = "bilibili-blacklist-panel-row";
  var tempLabel = document.createElement("span");
  tempLabel.textContent = "临时开关";
  tempUnblockButton = document.createElement("button");
  tempUnblockButton.className = "bilibili-blacklist-config-btn";
  tempUnblockButton.textContent = isShowAllVideos ? "恢复屏蔽" : "取消屏蔽";
  tempUnblockButton.style.background = isShowAllVideos ? "#dddddd" : "#fb7299";
  tempUnblockButton.addEventListener("click", toggleShowAllBlockedVideos);
  tempRow.appendChild(tempLabel);
  tempRow.appendChild(tempUnblockButton);
  configListElement.appendChild(tempRow);

  configListElement.appendChild(createSettingToggleButton("屏蔽标题/UP主名", "flagInfo", "按 UP 主名 / 标题精确或正则匹配屏蔽"));
  configListElement.appendChild(createSettingToggleButton("遮挡被屏蔽视频", "flagKirby", "更温和的覆盖模糊层（关掉则直接隐藏）"));
}

/** 刷新面板所有标签页 */
function refreshAllPanelTabs() {
  refreshExactMatchList();
  refreshRegexMatchList();
  refreshConfigSettings();
}

/** 更新已屏蔽计数（顶栏徽标 + 面板标题） */
function updateBlockCount() {
  if (blockCountDisplayElement) {
    blockCountDisplayElement.textContent = String(blockedVideoCards.size);
  }
  if (blockCountTitleElement) {
    blockCountTitleElement.textContent = "已屏蔽视频 (" + blockedVideoCards.size + ")";
  }
}

/** 顶栏入口按钮（做成可重试，顶栏由 Vue 延迟渲染） */
function addBlacklistManagerButton(attempt) {
  attempt = attempt || 0;
  var rightEntry = document.querySelector(".right-entry");
  // 顶栏 li 数量足够才插入，避免被 Vue 重渲染顶掉
  if (rightEntry && rightEntry.querySelectorAll("li").length > 6) {
    if (rightEntry.querySelector("#bilibili-blacklist-manager-button")) return;
    var listItem = document.createElement("li");
    listItem.id = "bilibili-blacklist-manager-button";
    listItem.className = "v-popover-wrap";
    var item = document.createElement("div");
    item.className = "right-entry-item";
    var icon = document.createElement("div");
    icon.className = "right-entry__outside";
    icon.innerHTML = getKirbySVG();
    blockCountDisplayElement = document.createElement("span");
    blockCountDisplayElement.textContent = "0";
    item.appendChild(icon);
    item.appendChild(blockCountDisplayElement);
    listItem.appendChild(item);
    if (rightEntry.children.length > 1) {
      rightEntry.insertBefore(listItem, rightEntry.children[1]);
    } else {
      rightEntry.appendChild(listItem);
    }
    listItem.addEventListener("click", function () {
      if (managerPanel) {
        managerPanel.style.display = managerPanel.style.display === "flex" ? "none" : "flex";
      }
    });
    return;
  }
  // 没有顶栏（如视频页）就直接用右上角固定入口，避免用户等 10 秒
  if (!rightEntry) {
    addFixedBlacklistButton();
    return;
  }
  // 顶栏未就绪：稍后重试；超过 20 次改用右上角固定入口兜底
  if (attempt < 20) {
    setTimeout(function () { addBlacklistManagerButton(attempt + 1); }, 500);
  } else {
    addFixedBlacklistButton();
  }
}

/** 右上角固定入口（兜底，始终可见） */
function addFixedBlacklistButton() {
  if (document.querySelector("#bilibili-blacklist-manager-button")) return;
  var listItem = document.createElement("div");
  listItem.id = "bilibili-blacklist-manager-button";
  listItem.style.cssText = "position:fixed;top:16px;right:16px;z-index:999999;cursor:pointer;";
  listItem.innerHTML = getKirbySVG();
  blockCountDisplayElement = document.createElement("span");
  blockCountDisplayElement.style.cssText = "position:absolute;top:-6px;right:-6px;background:#fb7299;color:#fff;border-radius:10px;font-size:12px;padding:0 6px;";
  listItem.appendChild(blockCountDisplayElement);
  document.body.appendChild(listItem);
  listItem.addEventListener("click", function () {
    if (managerPanel) {
      managerPanel.style.display = managerPanel.style.display === "flex" ? "none" : "flex";
    }
  });
}

/** 创建管理面板 */
function createManagerPanel() {
  if (document.querySelector("#bilibili-blacklist-manager-panel")) return;
  managerPanel = document.createElement("div");
  managerPanel.id = "bilibili-blacklist-manager-panel";

  var tabsWrap = document.createElement("div");
  tabsWrap.className = "bilibili-blacklist-tabs";
  var contents = {
    exact: document.createElement("div"),
    regex: document.createElement("div"),
    config: document.createElement("div")
  };
  contents.exact.className = contents.regex.className = contents.config.className = "bilibili-blacklist-panel-content";
  contents.exact.style.display = "block";
  contents.regex.style.display = "none";
  contents.config.style.display = "none";

  var tabs = [
    { name: "精确匹配(UP名)", content: contents.exact },
    { name: "正则匹配(UP/标题)", content: contents.regex },
    { name: "插件配置", content: contents.config }
  ];
  tabs.forEach(function (tabData) {
    var tab = document.createElement("div");
    tab.className = "bilibili-blacklist-tab";
    tab.textContent = tabData.name;
    tab.style.borderBottom = tabData.content.style.display === "block" ? "2px solid #fb7299" : "none";
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) {
        t.el.style.borderBottom = "none";
        t.content.style.display = "none";
      });
      tab.style.borderBottom = "2px solid #fb7299";
      tabData.content.style.display = "block";
    });
    tabData.el = tab;
    tabsWrap.appendChild(tab);
  });

  // 头部
  var header = document.createElement("div");
  header.className = "bilibili-blacklist-panel-header";
  blockCountTitleElement = document.createElement("h3");
  var closeBtn = document.createElement("button");
  closeBtn.className = "bilibili-blacklist-panel-close";
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", function () { managerPanel.style.display = "none"; });
  header.appendChild(blockCountTitleElement);
  header.appendChild(closeBtn);

  // 精确匹配
  var exactAdd = document.createElement("div");
  exactAdd.className = "bilibili-blacklist-add-row";
  var exactInput = document.createElement("input");
  exactInput.type = "text";
  exactInput.placeholder = "输入要屏蔽的UP主名称";
  var exactBtn = document.createElement("button");
  exactBtn.className = "bilibili-blacklist-primary-btn";
  exactBtn.textContent = "添加";
  exactBtn.addEventListener("click", function () {
    var v = exactInput.value.trim();
    if (v) {
      addExactBlacklistItem(v);
      exactInput.value = "";
      refreshExactMatchList();
      blockAllMatchingCards();
    }
  });
  exactAdd.appendChild(exactInput);
  exactAdd.appendChild(exactBtn);
  contents.exact.appendChild(exactAdd);
  exactMatchListElement = document.createElement("ul");
  exactMatchListElement.id = "bilibili-blacklist-exact-list";
  contents.exact.appendChild(exactMatchListElement);

  // 正则匹配
  var regexAdd = document.createElement("div");
  regexAdd.className = "bilibili-blacklist-add-row";
  var regexInput = document.createElement("input");
  regexInput.type = "text";
  regexInput.placeholder = "输入正则表达式 (如: 小小.*Official)";
  var regexBtn = document.createElement("button");
  regexBtn.className = "bilibili-blacklist-primary-btn";
  regexBtn.textContent = "添加";
  regexBtn.addEventListener("click", function () {
    var v = regexInput.value.trim();
    if (v) {
      if (!addRegexBlacklistItem(v)) { alert("无效的正则表达式或已存在"); return; }
      regexInput.value = "";
      refreshRegexMatchList();
      blockAllMatchingCards();
    }
  });
  regexAdd.appendChild(regexInput);
  regexAdd.appendChild(regexBtn);
  contents.regex.appendChild(regexAdd);
  regexMatchListElement = document.createElement("ul");
  regexMatchListElement.id = "bilibili-blacklist-regex-list";
  contents.regex.appendChild(regexMatchListElement);

  // 配置
  configListElement = document.createElement("ul");
  configListElement.id = "bilibili-blacklist-config-list";
  contents.config.appendChild(configListElement);

  var body = document.createElement("div");
  body.className = "bilibili-blacklist-panel-body";
  body.appendChild(contents.exact);
  body.appendChild(contents.regex);
  body.appendChild(contents.config);

  managerPanel.appendChild(tabsWrap);
  managerPanel.appendChild(header);
  managerPanel.appendChild(body);
  document.body.appendChild(managerPanel);
  refreshAllPanelTabs();
}

/** 初始化界面 */
function initUi() {
  injectUiStyles();
  addBlacklistManagerButton();
  createManagerPanel();
  updateBlockCount();
}