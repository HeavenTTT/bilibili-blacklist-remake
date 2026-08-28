/*
 * 页面模块
 * -----------------------------------------------------------
 * 按页面类型初始化并在 DOM 就绪后启动脚本。
 */
/**
 * 根据当前页面初始化脚本。
 */
function initializeScript() {
  if (!isfirstLoad) return;
  isfirstLoad = false;
  // 重置状态变量
  isBlockingOperationInProgress = false;
  lastBlockScanExecutionTime = 0;
  blockedVideoCards = new Set();
  videoCardProcessQueue = new Set();
  processedVideoCards = new WeakSet();
  tnameRetriedCards = new WeakSet(); // 重置 tname 解析失败重试记录

  // 统一的事件委托：所有“屏蔽/标签”按钮共用一个监听器，避免每按钮各自绑定点击导致失效。
  setupCardButtonDelegation();

  // 根据当前页面URL判断并初始化
  if (isCurrentPageMain()) {
    initializeMainPage();
    blockMainPageAds();
  } else if (isCurrentPageSearch()) {
    initializeSearchPage();
    blockMainPageAds(); // 搜索页也进行主页广告屏蔽
  } else if (isCurrentPageVideo()) {
    initializeVideoPage();
    updateTNameList();
  } else if (isCurrentPageCategory()) {
    initializeCategoryPage();
    updateTNameList();
  } else if (isCurrentPageRanking()) {
    initializeRankingPage();
    blockMainPageAds();
  } else if (isCurrentUserSpace()) {
    initializeUserSpace();
  } else {
    return; // 不支持的页面不进行初始化
  }
  createBlacklistPanel(); // 创建管理面板
  addBlacklistManagerButton(); // 立即挂载管理按钮，避免在视频页被迟到的顶栏渲染顶掉前不可见；后续由观察器兜底
  initTampermonkeyMenu(); // 注册油猴菜单（顶部按钮开关 / 打开管理面板）
  // 网络拦截：命中黑名单的推荐/相关条目直接在响应层过滤
  if (globalPluginConfig.flagNetworkIntercept) {
    installNetworkInterceptors();
  }
  console.log("[🫥BlackList] 脚本已加载🥔");
  
}
let isfirstLoad = true;// 监听DOMContentLoaded并检查readyState以进行早期初始化
// initializeScript 内部已通过 isfirstLoad 保证只执行一次
document.addEventListener("DOMContentLoaded", initializeScript);
// 注意：这里不再做“立即初始化”检查，因为 initializeScript() 会依赖后续模块
// （interceptor.js 的 NET_INTERCEPT / ads.js / autoplay.js）在求值后才可用。
// 若在 pages.js 段就检查 readyState 并同步调用 initializeScript()，会在这些模块
// 尚未求值时访问到的变量仍为 undefined（例如 NET_INTERCEPT.enabled），导致构建被 eval 时崩溃。
// 该“晚注入立即初始化”逻辑已移到本 IIFE 的最后（src/main.js 末尾）执行。

/**
 * 检查当前页面是否为Bilibili主页。
 * @returns {boolean} 如果是主页则返回true，否则返回false。
 */
function isCurrentPageMain() {
  return location.pathname === "/" || location.pathname === "/index.html";
}

/**
 * 初始化主页特有的功能。
 */
function initializeMainPage() {
  initializeObserver("feedchannel-main"); // 观察主页内容区域
  // 首屏卡片可能在 observer 挂载前已渲染，延迟补一次全量扫描（防漏扫）
  setTimeout(() => {
    scanAndBlockVideoCards();
  }, 800);
  console.log("[🫥BlackList] 主页已加载🍓");
}

/**
 * 检查当前页面是否为Bilibili搜索结果页。
 * @returns {boolean} 如果是搜索页则返回true，否则返回false。
 */
function isCurrentPageSearch() {
  return location.hostname === "search.bilibili.com";
}

/**
 * 初始化搜索页特有的功能。
 */
function initializeSearchPage() {
  initializeObserver("i_cecream"); // 观察搜索结果内容区域
  // 搜索结果可能在 observer 挂载前已渲染，延迟补一次全量扫描（防漏扫）
  setTimeout(() => {
    scanAndBlockVideoCards();
  }, 800);
  console.log("[🫥BlackList] 搜索页已加载🍉");
}

/**
 * 检查当前页面是否为Bilibili视频播放页。
 * @returns {boolean} 如果是视频播放页则返回true，否则返回false。
 */
function isCurrentPageVideo() {
  return location.pathname.startsWith("/video/");
}

/**
 * 初始化视频播放页特有的功能。
 *
 * [解耦重构] 策略：
 *   进入视频页时【不碰卡片 DOM、不启动观察器】，只把当前已渲染的推荐卡片标记为
 *   “未处理”状态（用 CSS filter 遮盖，不插入按钮/kirby 遮罩子元素，避免与 B 站 header
 *   的 Vue 渲染竞争 → 导致 header 被顶掉）。视频正常播放。
 *   等右侧导航栏 .right-entry 渲染完成（header 完全正常）后，再统一启动：观察器 +
 *   扫描屏蔽 + 广告屏蔽 + 自动连播 + 补扫，并逐卡判定。
 */
function initializeVideoPage() {
  console.log("[🫥BlackList] 播放页已加载（未处理卡片先 filter 遮盖，等 header 正常后启动）。🍇");
  const flag = globalPluginConfig.flagSkipBlockedAutoplay;
  globalPluginConfig.flagSkipBlockedAutoplay = "off";

  // 1) 进入页面：把当前已渲染的推荐卡片都标为“未处理”（filter 遮盖，不插 DOM 元素）
  markAllVideoCardsPending();

  // 2) 等 header 完全正常（.right-entry 渲染完成）后再启动完整处理
  
  videoHeaderReady = false;
  const timeout = setTimeout(() =>  waitForContainer(".right-entry", () => {
    videoHeaderReady = true;
    addBlacklistManagerButton();        // 顶栏就绪后才写 header 元素（管理按钮）
    refreshBlockCountDisplay();
    startVideoPageProcessing(flag);     // header 正常后才做卡片处理
  }), 5000);
;

  console.log("[🫥BlackList] 视频播放页已就绪：等待 header 正常后启动屏蔽功能。\n");
}

/**
 * [解耦] 视频页在 header 完全正常后启动的完整处理：观察器 + 首次扫描 + 广告 + 连播 + 补扫。
 * @param {string} flag - 进入时的 flagSkipBlockedAutoplay 值（用于处理完恢复）
 */
function startVideoPageProcessing(flag) {
  initializeObserver("right-container"); // 观察右侧推荐区域（等容器挂载，避免观察整页）
  // 首次主动扫描 + 广告屏蔽：header 已稳定，此时对卡片做 DOM 操作不会再顶掉 header。
  scanAndBlockVideoCards();
  blockVideoPageAds();
  // 页面内切集后右侧推荐会重建，观察器可能绑定到已替换节点；定时补扫兜底。
  setInterval(() => {
    scanAndBlockVideoCards();
  }, 2500);
  // 自动连播遇到被屏蔽视频时的处理
  initAutoplaySkip();
  // 恢复自动连播配置：仅当用户没在面板里改过时才恢复，避免覆盖用户新设置
  setTimeout(() => {
    if (globalPluginConfig.flagSkipBlockedAutoplay === "off") {
      globalPluginConfig.flagSkipBlockedAutoplay = flag;
    }
  }, 2500);
  console.log("[🫥BlackList] 视频播放页屏蔽功能已启动（header 已正常）。🍇");
}



/**
 * 检查当前页面是否为Bilibili分类页。
 * @returns {boolean} 如果是分类页则返回true，否则返回false。
 */
function isCurrentPageCategory() {
  return location.pathname.startsWith("/c/");
}

/**
 * 初始化分类页特有的功能。
 */
function initializeCategoryPage() {
  initializeObserver("app"); // 观察整个app容器
  // 分类页首屏卡片可能在 observer 挂载前已渲染，延迟补一次全量扫描（防漏扫）
  setTimeout(() => {
    scanAndBlockVideoCards();
  }, 800);
  console.log("[🫥BlackList] 分类页已加载🍊");
}

/**
 * 检查当前页面是否为Bilibili排行榜页。
 * @returns {boolean} 如果是排行榜页则返回true，否则返回false。
 */
function isCurrentPageRanking() {
  return /^\/v\/popular\/rank/.test(location.pathname);
}

/**
 * 初始化排行榜页特有的功能。
 */
function initializeRankingPage() {
  initializeObserver("app"); // 排行榜页卡片容器（不存在时 observer 回退到整个文档）
  // 排行榜卡片可能在 observer 挂载前已渲染，延迟做一次初始扫描
  setTimeout(() => {
    scanAndBlockVideoCards();
  }, 600);
  console.log("[🫥BlackList] 排行榜页已加载🏆");
}

/**
 * 检查当前页面是否为Bilibili用户空间页。
 * @returns {boolean} 如果是用户空间页则返回true，否则返回false。
 */
function isCurrentUserSpace() {
  return location.hostname === "space.bilibili.com";
}

/**
 * 初始化用户空间页特有的功能。
 */
function initializeUserSpace() {
  console.log("[🫥BlackList] 用户空间已加载🍎");
  const upNameSelector = "#h-name, .nickname"; // UP主名称的选择器
  // 创建一个MutationObserver来等待UP主名称元素加载
  const observerForUpName = new MutationObserver((mutations, observer) => {
    const upNameElement = document.querySelector(upNameSelector);
    if (upNameElement) {
      observer.disconnect(); // 找到元素后停止观察
      addBlockButtonToUserSpace(upNameElement);
    }
  });

  observerForUpName.observe(document.body, {
    childList: true,
    subtree: true,
  });
  // 立即检查一次，如果元素已经存在则直接处理
  const initialUpNameElement = document.querySelector(upNameSelector);
  if (initialUpNameElement) {
    observerForUpName.disconnect();
    addBlockButtonToUserSpace(initialUpNameElement);
  }
}

/**
 * 在用户空间页面上的UP主名称元素添加屏蔽/取消屏蔽按钮。
 * @param {HTMLElement} upNameElement - 包含UP主名称的元素。
 */
function addBlockButtonToUserSpace(upNameElement) {
  const upName = upNameElement.textContent.trim();
  // 避免重复添加按钮
  if (upNameElement.querySelector(".bilibili-blacklist-up-block-btn")) {
    return;
  }

  // 调整UP主名称元素的样式，以便容纳按钮
  upNameElement.classList.add("bilibili-blacklist-up-block-btn-host");

  const button = document.createElement("button");
  button.className = "bilibili-blacklist-up-block-btn";
  button.textContent = "屏蔽";

  // 刷新按钮状态和页面灰度效果
  const refreshButtonStatus = () => {
    const blocked = isBlacklisted(upName);
    if (blocked) {
      button.textContent = "已屏蔽";
      button.style.backgroundColor = "#dddddd";
      button.style.border = "1px solid #ccc";
      upNameElement.style.textDecoration = "line-through"; // 添加删除线
      document.body.classList.add("bilibili-blacklist-grayscale"); // 添加灰度滤镜
    } else {
      button.textContent = "屏蔽";
      button.style.backgroundColor = "#fb7299";
      button.style.border = "1px solid #fb7299";
      upNameElement.style.textDecoration = "none"; // 移除删除线
      document.body.classList.remove("bilibili-blacklist-grayscale"); // 移除灰度滤镜
    }
  };

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    const blocked = isBlacklisted(upName);
    if (blocked) {
      removeFromExactBlacklist(upName);
    } else {
      addToExactBlacklist(upName);
    }
    refreshButtonStatus(); // 更新按钮状态
  });

  refreshButtonStatus(); // 设置按钮初始状态

  upNameElement.appendChild(button);
}