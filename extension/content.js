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

      if (isLiked(article)) reportAction(info.postId, "like");
      if (isRetweeted(article)) reportAction(info.postId, "retweet");
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
})();
