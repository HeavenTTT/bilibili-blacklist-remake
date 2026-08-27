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
 */
function initializeVideoPage() {
  // 视频页延迟 5 秒启动功能
  console.log("[🫥BlackList] 播放页已加载，将延迟 5 秒启动功能。🍇");
  const flag = globalPluginConfig.flagSkipBlockedAutoplay;
  globalPluginConfig.flagSkipBlockedAutoplay = "off";
  // 延迟 5 秒执行核心功能
  setTimeout(() => {
    initializeObserver("right-container"); // 观察视频播放页右侧推荐区域
    // 首次手动扫描和广告屏蔽
    scanAndBlockVideoCards();
    blockVideoPageAds();
    // 自动连播遇到被屏蔽视频时的处理（停止/切换/不处理，由用户配置）
    initAutoplaySkip();
    // 视频页在页面内切集后，右侧推荐会原地重建；观察器可能绑定到已替换的节点，
    // 因此恢复旧版的定时补扫，确保新加载的卡片也能被处理（内部有节流与去重）。
    setInterval(() => {
      scanAndBlockVideoCards();
    }, 2500);
    // 恢复自动连播配置：仅当用户没有在面板里改过时才恢复，避免覆盖用户新设置
    setTimeout(() => {
      if (globalPluginConfig.flagSkipBlockedAutoplay === "off") {
        globalPluginConfig.flagSkipBlockedAutoplay = flag; // 第一次打开页面时无论如何不做处理
      }
    }, 2500);
    // 顶栏可能有数秒延迟渲染，若在这之前已超过6个li，手动补挂管理按钮
    addBlacklistManagerButton();
    
    console.log("[🫥BlackList] 视频播放页屏蔽功能已启动。");
  }, 5000); // 5000 毫秒 = 5 秒
  
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