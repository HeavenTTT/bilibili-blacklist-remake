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
    } else if (isCurrentUserSpace()) {
      initializeUserSpace();
    } else {
      return; // 不支持的页面不进行初始化
    }
    createBlacklistPanel(); // 创建管理面板
    addBlacklistManagerButton(); // 立即挂载管理按钮，避免在视频页被迟到的顶栏渲染顶掉前不可见；后续由观察器兜底
    console.log("[🫥BlackList] 脚本已加载🥔");
    
  }
  let isfirstLoad = true;
  let rescanVideoPageTimer = null; // 视频页定时补充扫描定时器
  // 监听DOMContentLoaded并检查readyState以进行早期初始化
  // initializeScript 内部已通过 isfirstLoad 保证只执行一次
  document.addEventListener("DOMContentLoaded", initializeScript);
  if (document.readyState === "complete" && isfirstLoad) {
      initializeScript();
  }

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
    // **用户修改 2: 延迟 5 秒启动屏蔽功能**
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
      // (按你的选择) 已移除“视频页每 2.5 秒补扫”；仅保留一次“恢复自动连播配置”
      setTimeout(() => {
        globalPluginConfig.flagSkipBlockedAutoplay = flag; // 第一次打开页面时无论如何不做处理
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
    console.log("[🫥BlackList] 分类页已加载🍊");
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