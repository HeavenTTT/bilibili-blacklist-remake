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
        vertical: countBlockVertical
      };
    },
    testBlock100: function (n) {
      return __blockTestRun(Number(n) > 0 ? Number(n) : 100);
    }
  };

  console.log(
    "[🫥BlackList][dev] 已注入调试/测试入口：window.__blacklistConfig / " +
    "window.__blacklistInterceptors / window.__blacklistExpose（测试方法仅在 dev 构建生效）"
  );
}