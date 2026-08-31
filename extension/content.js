// Runs on x.com / twitter.com pages. Watches the DOM for likes/retweets
// on posts by CONFIG.TARGET_ACCOUNT and reports them to the background
// script, which forwards them to the backend.
//
// Approach: X's DOM doesn't expose a clean "you just liked this" event,
// so instead of hooking clicks (which fire before a retweet confirmation
// menu is even chosen) we re-scan visible tweets on every DOM mutation
// and diff their like/retweet button state against what we already know.

(() => {
  const SENT_KEY = "xrewards_sent_actions"; // set of "postId:action" already reported
  let sentActions = new Set();
  let scanScheduled = false;
  const knownState = new Map(); // postId -> { like: bool, retweet: bool }

  chrome.storage.local.get([SENT_KEY], (result) => {
    sentActions = new Set(result[SENT_KEY] || []);
  });

  function persistSentActions() {
    chrome.storage.local.set({ [SENT_KEY]: Array.from(sentActions) });
  }

  // Extract the post id and author handle from a tweet <article>.
  function getTweetInfo(article) {
    const permalink = article.querySelector('a[href*="/status/"]');
    if (!permalink) return null;

    const match = permalink.getAttribute("href").match(/^\/([^/]+)\/status\/(\d+)/);
    if (!match) return null;

    const [, author, postId] = match;
    return { author: author.toLowerCase(), postId };
  }

  function isLiked(article) {
    return !!article.querySelector('[data-testid="unlike"]');
  }

  function isRetweeted(article) {
    return !!article.querySelector('[data-testid="unretweet"]');
  }

function showToast(message, success) {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; top: 80px; right: 20px; z-index: 999999;
      background: ${success ? "#17bf63" : "#e0245e"}; color: white;
      padding: 10px 16px; border-radius: 8px; font-family: sans-serif;
      font-size: 14px; font-weight: 600; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      opacity: 0; transition: opacity 0.3s;
    `;
    document.body.appendChild(toast);
    requestAnimationFrame(() => (toast.style.opacity = "1"));
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function reportAction(postId, action) {
    const key = `${postId}:${action}`;
    if (sentActions.has(key)) return;
    sentActions.add(key);
    persistSentActions();

    chrome.runtime.sendMessage(
      { type: "XREWARDS_ACTION", payload: { postId, action } },
      (response) => {
        if (chrome.runtime.lastError || !response) {
          showToast("X Rewards: couldn't reach server", false);
          return;
        }
        if (response.awarded) {
          showToast(`+${response.pointsAdded ?? ""} points! (${response.points} total)`, true);
          handleStreak(action);
          if (action === "retweet") handleAudioStreak();
          handleImageStreak();
        } else {
          showToast("Already claimed this one", false);
        }
      }
    );
  }

  function scanTweets() {
    scanScheduled = false;
    const target = (CONFIG.TARGET_ACCOUNT || "").toLowerCase();
    if (!target) return;

    document.querySelectorAll('article[data-testid="tweet"]').forEach((article) => {
      const info = getTweetInfo(article);
      if (!info || info.author !== target) return;

      const liked = isLiked(article);
      const retweeted = isRetweeted(article);

      const prev = knownState.get(info.postId);

      if (!prev) {
        // First time seeing this post this session - record its current
        // state as the baseline, don't award for whatever it already was.
        knownState.set(info.postId, { like: liked, retweet: retweeted });
        return;
      }

      if (liked && !prev.like) reportAction(info.postId, "like");
      if (retweeted && !prev.retweet) reportAction(info.postId, "retweet");

      prev.like = liked;
      prev.retweet = retweeted;
    });
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    // Debounce: X mutates the DOM constantly while scrolling.
    setTimeout(scanTweets, 400);
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-testid", "aria-label"],
  });

  // Initial pass in case tweets are already on the page.
  scheduleScan();
  const STREAK_KEY_PREFIX = "xrewards_streak_";

  function randomThreshold() {
    return Math.floor(Math.random() * 4) + 3; // 3-6 inclusive
  }

  async function getStreak(action) {
    const key = STREAK_KEY_PREFIX + action;
    const result = await chrome.storage.local.get([key]);
    return result[key] || { count: 0, threshold: randomThreshold() };
  }

  async function setStreak(action, streak) {
    const key = STREAK_KEY_PREFIX + action;
    await chrome.storage.local.set({ [key]: streak });
  }

  function showFlavorToast(message) {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.top = "90px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.zIndex = "999999";
    toast.style.background = "#e0245e";
    toast.style.color = "white";
    toast.style.padding = "10px 16px";
    toast.style.borderRadius = "8px";
    toast.style.fontFamily = "sans-serif";
    toast.style.fontSize = "14px";
    toast.style.fontWeight = "600";
    toast.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
    toast.style.maxWidth = "260px";
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    document.body.appendChild(toast);
    requestAnimationFrame(() => (toast.style.opacity = "1"));
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  async function handleStreak(action) {
    const streak = await getStreak(action);
    streak.count += 1;

    if (streak.count >= streak.threshold) {
      const pool = action === "like" ? CONFIG.LIKE_TEXTS : CONFIG.RETWEET_TEXTS;
      if (pool && pool.length) {
        const text = pool[Math.floor(Math.random() * pool.length)];
        showFlavorToast(text);
      }
      streak.count = 0;
      streak.threshold = randomThreshold();
    }

    await setStreak(action, streak);
  }
  const AUDIO_STREAK_KEY = "xrewards_audio_streak_retweet";

  async function getAudioStreak() {
    const result = await chrome.storage.local.get([AUDIO_STREAK_KEY]);
    return result[AUDIO_STREAK_KEY] || { count: 0, threshold: randomThreshold() };
  }

  async function setAudioStreak(streak) {
    await chrome.storage.local.set({ [AUDIO_STREAK_KEY]: streak });
  }

  function playRandomAudio() {
    const pool = CONFIG.RETWEET_AUDIO;
    if (!pool || !pool.length) return;
    const file = pool[Math.floor(Math.random() * pool.length)];
    const audio = new Audio(chrome.runtime.getURL(file));
    audio.play().catch((err) => console.error("XRewards: audio play failed", err));
  }

  async function handleAudioStreak() {
    const streak = await getAudioStreak();
    streak.count += 1;

    if (streak.count >= streak.threshold) {
      playRandomAudio();
      streak.count = 0;
      streak.threshold = randomThreshold();
    }

    await setAudioStreak(streak);
  }
  const IMAGE_STREAK_KEY = "xrewards_image_streak";

  function randomImageThreshold() {
    return Math.floor(Math.random() * 2) + 2; // 2-3 inclusive
  }

  async function getImageStreak() {
    const result = await chrome.storage.local.get([IMAGE_STREAK_KEY]);
    return result[IMAGE_STREAK_KEY] || { count: 0, threshold: randomImageThreshold() };
  }

  async function setImageStreak(streak) {
    await chrome.storage.local.set({ [IMAGE_STREAK_KEY]: streak });
  }

  function showPopupImage() {
    const pool = CONFIG.POPUP_IMAGES;
    if (!pool || !pool.length) return;
    const file = pool[Math.floor(Math.random() * pool.length)];

    const img = document.createElement("img");
    img.src = chrome.runtime.getURL(file);
    img.style.position = "fixed";
    const margin = 40; // keep it fully on-screen, away from edges
    const maxSize = 260;
    const randomTop = margin + Math.random() * (window.innerHeight - maxSize - margin * 2);
    const randomLeft = margin + Math.random() * (window.innerWidth - maxSize - margin * 2);
    img.style.top = `${randomTop}px`;
    img.style.left = `${randomLeft}px`;
    img.style.zIndex = "999999";
    img.style.maxWidth = "260px";
    img.style.maxHeight = "260px";
    img.style.borderRadius = "12px";
    img.style.boxShadow = "0 4px 20px rgba(0,0,0,0.5)";
    img.style.opacity = "0";
    img.style.transition = "opacity 0.3s";

    document.body.appendChild(img);
    requestAnimationFrame(() => (img.style.opacity = "1"));
    setTimeout(() => {
      img.style.opacity = "0";
      setTimeout(() => img.remove(), 300);
    }, 5000);
  }

  async function handleImageStreak() {
    const streak = await getImageStreak();
    streak.count += 1;

    if (streak.count >= streak.threshold) {
      showPopupImage();
      streak.count = 0;
      streak.threshold = randomImageThreshold();
    }

    await setImageStreak(streak);
  }
})();
