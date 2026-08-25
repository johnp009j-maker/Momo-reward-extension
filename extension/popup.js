const balanceEl = document.getElementById("balance");
const shopListEl = document.getElementById("shop-list");
const statusEl = document.getElementById("status");

let deviceId = null;
let currentBalance = 0;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.style.color = isError ? "#e0245e" : "#17bf63";
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
  balanceEl.textContent = `${currentBalance} pts`;
}

async function fetchShop() {
  const res = await fetch(`${CONFIG.BACKEND_URL}/api/shop?device_id=${deviceId}`);
  const items = await res.json();
  renderShop(items);
}

function renderShop(items) {
  shopListEl.innerHTML = "";
  if (!items.length) {
    shopListEl.innerHTML = '<p class="muted">No items yet.</p>';
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = item.owned ? "item owned" : "item";

    if (item.owned) {
      const img = document.createElement("img");
      img.className = "item-image";
      img.src = `${CONFIG.BACKEND_URL}/api/shop-image/${item.id}?device_id=${deviceId}`;
      img.alt = item.name;

      const label = document.createElement("div");
      label.className = "item-name";
      label.textContent = item.name;

      row.appendChild(img);
      row.appendChild(label);
    } else {
      const info = document.createElement("div");
      info.innerHTML = `<div class="item-name">🔒 ${item.name}</div><div class="item-cost">${item.cost} pts</div>`;

      const btn = document.createElement("button");
      btn.textContent = "Unlock";
      btn.disabled = currentBalance < item.cost;
      btn.addEventListener("click", () => redeem(item.id, btn));

      row.appendChild(info);
      row.appendChild(btn);
    }

    shopListEl.appendChild(row);
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

    setStatus("Unlocked!");
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
