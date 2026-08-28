/*
 * 视频数据模块
 * -----------------------------------------------------------
 * 队列串行处理，以及分类标签 / 竖屏的 API 判断。
 */
// 记录“第一次 tname 解析失败、已被重排回队列重试”的卡片（弱引用，随卡片回收释放）。
// 重试仍失败时按“无法确定是否安全”处理为屏蔽。
let tnameRetriedCards = new WeakSet();
/**
 * 获取视频卡片的链接。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 * @returns {string|null} 视频链接，如果未找到则返回null。
 */
function getCardHrefLink(cardElement) {
  const hrefLink = cardElement.querySelector("a");
  if (hrefLink) {
    return hrefLink.getAttribute("href");
  }
  return null;
}

function checkLinkCM(link) {
  if (!link) return false;
  // 如果是cm.bilibili.com的链接，且启用了CM广告屏蔽，则隐藏卡片
  if (link.match(/cm.bilibili.com/) && globalPluginConfig.flagCM) {
    return true;
  }
  return false;
}
/**
 * 从视频链接中提取BV ID。
 * @param {string} link - 视频链接。
 * @returns {string|null} BV ID，如果未找到则返回null。
 */
function getLinkBvId(link) {
  try {
    if (!link) {
      return null;
    } else {
      const bv = link.match(/BV\w+/);
      return bv ? bv[0] : null;
    }
  } catch (e) {
    return null;
  }
}

/**
 * 使用BV ID从Bilibili API获取视频信息。
 * @param {string} bvid - 视频的BV ID。
 * @returns {Promise<object|null>} 解析为视频数据或null的Promise。
 */
// BV -> view 接口数据缓存（10 分钟），避免同一视频在多个页面/队列中重复请求
const bvApiDataCache = new Map();
const BV_API_CACHE_TTL = 10 * 60 * 1000;

async function getBilibiliVideoApiData(bvid) {
  if (!bvid || bvid.length >= 24) {
    return null;
  }
  const cached = bvApiDataCache.get(bvid);
  if (cached && Date.now() < cached.expire) {
    return cached.data;
  }
  const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
  try {
    const response = await fetch(url);
    const json = await response.json();
    if (json.code === 0) {
      bvApiDataCache.set(bvid, {
        data: json.data,
        expire: Date.now() + BV_API_CACHE_TTL,
      });
      return json.data;
    } else {
      return null;
    }
  } catch (error) {
    console.error("[🫥BlackList] API 请求失败:", error);
  }
}
/**
 * 检查卡片是否包含任何黑名单标签。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 * @returns {boolean} 如果有任何标签被列入黑名单，则返回true，否则返回false。
 */
function isCardBlacklistedByTagName(cardElement) {
  const tnameGroup = cardElement.querySelector(
    ".bilibili-blacklist-tname-group"
  );
  if (tnameGroup) {
    const tnameElements = tnameGroup.querySelectorAll(
      ".bilibili-blacklist-tname"
    );
    for (const tnameElement of tnameElements) {
      const tname = tnameElement.textContent.trim();
      if (tagNameBlacklist.includes(tname)) {
        return true;
      }
      // 临时更新，根据V2查找名称
      const name = getTagNameByV2(tname);
      if (name === null) continue;
      if (tagNameBlacklist.includes(name)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * 向标签组添加一个“不重复”的标签按钮。
 * 同一分类标签可能同时出现在 data.tname / data.tname_v2 / tid_v2 映射出的 name / name_v2
 * 里，直接都加会出现重复按钮。这里按文本去重，只保留一个。
 * @param {HTMLElement} group - .bilibili-blacklist-tname-group 容器。
 * @param {string} tagName - 标签名。
 * @param {HTMLElement} card - 所属卡片。
 * @returns {boolean} 只要传入合法的标签名就返回 true（表示该卡片确实有可展示的标签）。
 */
function addTNameButtonToGroup(group, tagName, card) {
  if (tagName == null) return false;
  const name = String(tagName).trim();
  if (!name) return false;
  const existing = group.querySelectorAll(".bilibili-blacklist-tname");
  for (const el of existing) {
    if ((el.textContent || "").trim() === name) {
      return true; // 已存在重复按钮，不再新增，但视为“有标签”
    }
  }
  group.appendChild(createTNameBlockButton(name, card));
  return true;
}

/**
 * 处理视频卡片队列进行屏蔽。
 */
async function processVideoCardQueue() {
  if (isVideoCardQueueProcessing) return;
  isVideoCardQueueProcessing = true;

  while (videoCardProcessQueue.size > 0) {

    const iterator = videoCardProcessQueue.values();
    const card = iterator.next().value;
    videoCardProcessQueue.delete(card);

    if (!card || processedVideoCards.has(card)) {
      continue;
    }

    let shouldHide = false;
    let blockType = "none";
    // 如果启用了标签屏蔽且当前卡片未被隐藏
    const link = getCardHrefLink(card);
    if (checkLinkCM(link)) {
      shouldHide = true;
      blockType = "cm";
    }
    const { upName, videoTitle } = getVideoCardInfo(card);
    // 依据 UP 名/标题判定：只要解析到其中一个就参与判定（isBlacklisted 内部对空值有兜底，
    // 空 UP 名也能用正则匹标题，标题解析失败也能用 UP 名精确匹配）。
    // 若两者都解析不到，则无法确定应屏蔽，后面会恢复显示——避免“无法解析就被永久隐藏”的误伤。
    if (!shouldHide && (upName || videoTitle)) {
      // 如果UP主名称或标题在黑名单中，且启用了信息屏蔽
      if (isBlacklisted(upName, videoTitle) && globalPluginConfig.flagInfo) {
        shouldHide = true;
        blockType = "info";
      }
    }

    if (
      (globalPluginConfig.flagTName || globalPluginConfig.flagVertical) &&
      !shouldHide
    ) {
      const bvId = getLinkBvId(link);
      // 如果存在BV ID且卡片尚未添加标签组
      if (bvId && !card.querySelector(".bilibili-blacklist-tname-group")) {
        const data = await getBilibiliVideoApiData(bvId);
        if (data) {
          let tnameResolved = false; // 是否成功解析出至少一个分类标签名
          const container = card.querySelector(
            ".bilibili-blacklist-block-container"
          );
          if (container) {
            const tnameGroup = document.createElement("div");
            tnameGroup.className = "bilibili-blacklist-tname-group";
            let hasTname = false;

            // 去重添加标签按钮：同一来源/tid 映射出的不同名字重复时只保留一个
            hasTname = addTNameButtonToGroup(
              tnameGroup,
              data.tname,
              card
            ) || hasTname;
            hasTname = addTNameButtonToGroup(
              tnameGroup,
              data.tname_v2,
              card
            ) || hasTname;
            // 临时修复：仅用 tid_v2 查本地标签名
            if (data.tid_v2) {
              const obj = getTagNameById(data.tid_v2);
              if (obj) {
                hasTname = addTNameButtonToGroup(
                  tnameGroup,
                  obj.name,
                  card
                ) || hasTname;
                hasTname = addTNameButtonToGroup(
                  tnameGroup,
                  obj.name_v2,
                  card
                ) || hasTname;
              }
            }
            // 临时修复结束
            if (hasTname) {
              container.appendChild(tnameGroup);
              tnameResolved = true;
            }
          }

          if (isCardBlacklistedByTagName(card)) {
            shouldHide = true;
            blockType = "tname";
          }
          // 如果启用了垂直视频屏蔽
          if (
            data.dimension &&
            data.dimension.width &&
            data.dimension.height &&
            !shouldHide &&
            globalPluginConfig.flagVertical
          ) {
            const dimension = data.dimension.width / data.dimension.height;
            if (dimension < globalPluginConfig.verticalScaleThreshold) {
              shouldHide = true;
              blockType = "vertical";
            }
          }

          // 开启了 tname 却没能解析出任何分类标签（数据缺失/结构变化）：
          // 无法确定该卡是否命中分类黑名单，按保守策略——重排到队尾重试一次，再次失败则屏蔽。
          if (globalPluginConfig.flagTName && !shouldHide && !tnameResolved) {
            if (!tnameRetriedCards.has(card)) {
              tnameRetriedCards.add(card);
              videoCardProcessQueue.add(card); // 加入队列最后
              continue;
            }
            shouldHide = true;
            blockType = "tname";
          }
        } else if (globalPluginConfig.flagTName) {
          // API 返回 null（请求失败/限流/BV无效）：tname 解析失败。
          // 重排到队尾重试一次，再次失败则按屏蔽处理。
          if (!tnameRetriedCards.has(card)) {
            tnameRetriedCards.add(card);
            videoCardProcessQueue.add(card); // 加入队列最后
            continue;
          }
          shouldHide = true;
          blockType = "tname";
        }
      }
    }

    if (shouldHide) {
      // 命中：先去掉“未处理”filter 遮盖，再走正式遮蔽（hide / kirby 遮罩 / 模糊）
      clearPendingFilter(card);
      hideVideoCard(card, blockType);
    } else {
      // 未命中：去掉“未处理”filter 遮盖，恢复原样显示
      clearPendingFilter(card);
      const realCardToDisplay = getRealVideoCardElement(card);
      if (realCardToDisplay && blockedVideoCards.has(realCardToDisplay)) {
        blockedVideoCards.delete(realCardToDisplay);
      }
      removeBlockReason(card);
      removeKirbyOverlay(card); // 幂等：清理可能残留的遮罩（不再依赖 flagKirby）
      if (realCardToDisplay) {
        realCardToDisplay.style.display = "block";
        realCardToDisplay.style.visibility = "visible"; // 取消未处理阶段的遮盖（若有）
      }
    }

    processedVideoCards.add(card); // 标记卡片已处理

    await sleep(globalPluginConfig.processQueueInterval);
  }
  isVideoCardQueueProcessing = false;
  refreshBlockCountDisplay();
}

// 异步等待函数
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
