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
// 单次接口请求超时：没有超时的话，一个挂起的请求会把整条串行队列永久卡死，
// 后面所有卡片都停在“未处理”状态（搜索页翻页后延迟十几秒的长尾来源之一）。
const BV_API_TIMEOUT_MS = 5000;

/**
 * 判断某个 BV 是否已有未过期的接口缓存。
 * 用于决定本轮是否真的发生了网络请求 —— 只有真正请求了才需要限速等待。
 * @param {string} bvid
 * @returns {boolean}
 */
function hasFreshBvApiCache(bvid) {
  if (!bvid) return false;
  const cached = bvApiDataCache.get(bvid);
  return !!(cached && Date.now() < cached.expire);
}

async function getBilibiliVideoApiData(bvid) {
  if (!bvid || bvid.length >= 24) {
    return null;
  }
  const cached = bvApiDataCache.get(bvid);
  if (cached && Date.now() < cached.expire) {
    return cached.data;
  }
  const url = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
  const controller =
    typeof AbortController === "function" ? new AbortController() : null;
  const timeoutTimer = controller
    ? setTimeout(() => controller.abort(), BV_API_TIMEOUT_MS)
    : null;
  try {
    const response = await fetch(
      url,
      controller ? { signal: controller.signal } : undefined
    );
    const json = await response.json();
    if (json.code === 0) {
      bvApiDataCache.set(bvid, {
        data: json.data,
        expire: Date.now() + BV_API_CACHE_TTL,
      });
      return json.data;
    }
    return null;
  } catch (error) {
    // 修复：原实现在 catch 里没有 return，网络异常时返回 undefined，
    // 会落到调用方的“解析失败”分支被当成应屏蔽处理，导致网络抖动时大面积误屏蔽。
    console.error("[🫥BlackList] API 请求失败:", error);
    return null;
  } finally {
    if (timeoutTimer) clearTimeout(timeoutTimer);
  }
}

// BV -> 视频标签接口数据缓存（10 分钟）
const bvTagApiDataCache = new Map();

function hasFreshBvTagApiCache(bvid) {
  if (!bvid) return false;
  const cached = bvTagApiDataCache.get(bvid);
  return !!(cached && Date.now() < cached.expire);
}

/**
 * 使用 BV ID 从 Bilibili 视频标签接口获取视频 TAG。
 * @param {string} bvid - 视频的 BV ID。
 * @returns {Promise<object|null>} 带 videoTags 字段的视频数据。
 */
async function getBilibiliVideoTagApiData(bvid) {
  if (!bvid || bvid.length >= 24) {
    return null;
  }
  const cached = bvTagApiDataCache.get(bvid);
  if (cached && Date.now() < cached.expire) {
    return cached.data;
  }
  const url = `https://api.bilibili.com/x/tag/archive/tags?bvid=${encodeURIComponent(bvid)}`;
  const controller =
    typeof AbortController === "function" ? new AbortController() : null;
  const timeoutTimer = controller
    ? setTimeout(() => controller.abort(), BV_API_TIMEOUT_MS)
    : null;
  try {
    const response = await fetch(
      url,
      controller ? { signal: controller.signal } : undefined
    );
    const json = await response.json();
    if (json.code === 0 && Array.isArray(json.data)) {
      const data = { videoTags: json.data };
      bvTagApiDataCache.set(bvid, {
        data,
        expire: Date.now() + BV_API_CACHE_TTL,
      });
      return data;
    }
    return null;
  } catch (error) {
    console.error("[🫥BlackList] 视频标签 API 请求失败:", error);
    return null;
  } finally {
    if (timeoutTimer) clearTimeout(timeoutTimer);
  }
}

/**
 * 只保留可用于屏蔽的视频标签：去掉背景音乐（bgm/music）和话题标签。
 * @param {unknown} tag - 视频标签接口返回的 TAG 对象或旧格式字符串。
 * @returns {string|null} 可展示的视频标签名。
 */
function normalizeVideoTagName(tag) {
  if (typeof tag === "string") {
    const name = tag.trim();
    return name && !name.startsWith("#") ? name : null;
  }
  if (!tag || typeof tag !== "object") return null;
  const tagType = String(tag.tag_type || "").toLowerCase();
  if (tagType === "bgm" || tagType === "music" || tagType === "topic") {
    return null;
  }
  if (tag.music_id) return null;
  const name = String(tag.tag_name || "").trim();
  if (!name || name.startsWith("#")) return null;
  return name;
}

function getEligibleVideoTags(data) {
  if (!data || !Array.isArray(data.videoTags)) return [];
  const result = [];
  const seen = new Set();
  data.videoTags.forEach((tag) => {
    const name = normalizeVideoTagName(tag);
    if (name && !seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  });
  return result;
}

/**
 * 返回卡片上第一个命中分类黑名单的标签名。
 *
 * 对卡片标签组里的每个标签按钮逐个判定：
 *   标签文本本身在 tagNameBlacklist，或按 V2 映射出的名称在黑名单中 → 视为命中。
 * 返回的标签名用于：屏蔽原因按钮显示具体内容、以及“取消屏蔽”时从黑名单删除该规则。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 * @returns {string|null} 命中的标签名，没有则返回 null。
 */
function getBlacklistedTagName(cardElement) {
  const tnameGroup = cardElement.querySelector(
    ".bilibili-blacklist-tname-group"
  );
  if (!tnameGroup) return null;
  const tnameElements = tnameGroup.querySelectorAll(
    ".bilibili-blacklist-tname"
  );
  for (const tnameElement of tnameElements) {
    const tname = tnameElement.textContent.trim();
    if (!tname) continue;
    let matched = null;
    if (tagNameBlacklist.includes(tname)) {
      matched = tname;
    } else {
      // 临时更新，根据V2查找名称
      const name = getTagNameByV2(tname);
      if (name !== null && tagNameBlacklist.includes(name)) {
        matched = name;
      }
    }
    if (matched === null) continue;
    return matched;
  }
  return null;
}

/**
 * 检查卡片是否包含任何黑名单标签（放行感知）。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 * @returns {boolean} 如果有任何标签被列入黑名单，则返回true，否则返回false。
 */
function isCardBlacklistedByTagName(cardElement) {
  return !!getBlacklistedTagName(cardElement);
}

/**
 * 返回卡片上第一个命中的视频标签黑名单项。
 * @param {HTMLElement} cardElement - 视频卡片元素。
 * @returns {string|null} 命中的视频标签名，没有则返回 null。
 */
function getBlacklistedVideoTag(cardElement) {
  const videoTagElements = cardElement.querySelectorAll(
    ".bilibili-blacklist-video-tag"
  );
  for (const videoTagElement of videoTagElements) {
    const tagName = (videoTagElement.textContent || "").trim();
    if (tagName && videoTagBlacklist.includes(tagName)) {
      return tagName;
    }
  }
  return null;
}

function isCardBlacklistedByVideoTag(cardElement) {
  return !!getBlacklistedVideoTag(cardElement);
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
 * 请求接口并把分类标签按钮挂到卡片上。
 * 主判定与“补标签”两条路径共用。
 * @param {HTMLElement} card - 视频卡片元素。
 * @param {string} bvId - 卡片对应的 BV。
 * @returns {Promise<{data: object|null, tnameResolved: boolean, usedNetwork: boolean}>}
 *   data: 接口数据；tnameResolved: 是否解析出至少一个分类标签；usedNetwork: 本次是否真的发了请求。
 */
async function attachTNameGroupToCard(card, bvId) {
  const needViewApi =
    globalPluginConfig.flagTName || globalPluginConfig.flagVertical;
  const needVideoTagApi = globalPluginConfig.flagVideoTag;
  const usedNetwork =
    (needViewApi && !hasFreshBvApiCache(bvId)) ||
    (needVideoTagApi && !hasFreshBvTagApiCache(bvId));
  const [viewData, videoTagData] = await Promise.all([
    needViewApi ? getBilibiliVideoApiData(bvId) : Promise.resolve(null),
    needVideoTagApi
      ? getBilibiliVideoTagApiData(bvId)
      : Promise.resolve(null),
  ]);
  const data =
    viewData || videoTagData
      ? { ...(viewData || {}), ...(videoTagData || {}) }
      : null;
  let tnameResolved = false;

  if (data) {
    if (card.querySelector(".bilibili-blacklist-tname-group")) {
      tnameResolved =
        !globalPluginConfig.flagTName ||
        !!card.querySelector(
          ".bilibili-blacklist-tname-group .bilibili-blacklist-tname"
        );
    } else {
      // 用 ensureBlockContainerOnCard 而不是 querySelector：解析不到 UP 名的卡片没有容器，
      // 旧实现会因此永远挂不上标签 → 被判为“tname 解析失败”→ 误屏蔽。
      const container = ensureBlockContainerOnCard(card);
      if (container) {
        const tnameGroup = document.createElement("div");
        tnameGroup.className = "bilibili-blacklist-tname-group";
        let hasTname = false;
        let hasVideoTag = false;

        // 去重添加标签按钮：同一来源/tid 映射出的不同名字重复时只保留一个
        if (globalPluginConfig.flagTName) {
          hasTname = addTNameButtonToGroup(tnameGroup, data.tname, card) || hasTname;
          hasTname =
            addTNameButtonToGroup(tnameGroup, data.tname_v2, card) || hasTname;
        }
        if (globalPluginConfig.flagTName && data.tid_v2) {
          const obj = getTagNameById(data.tid_v2);
          if (obj) {
            hasTname =
              addTNameButtonToGroup(tnameGroup, obj.name, card) || hasTname;
            hasTname =
              addTNameButtonToGroup(tnameGroup, obj.name_v2, card) || hasTname;
          }
        }
        if (globalPluginConfig.flagVideoTag) {
          getEligibleVideoTags(data).forEach((tagName) => {
            tnameGroup.appendChild(createVideoTagBlockButton(tagName, card));
            hasVideoTag = true;
          });
        }
        if (hasTname || hasVideoTag) {
          container.appendChild(tnameGroup);
          tnameResolved = hasTname;
        }
      }
    }
  }

  return { data, tnameResolved, usedNetwork };
}

/**
 * 处理视频卡片队列进行屏蔽。
 *
 * 判定顺序刻意分成两个阶段：
 *   阶段 A（零网络）：软广链接 > UP主名精确匹配 > 正则匹配。命中即可直接提交，
 *                    不发任何请求、也不需要限速等待。
 *   阶段 B（网络）  ：仅当阶段 A 未命中时，才请求 view 接口做分类标签/竖屏判定。
 * 已在阶段 A 命中的卡片，若开启 flagAlwaysFetchTName（默认开），会被放进低优先级的
 * “补标签队列”，等主队列判定完再补请求，保证标签按钮始终可见但不拖慢其它卡片的判定。
 */
async function processVideoCardQueue() {
  if (isVideoCardQueueProcessing) return;
  isVideoCardQueueProcessing = true;
  let localDecisionStreak = 0; // 连续“零网络判定”的卡片数，用于定期让出主线程

  while (videoCardProcessQueue.size > 0 || tnameDecorateQueue.size > 0) {
    // ===== 补标签队列：优先级最低，只有主队列空了才处理 =====
    if (videoCardProcessQueue.size === 0) {
      const decorateIterator = tnameDecorateQueue.values();
      const decorateCard = decorateIterator.next().value;
      tnameDecorateQueue.delete(decorateCard);
      if (!decorateCard || decorateCard.isConnected === false) continue;
      if (decorateCard.querySelector(".bilibili-blacklist-tname-group")) continue;
      const decorateBvId = getLinkBvId(getCardHrefLink(decorateCard));
      if (!decorateBvId) continue;
      const decorateResult = await attachTNameGroupToCard(
        decorateCard,
        decorateBvId
      );
      if (decorateResult.usedNetwork) {
        await sleep(globalPluginConfig.processQueueInterval);
      }
      continue;
    }

    const iterator = videoCardProcessQueue.values();
    const card = iterator.next().value;
    videoCardProcessQueue.delete(card);

    if (!card || processedVideoCards.has(card)) {
      continue;
    }
    // 翻页/切集后旧卡片已从文档移除：直接丢弃。
    // 否则它们照样各消耗一次 API 请求 + 一次限速等待，把新一页的卡片堵在队尾。
    // 用 === false 而不是 !card.isConnected：万一环境不支持 isConnected（undefined），
    // 取反会把所有卡片都跳过，等于整个屏蔽功能失效。
    if (card.isConnected === false) {
      continue;
    }

    let usedNetwork = false; // 本轮是否真的发起了网络请求（决定是否需要限速等待）
    let shouldHide = false;
    let blockType = "none";
    let blockReasonValue = null; // 具体屏蔽内容（UP 名 / 标签名 / REGEX_BLOCK_VALUE）

    // ===== 阶段 A：零网络判定（软广链接 > UP主名精确 > 正则）=====
    const link = getCardHrefLink(card);
    const bvId = getLinkBvId(link);
    if (checkLinkCM(link)) {
      shouldHide = true;
      blockType = "cm";
    }
    const { upName, videoTitle } = getVideoCardInfo(card);
    // 依据 UP 名/标题判定：只要解析到其中一个就参与判定（空 UP 名也能用正则匹标题，
    // 标题解析失败也能用 UP 名精确匹配）。两者都解析不到则交给阶段 B，避免误伤。
    // 精确匹配优先；命中即记录具体 UP 名（显示与取消用）。正则无法定位具体规则，记录哨兵值。
    if (!shouldHide && globalPluginConfig.flagInfo && (upName || videoTitle)) {
      const exactMatch = getExactBlacklistMatch(upName);
      if (exactMatch) {
        shouldHide = true;
        blockType = "info";
        blockReasonValue = exactMatch;
      } else if (isRegexBlacklisted(upName, videoTitle)) {
        shouldHide = true;
        blockType = "info";
        blockReasonValue = REGEX_BLOCK_VALUE;
      }
    }

    const hasTNameGroup = !!card.querySelector(".bilibili-blacklist-tname-group");

    // ===== 阶段 B：网络判定（分类标签 / 竖屏）=====
    if (
      !shouldHide &&
      (globalPluginConfig.flagTName ||
        globalPluginConfig.flagVideoTag ||
        globalPluginConfig.flagVertical) &&
      bvId
    ) {
      if (hasTNameGroup) {
        // 已有标签组（例如刚被“取消屏蔽”重新判定的卡片）：不重复挂标签，
        // 用（通常已缓存的）接口数据补做 tname/竖屏完整判定 —— 满足
        // “取消一次后重新完整检查，其它原因仍继续屏蔽”。
        const result = await attachTNameGroupToCard(card, bvId);
        usedNetwork = result.usedNetwork;
        const data = result.data;
        if (data) {
          const matchedTag = globalPluginConfig.flagTName
            ? getBlacklistedTagName(card)
            : null;
          if (matchedTag) {
            shouldHide = true;
            blockType = "tname";
            blockReasonValue = matchedTag;
          }
          const matchedVideoTag = globalPluginConfig.flagVideoTag
            ? getBlacklistedVideoTag(card)
            : null;
          if (!shouldHide && matchedVideoTag) {
            shouldHide = true;
            blockType = "videoTag";
            blockReasonValue = matchedVideoTag;
          }
          // 如果启用了垂直视频屏蔽
          if (
            !shouldHide &&
            globalPluginConfig.flagVertical &&
            data.dimension &&
            data.dimension.width &&
            data.dimension.height
          ) {
            const dimension = data.dimension.width / data.dimension.height;
            if (dimension < globalPluginConfig.verticalScaleThreshold) {
              shouldHide = true;
              blockType = "vertical";
            }
          }
        }
        // data 为 null（缓存过期且请求失败）：不重试、不误屏蔽，按未命中处理。
      } else {
        // 首次挂标签：请求接口，挂标签组 + tname/竖屏判定
        const result = await attachTNameGroupToCard(card, bvId);
        usedNetwork = result.usedNetwork;
        const data = result.data;

        if (data) {
          const matchedTag = globalPluginConfig.flagTName
            ? getBlacklistedTagName(card)
            : null;
          if (matchedTag) {
            shouldHide = true;
            blockType = "tname";
            blockReasonValue = matchedTag;
          }
          const matchedVideoTag = globalPluginConfig.flagVideoTag
            ? getBlacklistedVideoTag(card)
            : null;
          if (!shouldHide && matchedVideoTag) {
            shouldHide = true;
            blockType = "videoTag";
            blockReasonValue = matchedVideoTag;
          }
          // 如果启用了垂直视频屏蔽
          if (
            !shouldHide &&
            globalPluginConfig.flagVertical &&
            data.dimension &&
            data.dimension.width &&
            data.dimension.height
          ) {
            const dimension = data.dimension.width / data.dimension.height;
            if (dimension < globalPluginConfig.verticalScaleThreshold) {
              shouldHide = true;
              blockType = "vertical";
            }
          }

          // 开启了 tname 却没能解析出任何分类标签（数据缺失/结构变化）：
          // 无法确定该卡是否命中分类黑名单，按保守策略——重排到队尾重试一次，再次失败则屏蔽。
          if (globalPluginConfig.flagTName && !shouldHide && !result.tnameResolved) {
            if (!tnameRetriedCards.has(card)) {
              tnameRetriedCards.add(card);
              videoCardProcessQueue.add(card); // 加入队列最后
              if (usedNetwork) {
                await sleep(globalPluginConfig.processQueueInterval);
              }
              continue;
            }
            shouldHide = true;
            blockType = "tname";
          }
        } else if (globalPluginConfig.flagTName) {
          // 接口返回 null（请求失败/超时/限流/BV无效）：tname 解析失败。
          // 重排到队尾重试一次，再次失败则按屏蔽处理。
          if (!tnameRetriedCards.has(card)) {
            tnameRetriedCards.add(card);
            videoCardProcessQueue.add(card); // 加入队列最后
            if (usedNetwork) {
              await sleep(globalPluginConfig.processQueueInterval);
            }
            continue;
          }
          shouldHide = true;
          blockType = "tname";
        }
      }
    } else if (
      shouldHide &&
      globalPluginConfig.flagAlwaysFetchTName &&
      (globalPluginConfig.flagTName || globalPluginConfig.flagVideoTag) &&
      bvId &&
      !hasTNameGroup
    ) {
      // 阶段 A 已命中：判定上不再需要接口。但按配置仍要显示分类标签按钮，
      // 于是放进低优先级补标签队列，等主队列判定完再补，不占用判定时间。
      tnameDecorateQueue.add(card);
    }

    // ===== 提交 =====
    if (shouldHide) {
      // 命中：先去掉“未处理”filter 遮盖，再走正式遮蔽（hide / kirby 遮罩 / 模糊）
      clearPendingFilter(card);
      hideVideoCard(card, blockType, blockReasonValue);
    } else {
      // 未命中：去掉“未处理”filter 遮盖，恢复原样显示
      clearPendingFilter(card);
      const realCardToDisplay = getRealVideoCardElement(card);
      unmarkBlockedCard(realCardToDisplay);
      removeBlockReason(card);
      removeKirbyOverlay(card); // 幂等：清理可能残留的遮罩（不再依赖 flagKirby）
      if (realCardToDisplay) {
        realCardToDisplay.style.display = "block";
        realCardToDisplay.style.visibility = "visible"; // 取消未处理阶段的遮盖（若有）
      }
    }

    processedVideoCards.add(card); // 标记卡片已处理

    // 只有真正发生网络请求时才限速：纯本地命中的卡片立即处理下一张。
    // （旧实现对每张卡片无差别 sleep 200ms，一页 30 张仅等待就要 6 秒。）
    if (usedNetwork) {
      localDecisionStreak = 0;
      await sleep(globalPluginConfig.processQueueInterval);
    } else if (++localDecisionStreak >= 20) {
      // 纯本地判定不限速，但连续处理很多张时主动让出主线程一次，
      // 避免超长列表下形成长任务造成页面卡顿；顺便刷新一次计数显示。
      localDecisionStreak = 0;
      refreshBlockCountDisplay();
      await sleep(0);
    }
  }
  isVideoCardQueueProcessing = false;
  refreshBlockCountDisplay();
}

// 异步等待函数
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
