/*
 * 主入口模块
 * -----------------------------------------------------------
 * 页面功能初始化在 src/pages/pages.js（分页初始化 + 管理面板）。
 * 本文件负责：暴露调试/网络拦截入口，以及一个“屏蔽按钮 100 次点击”的
 * 非破坏性自动化测试入口（配合 TEST_FLOW.md 使用）。
 */

// ---- 调试/测试入口：无论文档就绪状态如何都挂到 window，便于在控制台调用 ----
// 非破坏性地验证“屏蔽 UP 按钮”点击是否生效：对每个按钮派发一次真实 click
// （走统一事件委托），检查对应卡片是否被屏蔽，再还原黑名单与卡片显示。
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
  // 测试前的精确黑名单快照：跳过“本来就被屏蔽”的 UP，只测新加入能生效的
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
      // 派发真实 click，走 document 捕获阶段的统一事件委托（不依赖 hover 可见）
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
    // 还原：移除本次测试新增的黑名单项 + 还原该 UP 命中的卡片显示
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

// 还原某个 UP 测试过程中被 hideAllCardsByUpName 隐藏的卡片
function restoreCardsForUp(up) {
  const cards = queryAllVideoCards();
  if (!cards) return;
  cards.forEach((c) => {
    const info = getVideoCardInfo(c);
    // 只还原本次测试的 UP（其 upName 一致），其它已屏蔽卡片不动
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
  // 测试入口：window.__blacklistExpose.testBlock100(100) -> {total,pass,fail,failures}
  testBlock100: function (n) {
    return __blockTestRun(Number(n) > 0 ? Number(n) : 100);
  }
};

// 兼容 dev 加载器晚注入：当构建在 DOMContentLoaded 之后、load 之前被 eval 时
// （document.readyState === "interactive"/"complete"），上面的 DOMContentLoaded 监听已错过，
// 需要在全部模块求值完毕后立即初始化一次。
// 注意：必须放在本 IIFE 的最后。initializeScript() 会依赖 interceptor.js 的 NET_INTERCEPT、
// ads.js、autoplay.js 等在 pages.js 之后求值的模块；在 pages.js 段同步调用会因这些
// 变量尚未求值（NET_INTERCEPT 为 undefined）而抛错。这里所有模块已求值，可安全调用。
if (
  (document.readyState === "complete" || document.readyState === "interactive") &&
  typeof isfirstLoad !== "undefined" &&
  isfirstLoad
) {
  initializeScript();
}
