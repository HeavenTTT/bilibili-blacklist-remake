/*
 * 开发/测试专用模块（仅 dev 构建注入）
 */
if (typeof __DSH_DEV__ !== "undefined" && __DSH_DEV__) {
  function __blockTestRun(n) {
    const buttons = Array.from(
      document.querySelectorAll(".bilibili-blacklist-block-btn")
    );
    if (buttons.length === 0) {
      return {
        ok: false,
        reason: "未找到任何屏蔽按钮（脚本是否已加载？当前页面是否有视频卡片？）"
      };
    }
    const preBlacklist = exactMatchBlacklist.slice();
    const seen = new Set();
    const targets = [];
    for (const btn of buttons) {
      const up = (btn.dataset.upName || "").trim();
      if (!up || seen.has(up)) continue;
      if (preBlacklist.indexOf(up) !== -1) continue; // 已屏蔽，跳过
      seen.add(up);
      targets.push({ btn, up });
      if (targets.length >= n) break;
    }

    const result = { total: targets.length, pass: 0, fail: 0, failures: [] };
    for (const { btn, up } of targets) {
      const card = findCardForButton(btn);
      try {
        btn.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true })
        );
      } catch (e) {
        result.fail++;
        result.failures.push({ up, reason: "click dispatch error: " + (e && e.message) });
        continue;
      }
      let blocked = false;
      if (card) {
        const real = getRealVideoCardElement(card);
        if (
          real &&
          (real.style.display === "none" ||
            real.querySelector("#bilibili-blacklist-kirby"))
        ) {
          blocked = true;
        }
      }
      if (blocked && card) {
        result.pass++;
      } else {
        result.fail++;
        result.failures.push({
          up,
          reason: blocked ? "card not found" : "card not blocked"
        });
      }
      const idx = exactMatchBlacklist.indexOf(up);
      if (idx !== -1) {
        exactMatchBlacklist.splice(idx, 1);
        saveBlacklistsToStorage();
        refreshExactMatchList();
      }
      restoreCardsForUp(up);
    }
    return result;
  }

  function restoreCardsForUp(up) {
    const cards = queryAllVideoCards();
    if (!cards) return;
    cards.forEach((c) => {
      const info = getVideoCardInfo(c);
      if (up && info.upName && info.upName.trim() !== up) return;
      const real = getRealVideoCardElement(c);
      if (real && blockedVideoCards.has(real)) {
        blockedVideoCards.delete(real);
        removeKirbyOverlay(c);
        removeBlockReason(c);
        real.style.display = "";
        real.style.visibility = "";
      }
    });
  }

  /**
   * 面板自检（dev 专用）：把「关闭按钮是否够大/有底色/可点击不遮挡」「点击能否关面板」
   * 「统计明细行是否齐全」等结论直接打到 console。
   *
   * 为什么要用程序化点击 + elementFromPoint：外部自动化（合成鼠标事件）点到我们注入的
   * 元素时，可能因为 B 站自身的浮层遮挡而落到别的元素上，光看"点了没反应"无法区分
   * 「按钮坏了」还是「被挡住了」。这里两者都能测出来。
   * @returns {string[]} 每项一行结论。
   */
  function __panelSelfCheck() {
    const results = [];
    const assert = (name, ok, extra) =>
      results.push(
        (ok ? "PASS " : "FAIL ") + name + (ok || extra === undefined ? "" : " -> " + extra)
      );
    const hitInfo = (el) => {
      const rect = el.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2
      );
      return { rect, hit, reachable: !!hit && (hit === el || el.contains(hit)) };
    };

    const panel = document.getElementById("bilibili-blacklist-manager-panel");
    assert("面板已创建", !!panel);
    if (!panel) return results;

    panel.style.display = "flex";
    assert("面板可打开(display:flex)", panel.style.display === "flex");

    const closeBtn = panel.querySelector(".bilibili-blacklist-panel-close");
    assert("关闭按钮存在", !!closeBtn);
    if (closeBtn) {
      assert("关闭按钮含 SVG 图标", !!closeBtn.querySelector("svg"));
      const info = hitInfo(closeBtn);
      assert(
        "关闭按钮尺寸 >= 30x30",
        info.rect.width >= 30 && info.rect.height >= 30,
        Math.round(info.rect.width) + "x" + Math.round(info.rect.height)
      );
      const bg = getComputedStyle(closeBtn).backgroundColor;
      assert("关闭按钮有底色", !!bg && bg !== "rgba(0, 0, 0, 0)", bg);
      assert(
        "关闭按钮可被点中(无遮挡)",
        info.reachable,
        info.hit ? info.hit.tagName + "." + (info.hit.className || "") : "null"
      );
      closeBtn.click(); // 程序化点击：绕开合成鼠标坐标
      assert("点击关闭按钮后隐藏", panel.style.display === "none", panel.style.display);
      panel.style.display = "flex";
    }

    const rows = panel.querySelectorAll(".bilibili-blacklist-stat-row");
    assert("统计明细 11 行", rows.length === 11, String(rows.length));

    // 展开/收起按钮：默认收起、位于关闭按钮左边、点击能切换
    const stats = panel.querySelector(".bilibili-blacklist-stats");
    const toggleBtn = panel.querySelector(".bilibili-blacklist-panel-toggle");
    assert("展开按钮存在", !!toggleBtn);
    if (toggleBtn && stats) {
      assert("展开按钮含 SVG 图标", !!toggleBtn.querySelector("svg"));
      assert("统计明细默认收起", stats.style.display === "none", stats.style.display || "(空)");
      if (closeBtn) {
        const toggleRect = toggleBtn.getBoundingClientRect();
        const closeRect = closeBtn.getBoundingClientRect();
        assert(
          "展开按钮在关闭按钮左边",
          toggleRect.right <= closeRect.left + 1,
          Math.round(toggleRect.right) + " <= " + Math.round(closeRect.left)
        );
      }
      toggleBtn.click();
      assert("点击展开按钮后显示明细", stats.style.display !== "none", stats.style.display || "(空)");
      assert(
        "展开后按钮标记为已展开",
        toggleBtn.classList.contains("is-expanded") &&
          toggleBtn.getAttribute("aria-expanded") === "true",
        toggleBtn.getAttribute("aria-expanded")
      );
      toggleBtn.click();
      assert("再点一次收回明细", stats.style.display === "none", stats.style.display || "(空)");
      toggleBtn.click(); // 留在展开态，方便截图/看数值
    }

    const labels = Array.prototype.map
      .call(rows, (r) => (r.children[0].textContent || "").trim())
      .join(",");
    assert(
      "统计项齐全",
      labels ===
        "UP/标题名,广告,CM 软广,分类标签,视频标签,竖屏,网络拦截,拦截响应,已判定卡片,view 请求,标签请求",
      labels
    );
    const statText = Array.prototype.map
      .call(rows, (r) =>
        (r.children[0].textContent || "").trim() +
        "=" +
        (r.children[1] ? r.children[1].textContent : "?")
      )
      .join(" | ");
    results.push("INFO 当前统计: " + statText);

    // 顶栏管理按钮是否被 B 站顶栏浮层压住（真实用户能不能点到）
    const headerBtn = document.querySelector("#bilibili-blacklist-manager-button");
    if (headerBtn) {
      const icon = headerBtn.querySelector(".right-entry__outside") || headerBtn;
      const info = hitInfo(icon);
      results.push(
        "INFO 顶栏按钮: 尺寸 " +
          Math.round(info.rect.width) +
          "x" +
          Math.round(info.rect.height) +
          " 中心命中 " +
          (info.hit ? info.hit.tagName + "." + (info.hit.className || "") : "null") +
          " => " +
          (info.reachable ? "可点" : "被遮挡")
      );
    }
    return results;
  }

  /**
   * 按 URL 标记自动打开管理面板并跑一次自检，便于无头/自动化验收（无需点顶栏按钮）。
   * 用法：在地址栏加 #bl-open-panel（或 ?bl_open_panel=1）。
   * 只在 dev 构建里生效，且只有带标记时才动手，不影响日常开发使用。
   */
  function __autoOpenPanelIfRequested() {
    const params = new URLSearchParams(location.search);
    const requested =
      location.hash.indexOf("bl-open-panel") !== -1 ||
      params.get("bl_open_panel") === "1";
    if (!requested) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      if (managerPanel) {
        clearInterval(timer);
        managerPanel.style.display = "flex";
        console.log("[🫥BlackList][dev] 已按 URL 标记自动打开管理面板");
        __panelSelfCheck().forEach((line) =>
          console.log("[🫥BlackList][dev][自检] " + line)
        );
        return;
      }
      if (tries > 40) clearInterval(timer); // 最多等 10s（面板在 initializeScript 里创建）
    }, 250);
  }

  window.__blacklistConfig = globalPluginConfig;
  window.__blacklistInterceptors = {
    install: installNetworkInterceptors,
    config: NET_INTERCEPT
  };
  window.__blacklistExpose = {
    stats: function () {
      return {
        blocked: blockedVideoCards.size,
        info: countBlockInfo,
        ad: countBlockAD,
        cm: countBlockCM,
        tname: countBlockTName,
        videoTag: countBlockVideoTag,
        vertical: countBlockVertical,
        processedCards: countProcessedCards,
        apiViewRequests: countApiViewRequests,
        apiTagRequests: countApiTagRequests,
        networkInterceptItems: countNetworkInterceptItems,
        networkInterceptResponses: countNetworkInterceptResponses
      };
    },
    // 面板开关（自动化/调试用，省得去点顶栏那个按钮）
    panel: {
      open: function () {
        if (managerPanel) managerPanel.style.display = "flex";
      },
      close: function () {
        if (managerPanel) managerPanel.style.display = "none";
      },
      toggle: function () {
        if (!managerPanel) return;
        managerPanel.style.display =
          managerPanel.style.display === "flex" ? "none" : "flex";
      }
    },
    testBlock100: function (n) {
      return __blockTestRun(Number(n) > 0 ? Number(n) : 100);
    }
  };

  __autoOpenPanelIfRequested();

  console.log(
    "[🫥BlackList][dev] 已注入调试/测试入口：window.__blacklistConfig / " +
    "window.__blacklistInterceptors / window.__blacklistExpose（测试方法仅在 dev 构建生效）"
  );
}