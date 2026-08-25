  // (未启用) 页面可见性暂停处理已被移除

  // 监听窗口焦点获取 (用户请求停用)
  /*
  window.addEventListener("focus", () => {
    isPageCurrentlyActive = true;
  });
  */

  // 监听窗口焦点失去 (用户请求停用)
  /*
  window.addEventListener("blur", () => {
    isPageCurrentlyActive = false;
  });
  */

  // MutationObserver 检测动态加载的新内容
  const contentObserver = new MutationObserver((mutations) => {
    let shouldCheck = false;
    // 只要有新节点/元素添加就触发扫描（不做可见尺寸过滤）
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length > 0) {
        shouldCheck = true;
      }
    });

    if (shouldCheck) {
      // 使用setTimeout延迟扫描，避免短时间内多次触发

      setTimeout(() => {
        scanAndBlockVideoCards();
        if (isCurrentPageMain()) {
          blockMainPageAds(); // 主页广告屏蔽
        }
        if (isCurrentPageVideo()) {
          blockVideoPageAds(); // 视频页广告屏蔽
        }
        if (!document.getElementById("bilibili-blacklist-manager-button")) {
         // addBlacklistManagerButton(); // 确保管理按钮存在
        }
        
      }, globalPluginConfig.blockScanInterval);
    }
  });

  /**
   * 在指定容器上初始化MutationObserver。
   * @param {string} containerIdOrSelector - 要观察的容器的ID或CSS选择器。
   */
  function initializeObserver(containerIdOrSelector) {
    const rootNode =
      document.getElementById(containerIdOrSelector) ||
      document.querySelector(containerIdOrSelector) ||
      document.documentElement; // 默认观察整个文档

    contentObserver.observe(rootNode, {
      childList: true,
      subtree: true,
    });
  }