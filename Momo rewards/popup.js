const balanceEl = document.getElementById("balance");
const shopListEl = document.getElementById("shop-list");
const statusEl = document.getElementById("status");

let deviceId = null;
let currentBalance = 0;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#e0245e" : "#8f5cff";
  if (text) setTimeout(() => (statusEl.textContent = ""), 2500);
}

async function getDeviceId() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "XREWARDS_GET_DEVICE_ID" }, (response) => {
      resolve(response.deviceId);
    });
  });
}

async function fetchBalance() {
  const res = await fetch(`${CONFIG.BACKEND_URL}/api/balance?device_id=${deviceId}`);
  const data = await res.json();
  currentBalance = data.points;
  balanceEl.textContent = `✨ ${currentBalance} pts`;
}

async function fetchShop() {
  const res = await fetch(`${CONFIG.BACKEND_URL}/api/shop?device_id=${deviceId}`);
  const items = await res.json();
  renderShop(items);
}

function renderShop(items) {
  shopListEl.innerHTML = "";
  if (!items.length) {
    shopListEl.innerHTML = '<p class="muted">No items yet 💭</p>';
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = item.owned ? "item owned" : "item locked";

    const tile = document.createElement("div");
    tile.className = "item-tile";

    if (item.owned) {
      const img = document.createElement("img");
      img.className = "item-image";
      img.src = `${CONFIG.BACKEND_URL}/api/shop-image/${item.id}?device_id=${deviceId}`;
      img.alt = item.name;
      tile.appendChild(img);
    } else {
      const lock = document.createElement("span");
      lock.className = "lock-icon";
      lock.textContent = "🔒";
      tile.appendChild(lock);
    }

    const name = document.createElement("div");
    name.className = "item-name";
    name.textContent = item.name;

    card.appendChild(tile);
    card.appendChild(name);

    if (item.owned) {
      const badge = document.createElement("div");
      badge.className = "owned-badge";
      badge.textContent = "✓ Unlocked";
      card.appendChild(badge);
    } else {
      const cost = document.createElement("div");
      cost.className = "item-cost";
      cost.textContent = `${item.cost} pts`;
      card.appendChild(cost);

      const btn = document.createElement("button");
      btn.textContent = "Unlock";
      btn.disabled = currentBalance < item.cost;
      btn.addEventListener("click", () => redeem(item.id, btn));
      card.appendChild(btn);
    }

    shopListEl.appendChild(card);
  });
}

async function redeem(itemId, btn) {
  btn.disabled = true;
  try {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId, item_id: itemId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setStatus(data.error || "Unlock failed", true);
      btn.disabled = false;
      return;
    }

    setStatus("Unlocked! 🎉");
    await fetchBalance();
    await fetchShop();
  } catch (err) {
    setStatus("Network error", true);
    btn.disabled = false;
  }
}

(async function init() {
  deviceId = await getDeviceId();
  await fetchBalance();
  await fetchShop();
})();