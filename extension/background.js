importScripts("config.js");

const DEVICE_ID_KEY = "xrewards_device_id";

// Returns a stable per-install UUID, generating one on first use.
async function getDeviceId() {
  const stored = await chrome.storage.local.get([DEVICE_ID_KEY]);
  if (stored[DEVICE_ID_KEY]) return stored[DEVICE_ID_KEY];

  const deviceId = crypto.randomUUID();
  await chrome.storage.local.set({ [DEVICE_ID_KEY]: deviceId });
  return deviceId;
}

async function awardAction(postId, action) {
  const deviceId = await getDeviceId();
  const points = CONFIG.POINTS[action];
  if (!points) return { awarded: false };

  try {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/award`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId, post_id: postId, action, points }),
    });
    const data = await res.json();
    return { awarded: data.awarded, points: data.points, pointsAdded: points };
  } catch (err) {
    console.error("XRewards: failed to report action", err);
    return { awarded: false, error: true };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "XREWARDS_ACTION") {
    const { postId, action } = message.payload;
    awardAction(postId, action).then((result) => sendResponse(result));
    return true; // keep the message channel open for the async response
  }

  if (message?.type === "XREWARDS_GET_DEVICE_ID") {
    getDeviceId().then((deviceId) => sendResponse({ deviceId }));
    return true;
  }
});
