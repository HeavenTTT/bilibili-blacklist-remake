/*
 * 界面模块
 * -----------------------------------------------------------
 * 顶栏入口 + 管理面板 + 遮挡层 / 屏蔽按钮 / 悬停临时显示。
 */
const KIRBY_FADE_DURATION_MS = 800;
const hoverRevealBoundCards = new WeakSet();
const hoverRevealTimers = new WeakMap();
const kirbyFadeTimers = new WeakMap();

/**
 * 为UP主创建屏蔽按钮，显示在视频卡片上。
 * @param {string} upName - UP主名称。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 * @returns {HTMLDivElement} 创建的按钮元素。
 */
function createBlockUpButton(upName, cardElement) {
  const button = document.createElement("div");
  button.className = "bilibili-blacklist-block-btn";
  button.innerHTML = "屏蔽";
  button.title = `屏蔽: ${upName}`;

  button.addEventListener("click", (e) => {
    e.stopPropagation(); // 阻止事件冒泡，防止触发视频点击事件
    addToExactBlacklist(upName, cardElement);
  });

  return button;
}

/**
 * 为标签名创建屏蔽按钮，显示在视频卡片上。
 * @param {string} tagName - 标签名。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 * @returns {HTMLSpanElement} 创建的按钮元素。
 */
function createTNameBlockButton(tagName, cardElement) {
  const button = document.createElement("span");
  button.className = "bilibili-blacklist-tname";
  button.innerHTML = `${tagName}`;
  button.title = `屏蔽: ${tagName}`;

  button.addEventListener("click", (e) => {
    e.stopPropagation(); // 阻止事件冒泡
    addToTagNameBlacklist(tagName, cardElement);
  });

  return button;
}

/**
 * 将黑名单管理器按钮添加到右侧导航条。
 */
function addBlacklistManagerButton() {
  const rightEntry = document.querySelector(".right-entry");
  if (!rightEntry) {
    console.warn("[🫥BlackList] 未找到右侧导航栏");
    return;
  }
  // 顶栏由Vue延迟渲染，等li数量超过6个(顶栏基本渲染完成)后再插入按钮，避免被重渲染顶掉
  if (rightEntry.querySelectorAll("li").length <= 6) {
    return;
  }
  if (!rightEntry.querySelector("#bilibili-blacklist-manager-button")) {
    const listItem = document.createElement("li");
    listItem.id = "bilibili-blacklist-manager-button";
    listItem.className = "v-popover-wrap";

    const button = document.createElement("div");
    button.className = "right-entry-item";

    const icon = document.createElement("div");
    icon.className = "right-entry__outside";
    icon.innerHTML = getKirbySVG(); // 获取卡比SVG图标

    blockCountDisplayElement = document.createElement("span");
    blockCountDisplayElement.textContent = `0`;

    button.appendChild(icon);
    button.appendChild(blockCountDisplayElement);
    listItem.appendChild(button);

    // 将按钮插入到导航栏的特定位置
    if (rightEntry.children.length > 1) {
      rightEntry.insertBefore(listItem, rightEntry.children[1]);
    } else {
      rightEntry.appendChild(listItem);
    }

    // 点击按钮显示/隐藏管理面板
    listItem.addEventListener("click", () => {
      managerPanel.style.display =
        managerPanel.style.display === "flex" ? "none" : "flex";
    });
  }
}

/**
 * 更新已屏蔽视频的显示计数。
 */
function refreshBlockCountDisplay() {
  if (blockCountDisplayElement) {
    blockCountDisplayElement.textContent = `${blockedVideoCards.size}`;
  }
  if (blockCountTitleElement) {
    blockCountTitleElement.textContent = `已屏蔽视频 (${blockedVideoCards.size} = ${countBlockInfo} + ${countBlockAD} + ${countBlockCM} + ${countBlockTName})`;
  }
}

// 辅助函数：创建通用按钮
function createPanelButton(text, bgColor, onClick) {
  const button = document.createElement("button");
  button.className = "bilibili-blacklist-panel-btn";
  button.textContent = text;
  button.style.background = bgColor;
  button.addEventListener("click", onClick);
  return button;
}

// 辅助函数：为黑名单面板创建列表项
function createBlacklistListItem(contentText, onRemoveClick) {
  const item = document.createElement("li");
  item.className = "bilibili-blacklist-list-item";

  const content = document.createElement("span");
  content.textContent = contentText;
  const removeBtn = createPanelButton("移除", "#f56c6c", onRemoveClick);

  item.appendChild(content);
  item.appendChild(removeBtn);
  return item;
}

/**
 * 刷新面板中的精确匹配黑名单显示。
 */
function refreshExactMatchList() {
  if (!exactMatchListElement) {
    if (!isBlacklistPanelCreated()) {
      return;
    }
    exactMatchListElement = document.querySelector(
      "#bilibili-blacklist-exact-list"
    );
    if (!exactMatchListElement) {
      console.warn("[🫥BlackList] exactMatchListElement 未定义");
      return;
    }
  }
  exactMatchListElement.innerHTML = "";
  exactMatchBlacklist.forEach((upName) => {
    const item = createBlacklistListItem(upName, () => {
      removeFromExactBlacklist(upName);
    });
    exactMatchListElement.appendChild(item);
  });
  // 反转列表顺序，使最新添加的显示在顶部
  Array.from(exactMatchListElement.children)
    .reverse()
    .forEach((item) => exactMatchListElement.appendChild(item));

  if (exactMatchBlacklist.length === 0) {
    const empty = document.createElement("div");
    empty.className = "bilibili-blacklist-empty";
    empty.textContent = "暂无精确匹配屏蔽UP主";
    exactMatchListElement.appendChild(empty);
  }
}

/**
 * 刷新面板中的正则匹配黑名单显示。
 */
function refreshRegexMatchList() {
  if (!regexMatchListElement) {
    if (!isBlacklistPanelCreated()) {
      return;
    }
    regexMatchListElement = document.querySelector(
      "#bilibili-blacklist-regex-list"
    );
    if (!regexMatchListElement) {
      console.warn("[🫥BlackList] regexMatchListElement 未定义");
      return;
    }
  }
  regexMatchListElement.innerHTML = "";

  regexMatchBlacklist.forEach((regex, index) => {
    const item = createBlacklistListItem(regex, () => {
      regexMatchBlacklist.splice(index, 1);
      saveBlacklistsToStorage();
      refreshRegexMatchList();
    });
    regexMatchListElement.appendChild(item);
  });

  // 反转列表顺序，使最新添加的显示在顶部
  Array.from(regexMatchListElement.children)
    .reverse()
    .forEach((item) => regexMatchListElement.appendChild(item));

  if (regexMatchBlacklist.length === 0) {
    const empty = document.createElement("div");
    empty.className = "bilibili-blacklist-empty";
    empty.textContent = "暂无正则匹配屏蔽规则";
    regexMatchListElement.appendChild(empty);
  }
}

/**
 * 刷新面板中的标签名黑名单显示。
 */
function refreshTagNameList() {
  if (!tagNameListElement) {
    if (!isBlacklistPanelCreated()) {
      return;
    }
    tagNameListElement = document.querySelector(
      "#bilibili-blacklist-tname-list"
    );
    if (!tagNameListElement) {
      console.warn("[🫥BlackList] tagNameListElement 未定义");
      return;
    }
  }
  tagNameListElement.innerHTML = "";

  tagNameBlacklist.forEach((tagName) => {
    const item = createBlacklistListItem(tagName, () => {
      removeFromTagNameBlacklist(tagName);
    });
    tagNameListElement.appendChild(item);
  });
  // 反转列表顺序，使最新添加的显示在顶部
  Array.from(tagNameListElement.children)
    .reverse()
    .forEach((item) => tagNameListElement.appendChild(item));

  if (tagNameBlacklist.length === 0) {
    const empty = document.createElement("div");
    empty.className = "bilibili-blacklist-empty";
    empty.textContent = "暂无标签屏蔽规则";
    tagNameListElement.appendChild(empty);
  }
}

// 辅助函数：为设置创建切换按钮
function createSettingToggleButton(labelText, configKey, title = null) {
  const container = document.createElement("div");
  container.className =
    "bilibili-blacklist-panel-row bilibili-blacklist-setting-toggle";
  container.title = title; // 设置鼠标悬停提示

  const label = document.createElement("span");
  label.textContent = labelText;

  const button = document.createElement("button");
  button.className = "bilibili-blacklist-config-btn";

  function refreshButtonAppearance() {
    button.textContent = globalPluginConfig[configKey] ? "开启" : "关闭";
    button.style.backgroundColor = globalPluginConfig[configKey]
      ? "#fb7299"
      : "#909399";
  }

  button.addEventListener("click", () => {
    globalPluginConfig[configKey] = !globalPluginConfig[configKey];
    refreshButtonAppearance();
    saveGlobalConfigToStorage();
    if (configKey === "flagHoverReveal" && !globalPluginConfig[configKey]) {
      restoreAllBlockedVideoOverlays();
    }
  });

  refreshButtonAppearance(); // 初始化按钮外观

  container.appendChild(label);
  container.appendChild(button);

  return container;
}
// 辅助函数：为设置创建输入文本
function createSettingInput(
  labelText,
  configKey,
  title = null,
  constraints = {}
) {
  // 卡片扫描间隔设置
  const Container = document.createElement("div");
  Container.className =
    "bilibili-blacklist-panel-row bilibili-blacklist-setting-input-row";
  Container.title = title;

  const Label = document.createElement("span");
  Label.textContent = labelText;

  const Input = document.createElement("input");
  Input.type = "number";
  Input.className = "bilibili-blacklist-number-input";
  const { min = 0, max = null, step = null } = constraints;
  Input.min = `${min}`;
  if (max !== null) Input.max = `${max}`;
  if (step !== null) Input.step = `${step}`;
  Input.value = globalPluginConfig[configKey];

  const Button = document.createElement("button");
  Button.className =
    "bilibili-blacklist-config-btn bilibili-blacklist-config-btn-primary";
  Button.textContent = "保存";

  Button.addEventListener("click", () => {
    const val = Number(Input.value);
    const isInRange =
      Input.value.trim() !== "" &&
      Number.isFinite(val) &&
      val >= min &&
      (max === null || val <= max);
    if (isInRange) {
      globalPluginConfig[configKey] = val;
      saveGlobalConfigToStorage();
    } else {
      const rangeText = max === null ? `不小于 ${min}` : `${min} 到 ${max}`;
      alert(`请输入${rangeText}之间的有效数字！`);
    }
  });
  Container.appendChild(Label);
  Container.appendChild(Input);
  Container.appendChild(Button);

  return Container;
}

// 辅助函数：为设置创建下拉选择框
function createSettingSelect(labelText, configKey, title = null, options = []) {
  const container = document.createElement("div");
  container.className =
    "bilibili-blacklist-panel-row bilibili-blacklist-setting-select-row";
  container.title = title;

  const label = document.createElement("span");
  label.textContent = labelText;

  const select = document.createElement("select");
  select.className = "bilibili-blacklist-select";
  select.addEventListener("change", () => {
    globalPluginConfig[configKey] = select.value;
    saveGlobalConfigToStorage();
  });

  // 按当前配置值选中对应项
  options.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    if (String(globalPluginConfig[configKey]) === String(opt.value)) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  container.appendChild(label);
  container.appendChild(select);
  return container;
}

/**
 * 刷新面板中的配置设置显示。
 */
function refreshConfigSettings() {
  if (!configListElement) {
    if (!isBlacklistPanelCreated()) {
      return;
    }
    configListElement = document.querySelector(
      "#bilibili-blacklist-config-list"
    );
    if (!configListElement) {
      console.warn("[🫥BlackList] configListElement 未定义");
      return;
    }
  }
  configListElement.innerHTML = "";

  // 临时开关按钮
  const tempToggleContainer = document.createElement("div");
  tempToggleContainer.className =
    "bilibili-blacklist-panel-row bilibili-blacklist-temp-toggle";

  const tempToggleLabel = document.createElement("span");
  tempToggleLabel.textContent = "临时开关";

  tempUnblockButton = document.createElement("button");
  tempUnblockButton.className = "bilibili-blacklist-config-btn";
  tempUnblockButton.textContent = isShowAllVideos ? "恢复屏蔽" : "取消屏蔽";
  tempUnblockButton.style.background = isShowAllVideos
    ? "#dddddd"
    : "#fb7299";
  tempUnblockButton.addEventListener("click", toggleShowAllBlockedVideos);

  tempToggleContainer.appendChild(tempToggleLabel);
  tempToggleContainer.appendChild(tempUnblockButton);
  configListElement.appendChild(tempToggleContainer);

  const title = document.createElement("h4");
  title.textContent = "全局配置开关(部分功能刷新后生效)";
  configListElement.appendChild(title);

  // 添加配置切换按钮
  configListElement.appendChild(
    createSettingToggleButton(
      "屏蔽标题/Up主名",
      "flagInfo",
      "屏蔽标题/Up主名"
    )
  );
  configListElement.appendChild(
    createSettingToggleButton(
      "屏蔽分类标签",
      "flagTName",
      "通过请求API获取分类标签"
    )
  );

  // 标签缓存数量显示与清除按钮
  const tagNameListControlContainer = document.createElement("div");
  tagNameListControlContainer.className =
    "bilibili-blacklist-panel-row bilibili-blacklist-cache-control";
  tagNameListControlContainer.title = "打开视频播放页面可刷新";

  const tagNameListLabel = document.createElement("span");
  tagNameListLabel.textContent = `分类标签缓存数量: ${tagNameList.length}`;

  const clearTagNameListButton = document.createElement("button");
  clearTagNameListButton.className =
    "bilibili-blacklist-config-btn bilibili-blacklist-config-btn-danger";
  clearTagNameListButton.textContent = "清除";
  clearTagNameListButton.addEventListener("click", () => {
    if (confirm("确定要清除分类标签缓存吗？这不会影响已屏蔽的标签，但会使得下次需要重新从API获取标签信息。")) {
      tagNameList.length = 0;
      if (typeof saveTagNameListToStorage === "function") {
        saveTagNameListToStorage();
      } else {
        GM_setValue("tagNameList", []);
        GM_setValue("tLastTime", 0);
      }
      tagNameListLabel.textContent = `分类标签缓存数量: 0`;
    }
  });

  tagNameListControlContainer.appendChild(tagNameListLabel);
  tagNameListControlContainer.appendChild(clearTagNameListButton);
  configListElement.appendChild(tagNameListControlContainer);

  configListElement.appendChild(
    createSettingToggleButton(
      "屏蔽竖屏视频",
      "flagVertical",
      "通过请求API获取视频分辨率"
    )
  );
  configListElement.appendChild(
    createSettingToggleButton("屏蔽主页推荐", "flagAD", "直播/广告/分区推送")
  );
  configListElement.appendChild(
    createSettingToggleButton(
      "屏蔽主页视频软广",
      "flagCM",
      "cm.bilibili.com软广"
    )
  );

  // 自动连播遇到被屏蔽视频的处理方式
  configListElement.appendChild(
    createSettingSelect(
      "自动连播遇到被屏蔽视频:",
      "flagSkipBlockedAutoplay",
      "播放页开启自动连播并播到被屏蔽视频时：切换为未屏蔽视频 / 停止播放 / 不处理（按B站默认继续播放）。",
      [
        { value: "skip", label: "切换为未屏蔽视频" },
        { value: "stop", label: "停止播放" },
        { value: "off", label: "不处理(默认)" },
      ]
    )
  );

  //分割线
  const hr = document.createElement("hr");
  configListElement.appendChild(hr);

  configListElement.appendChild(
    createSettingToggleButton("遮挡被屏蔽视频", "flagKirby", "更加温和的方式")
  );
  configListElement.appendChild(
    createSettingToggleButton(
      "悬停后显示被遮挡视频",
      "flagHoverReveal",
      "鼠标在被遮挡的视频卡片上停留指定时间后临时显示，移开后重新遮挡。仅在“遮挡被屏蔽视频”开启时生效。"
    )
  );
  configListElement.appendChild(
    createSettingInput(
      "悬停显示延迟 (秒):",
      "hoverRevealDelaySeconds",
      "允许设置 0.1 到 5 秒。",
      { min: 0.1, max: 5, step: 0.1 }
    )
  );
  configListElement.appendChild(
    createSettingToggleButton(
      "加载时立即隐藏卡片",
      "flagHideOnLoad",
      "新卡片加载出来时是否立即隐藏，待处理完成后再决定显示或继续屏蔽。关闭此功能可能会导致卡片先显示后隐藏的闪烁。"
    )
  );

  configListElement.appendChild(
    createSettingInput(
      "卡片扫描间隔 (ms):",
      "blockScanInterval",
      "扫描新卡片的间隔时间，单位 ms。值越小，新卡片隐藏越快，但可能会增加CPU负担。建议值 200ms。"
    )
  );

  configListElement.appendChild(
    createSettingInput(
      "视频信息API请求间隔 (ms):",
      "processQueueInterval",
      "每个视频获取分类标签/视频分辨率时的API请求间隔时间，单位 ms。间隔时间越长，越不容易触发B站API限速。建议值 200ms。"
    )
  );
  configListElement.appendChild(
    createSettingInput(
      "竖屏视频比例阈值:",
      "verticalScaleThreshold",
      "获取的视频API信息后，判断视频是否为竖屏（长 除于 宽）的阈值。建议值 0.7。"
    )
  );
}

/**
 * 刷新黑名单管理面板中的所有标签页。
 */
function refreshAllPanelTabs() {
  refreshExactMatchList();
  refreshRegexMatchList();
  refreshTagNameList();
  refreshConfigSettings();
}

/**
 * 检查黑名单管理面板是否已创建并存在于DOM中。
 * 如果找到，则设置全局 `managerPanel` 引用。
 * @returns {boolean} 如果面板存在则返回true，否则返回false。
 */
function isBlacklistPanelCreated() {
  const panelInDom = document.querySelector(
    "#bilibili-blacklist-manager-panel"
  );
  if (panelInDom) {
    if (!managerPanel) {
      managerPanel = panelInDom;
    }
    return true;
  }
  return false;
}

/**
 * 创建黑名单管理面板。
 */
function createBlacklistPanel() {
  if (isBlacklistPanelCreated()) {
    return;
  }
  managerPanel = document.createElement("div");
  managerPanel.id = "bilibili-blacklist-manager-panel"; // 确保ID唯一

  // 创建标签容器
  const tabContainer = document.createElement("div");
  tabContainer.className = "bilibili-blacklist-tabs";

  // 创建各个标签页的内容区域
  const exactContent = document.createElement("div");
  exactContent.className = "bilibili-blacklist-panel-content";
  exactContent.style.display = "block"; // 默认显示精确匹配

  const regexContent = document.createElement("div");
  regexContent.className = "bilibili-blacklist-panel-content";
  regexContent.style.display = "none";

  const tnameContent = document.createElement("div");
  tnameContent.className = "bilibili-blacklist-panel-content";
  tnameContent.style.display = "none";

  const configContent = document.createElement("div");
  configContent.className = "bilibili-blacklist-panel-content";
  configContent.style.display = "none";

  // 定义标签页数据
  const tabs = [
    { name: "精确匹配(Up名字)", content: exactContent },
    { name: "正则匹配(Up/标题)", content: regexContent },
    { name: "屏蔽分类", content: tnameContent },
    { name: "插件配置", content: configContent },
  ];
  tabs.forEach((tabData) => {
    const tab = document.createElement("div");
    tab.className = "bilibili-blacklist-tab";
    tab.textContent = tabData.name;
    tab.style.borderBottom =
      tabData.content.style.display === "block"
        ? "2px solid #fb7299"
        : "none";

    // 标签点击事件，切换内容显示
    tab.addEventListener("click", () => {
      tabs.forEach(({ tab: t, content: c }) => {
        t.style.borderBottom = "none";
        c.style.display = "none";
      });
      tab.style.borderBottom = "2px solid #fb7299";
      tabData.content.style.display = "block";
    });

    tabData.tab = tab; // 保存对标签元素的引用
    tabContainer.appendChild(tab);
  });

  // 创建面板头部
  const header = document.createElement("div");
  header.className = "bilibili-blacklist-panel-header";

  blockCountTitleElement = document.createElement("h3");
  blockCountTitleElement.title = "总数 =(UP/标题 + 广告 + CM + 分类/竖屏)";

  const closeBtn = document.createElement("button");
  closeBtn.className = "bilibili-blacklist-panel-close";
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", () => {
    managerPanel.style.display = "none";
  });

  header.appendChild(blockCountTitleElement);
  header.appendChild(closeBtn);

  const contentContainer = document.createElement("div");
  contentContainer.className = "bilibili-blacklist-panel-body";

  // 精确匹配添加输入框和按钮
  const addExactContainer = document.createElement("div");
  addExactContainer.className = "bilibili-blacklist-add-row";

  const exactInput = document.createElement("input");
  exactInput.type = "text";
  exactInput.placeholder = "输入要屏蔽的UP主名称";

  const addExactBtn = document.createElement("button");
  addExactBtn.className = "bilibili-blacklist-primary-btn";
  addExactBtn.textContent = "添加";
  addExactBtn.addEventListener("click", () => {
    const upName = exactInput.value.trim();
    if (upName) {
      addToExactBlacklist(upName);
      exactInput.value = "";
    }
  });
  addExactContainer.appendChild(exactInput);
  addExactContainer.appendChild(addExactBtn);
  exactContent.appendChild(addExactContainer);

  // 正则匹配添加输入框和按钮
  const addRegexContainer = document.createElement("div");
  addRegexContainer.className = "bilibili-blacklist-add-row";

  const regexInput = document.createElement("input");
  regexInput.type = "text";
  regexInput.placeholder = "输入正则表达式 (如: 小小.*Official)";

  const addRegexBtn = document.createElement("button");
  addRegexBtn.className = "bilibili-blacklist-primary-btn";
  addRegexBtn.textContent = "添加";
  addRegexBtn.addEventListener("click", () => {
    const regex = regexInput.value.trim();
    if (regex && !regexMatchBlacklist.includes(regex)) {
      try {
        new RegExp(regex); // 验证正则表达式
        regexMatchBlacklist.push(regex);
        saveBlacklistsToStorage();
        regexInput.value = "";
        refreshRegexMatchList();
      } catch (e) {
        alert("无效的正则表达式: " + e.message);
      }
    }
  });
  addRegexContainer.appendChild(regexInput);
  addRegexContainer.appendChild(addRegexBtn);
  regexContent.appendChild(addRegexContainer);

  // 创建列表元素
  exactMatchListElement = document.createElement("ul");
  exactMatchListElement.id = "bilibili-blacklist-exact-list";

  regexMatchListElement = document.createElement("ul");
  regexMatchListElement.id = "bilibili-blacklist-regex-list";

  tagNameListElement = document.createElement("ul");
  tagNameListElement.id = "bilibili-blacklist-tname-list";

  configListElement = document.createElement("ul");
  configListElement.id = "bilibili-blacklist-config-list";

  refreshAllPanelTabs(); // 初始化所有标签页内容
  exactContent.appendChild(exactMatchListElement);
  regexContent.appendChild(regexMatchListElement);
  tnameContent.appendChild(tagNameListElement);
  configContent.appendChild(configListElement);

  contentContainer.appendChild(exactContent);
  contentContainer.appendChild(regexContent);
  contentContainer.appendChild(tnameContent);
  contentContainer.appendChild(configContent);

  managerPanel.appendChild(tabContainer);
  managerPanel.appendChild(header);
  managerPanel.appendChild(contentContainer);

  document.body.appendChild(managerPanel);
  return managerPanel;
}

/**
 * 为插件添加全局CSS样式。
 */
GM_addStyle(`
  /* ===== 屏蔽按钮容器 ===== */
  .bilibili-blacklist-block-container {
    display: none;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    padding: 2px;
    font-size: 12px;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    gap: 3px;
    z-index: 9999;
    pointer-events: none;
  }

  .bili-video-card:hover .bilibili-blacklist-block-container,
  .card-box:hover .bilibili-blacklist-block-container,
  .bilibili-blacklist-block-container-host:hover .bilibili-blacklist-block-container {
    display: flex !important;
  }

  .card-box .bilibili-blacklist-block-container {
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    height: 100%;
  }

  .card-box .bilibili-blacklist-tname-group {
    flex-direction: column;
    align-items: flex-end;
    margin-top: auto;
  }

  /* btn / reason / tname 共用基础外观 */
  .bilibili-blacklist-block-btn,
  .bilibili-blacklist-block-reason,
  .bilibili-blacklist-tname {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 20px;
    padding: 0 6px;
    box-sizing: border-box;
    font-size: 12px;
    line-height: 1;
    color: white;
    text-align: center;
    white-space: nowrap;
    border: none;
    border-radius: 2px;
  }

  .bilibili-blacklist-block-btn {
    position: static;
    width: 40px;
    pointer-events: auto !important;
    background-color: #fb7299dd;
    cursor: pointer;
  }

  .bilibili-blacklist-block-reason {
    background-color: #f56c6c;
    pointer-events: none;
  }

  .bilibili-blacklist-tname-group {
    display: flex;
    flex-direction: row;
    padding: 0 5px;
    gap: 3px;
    align-items: center;
    margin-left: auto;
    max-width: 80%;
    pointer-events: none;
  }

  .bilibili-blacklist-tname {
    background-color: #fb7299dd;
    text-overflow: ellipsis;
    overflow: hidden;
    pointer-events: auto;
    cursor: pointer;
  }

  /* ===== 修复视频卡片布局 ===== */
  .bili-video-card__cover {
    contain: layout !important;
  }

  /* ===== 管理面板 ===== */
  #bilibili-blacklist-manager-panel {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 500px;
    max-height: 80vh;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 99999;
    overflow: hidden;
    display: none;
    flex-direction: column;
    font-size: 15px;
    color: var(--text2, #000);
    background-color: var(--bg1, #fff);
    opacity: 0.85;
  }

  #bilibili-blacklist-manager-panel h3,
  #bilibili-blacklist-manager-panel h4 {
    color: var(--text2, #000);
  }

  #bilibili-blacklist-manager-panel h3 {
    margin: 0;
    font-weight: 500;
  }

  #bilibili-blacklist-manager-panel h4 {
    font-weight: bold;
    margin-bottom: 12px;
  }

  #bilibili-blacklist-manager-panel ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  #bilibili-blacklist-manager-panel hr {
    margin: 12px 0;
    border: none;
    border-top: 2px solid #ddd;
  }

  /* 按钮基础交互 */
  #bilibili-blacklist-manager-panel button {
    transition: background-color 0.2s;
  }

  #bilibili-blacklist-manager-panel button:hover {
    opacity: 0.9;
  }

  /* 输入框 */
  #bilibili-blacklist-manager-panel input:focus {
    outline: none;
    border-color: #fb7299 !important;
  }

  #bilibili-blacklist-manager-panel input[type="text"] {
    flex: 1;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  #bilibili-blacklist-manager-panel select {
    flex: 1;
    min-width: 120px;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    color: var(--text2, #000);
    background-color: var(--bg1, #fff);
  }

  .bilibili-blacklist-setting-select-row {
    margin-bottom: 8px;
  }

  /* 面板结构 */
  .bilibili-blacklist-tabs {
    display: flex;
    border-bottom: 1px solid #f1f2f3;
  }

  .bilibili-blacklist-tab {
    padding: 12px 16px;
    cursor: pointer;
    font-weight: 500;
  }

  .bilibili-blacklist-panel-content {
    padding: 16px;
    overflow-y: auto;
    flex: 1;
  }

  .bilibili-blacklist-panel-header {
    padding: 16px;
    border-bottom: 1px solid #f1f2f3;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .bilibili-blacklist-panel-close {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0 8px;
    color: var(--text2, #000);
  }

  .bilibili-blacklist-panel-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
  }

  /* 布局行 */
  .bilibili-blacklist-panel-row,
  .bilibili-blacklist-add-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .bilibili-blacklist-panel-row > span:first-child {
    flex: 1;
  }

  .bilibili-blacklist-add-row {
    margin-bottom: 16px;
  }

  .bilibili-blacklist-setting-toggle {
    margin-bottom: 8px;
  }

  .bilibili-blacklist-setting-input-row {
    margin-top: 16px;
  }

  .bilibili-blacklist-temp-toggle {
    margin: 20px 0;
  }

  .bilibili-blacklist-cache-control {
    margin-bottom: 8px;
  }

  /* 列表项 */
  .bilibili-blacklist-list-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #f1f2f3;
  }

  .bilibili-blacklist-list-item > span {
    flex: 1;
  }

  .bilibili-blacklist-empty {
    text-align: center;
    padding: 16px;
    color: #999;
  }

  /* 按钮 */
  .bilibili-blacklist-panel-btn,
  .bilibili-blacklist-config-btn,
  .bilibili-blacklist-primary-btn {
    color: #fff;
    border: none;
    cursor: pointer;
  }

  .bilibili-blacklist-panel-btn {
    padding: 4px 8px;
    border-radius: 4px;
  }

  .bilibili-blacklist-config-btn {
    padding: 6px 12px;
    border-radius: 4px;
  }

  .bilibili-blacklist-config-btn-primary {
    background-color: #fb7299;
  }

  .bilibili-blacklist-config-btn-danger {
    background-color: #f56c6c;
  }

  .bilibili-blacklist-primary-btn {
    padding: 8px 16px;
    background: #fb7299;
    border-radius: 4px;
  }

  .bilibili-blacklist-number-input {
    width: 100px;
    padding: 6px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }

  /* ===== 顶栏管理按钮 ===== */
  #bilibili-blacklist-manager-button {
    cursor: pointer;
  }

  #bilibili-blacklist-manager-button .right-entry-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  #bilibili-blacklist-manager-button .right-entry__outside {
    margin-bottom: -5px;
  }

  #bilibili-blacklist-manager-button:hover svg {
    transform: scale(1.1);
  }

  #bilibili-blacklist-manager-button svg {
    transition: transform 0.2s;
  }

  /* ===== 卡比覆盖层 ===== */
  #bilibili-blacklist-kirby {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: none;
    z-index: 10;
    border-radius: 6px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: opacity ${KIRBY_FADE_DURATION_MS / 1000}s ease;
  }

  #bilibili-blacklist-kirby.bilibili-blacklist-kirby-video {
    justify-content: flex-start;
    
  }

  #bilibili-blacklist-kirby svg {
    opacity: 0.15;
    filter: none;
    margin-top: -40px;
  }

  #bilibili-blacklist-kirby.bilibili-blacklist-kirby-video svg {
    margin-top: -10px;
  }

  /* ===== 用户空间页屏蔽按钮 ===== */
  .bilibili-blacklist-up-block-btn-host {
    display: inline-flex;
    align-items: center;
  }

  .bilibili-blacklist-up-block-btn {
    width: 100px;
    height: 30px;
    margin-left: 10px;
    color: #fff;
    border-radius: 5px;
    border: 1px solid #fb7299;
  }

  /* ===== 灰度效果 ===== */
  .bilibili-blacklist-grayscale {
    filter: grayscale(95%);
  }
`);

/**
 * 返回卡比图标的SVG代码。
 * @returns {string} SVG字符串。
 */
function getKirbySVG() {
  return `
      <svg width="35" height="35" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"  >
          <ellipse cx="70" cy="160" rx="30" ry="15" fill="#cc3333" />
          <ellipse cx="130" cy="160" rx="30" ry="15" fill="#cc3333" />
          <ellipse cx="50" cy="120" rx="20" ry="20" fill="#ffb6c1" />
          <ellipse cx="150" cy="120" rx="20" ry="20" fill="#ffb6c1" />
          <circle cx="100" cy="110" r="60" fill="#ffb6c1" />
          <ellipse cx="80" cy="90" rx="10" ry="22" fill="blue" />
          <ellipse cx="80" cy="88" rx="10" ry="15" fill="black" />
          <ellipse cx="80" cy="82" rx="8" ry="12" fill="#ffffff" />
          <ellipse cx="80" cy="90" rx="10" ry="22" fill="#00000000" stroke="#000000" strokeWidth="4" />
          <ellipse cx="120" cy="90" rx="10" ry="22" fill="blue" />
          <ellipse cx="120" cy="88" rx="10" ry="15" fill="black" />
          <ellipse cx="120" cy="82" rx="8" ry="12" fill="#ffffff" />
          <ellipse cx="120" cy="90" rx="10" ry="22" fill="#00000000" stroke="#000000" strokeWidth="4" />
          <ellipse cx="60" cy="110" rx="8" ry="5" fill="#ff4466" />
          <ellipse cx="140" cy="110" rx="8" ry="5" fill="#ff4466" />
          <path d="M 90 118 Q 100 125, 110 118" stroke="black" strokeWidth="3" fill="transparent" />
      </svg>
  `;
}

/**
 * 渐显卡比覆盖层（鼠标移开后恢复遮挡）。
 * @param {HTMLElement} overlay - 卡比覆盖层元素。
 */
function fadeInKirbyOverlay(overlay) {
  if (!overlay) return;
  const pendingTimer = kirbyFadeTimers.get(overlay);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    kirbyFadeTimers.delete(overlay);
  }
  overlay.style.display = "flex";
  overlay.style.opacity = "0";
  void overlay.offsetHeight; // 强制重排以触发过渡动画
  overlay.style.opacity = "1";
}

/**
 * 渐隐卡比覆盖层（悬停临时显示视频）。
 * @param {HTMLElement} overlay - 卡比覆盖层元素。
 */
function fadeOutKirbyOverlay(overlay) {
  if (!overlay) return;
  const pendingTimer = kirbyFadeTimers.get(overlay);
  if (pendingTimer) clearTimeout(pendingTimer);
  overlay.style.opacity = "0";
  kirbyFadeTimers.set(
    overlay,
    setTimeout(() => {
      kirbyFadeTimers.delete(overlay);
      if (overlay.isConnected && overlay.style.opacity === "0") {
        overlay.style.display = "none";
      }
    }, KIRBY_FADE_DURATION_MS)
  );
}

/**
 * 取消卡比覆盖层的渐隐/渐显计时器。
 * @param {HTMLElement} overlay - 卡比覆盖层元素。
 */
function cancelKirbyFade(overlay) {
  if (!overlay) return;
  const pendingTimer = kirbyFadeTimers.get(overlay);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    kirbyFadeTimers.delete(overlay);
  }
}

/**
 * 恢复所有被悬停临时显示的视频遮罩。
 */
function restoreAllBlockedVideoOverlays() {
  if (isShowAllVideos) return;
  blockedVideoCards.forEach((card) => {
    const overlay = card.querySelector("#bilibili-blacklist-kirby");
    if (overlay) fadeInKirbyOverlay(overlay);
  });
}

/**
 * 为被遮挡的视频卡片绑定悬停临时显示行为。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 */
function bindHoverRevealToCard(cardElement) {
  if (hoverRevealBoundCards.has(cardElement)) return;
  hoverRevealBoundCards.add(cardElement);

  cardElement.addEventListener("mouseenter", () => {
    const realCard = getRealVideoCardElement(cardElement);
    if (
      !globalPluginConfig.flagHoverReveal ||
      isShowAllVideos ||
      !blockedVideoCards.has(realCard)
    ) {
      return;
    }

    const overlayOnEnter = cardElement.querySelector(
      "#bilibili-blacklist-kirby"
    );
    // 若正在渐隐，先取消，避免悬停期间遮罩消失
    cancelKirbyFade(overlayOnEnter);

    const existingTimer = hoverRevealTimers.get(cardElement);
    if (existingTimer) clearTimeout(existingTimer);

    const delaySeconds = Math.min(
      5,
      Math.max(0.1, Number(globalPluginConfig.hoverRevealDelaySeconds) || 1)
    );
    const timer = setTimeout(() => {
      hoverRevealTimers.delete(cardElement);
      if (!globalPluginConfig.flagHoverReveal || isShowAllVideos) return;

      const overlay = cardElement.querySelector(
        "#bilibili-blacklist-kirby"
      );
      if (overlay && blockedVideoCards.has(realCard)) {
        fadeOutKirbyOverlay(overlay);
      }
    }, delaySeconds * 1000);
    hoverRevealTimers.set(cardElement, timer);
  });

  cardElement.addEventListener("mouseleave", () => {
    const timer = hoverRevealTimers.get(cardElement);
    if (timer) {
      clearTimeout(timer);
      hoverRevealTimers.delete(cardElement);
    }

    if (isShowAllVideos) return;
    const overlay = cardElement.querySelector("#bilibili-blacklist-kirby");
    if (
      overlay &&
      blockedVideoCards.has(getRealVideoCardElement(cardElement))
    ) {
      fadeInKirbyOverlay(overlay);
    }
  });
}

/**
 * 为视频卡片添加卡比主题的覆盖层。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 */
function addKirbyOverlayToCard(cardElement) {
  bindHoverRevealToCard(cardElement);
  // 如果已经有Kirby覆盖层，则不重复添加
  if (cardElement.querySelector("#bilibili-blacklist-kirby") != null) return;
  const kirbyWrapper = document.createElement("div");
  kirbyWrapper.innerHTML = getKirbySVG();
  kirbyWrapper.id = "bilibili-blacklist-kirby";
  if (isCurrentPageVideo()) {
    kirbyWrapper.classList.add("bilibili-blacklist-kirby-video");
  }

  const svg = kirbyWrapper.querySelector("svg");
  if (svg) {
    const cardRect = cardElement.getBoundingClientRect();
    const size = Math.min(cardRect.width, cardRect.height) * 0.8;
    svg.setAttribute("width", `${size}px`);
    svg.setAttribute("height", `${size}px`);
  }

  const hostElement = isCurrentPageCategory()
    ? cardElement.querySelector(".bili-video-card") || cardElement
    : cardElement;

  // 确保宿主元素有position属性以便子元素绝对定位
  const hostStyle = getComputedStyle(hostElement);
  if (hostStyle.position === "static" || !hostStyle.position) {
    hostElement.style.position = "relative";
  }

  hostElement.appendChild(kirbyWrapper);
}

/**
 * 从视频卡片中移除卡比覆盖层。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 */
function removeKirbyOverlay(cardElement) {
  const kirbyWrapper = cardElement.querySelector("#bilibili-blacklist-kirby");
  if (kirbyWrapper) {
    kirbyWrapper.remove();
  }
}
