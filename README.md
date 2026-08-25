# X Rewards

A Chrome extension that awards points when you like/retweet posts from one
specific X account, redeemable in a popup shop. Points are stored on a
small Flask backend so they persist across browser restarts.

## How it works

- **content.js** runs on x.com/twitter.com and watches the DOM for tweets
  from `CONFIG.TARGET_ACCOUNT`. When a like or retweet button on one of
  those posts is in the "already liked/retweeted" state, it reports the
  action once (deduped locally and again server-side).
- **background.js** holds a per-install device ID (`crypto.randomUUID()`,
  no login) and forwards actions to the backend's `/api/award` endpoint.
- **popup.html/js** is the shop — click the toolbar icon any time to see
  your balance and redeem items.
- **backend/app.py** is a small Flask API (users, points, shop items,
  redemptions) backed by SQLite.

## Setup

### 1. Deploy the backend to Railway

1. Push the `backend/` folder to a GitHub repo (or a subfolder of one).
2. In Railway, create a new project from that repo, root directory
   `backend/`. Railway will pick up `requirements.txt` and `Procfile`
   automatically.
3. Note the public URL Railway gives you (e.g.
   `https://x-rewards-production.up.railway.app`).

   **Important:** SQLite writes to a local file, and Railway's filesystem
   is ephemeral on redeploy unless you attach a persistent volume. Attach
   a volume mounted at the backend's working directory (or set `DB_PATH`
   to a path inside it) so points aren't wiped on every deploy. For a
   small personal project this is optional but worth doing once you're
   not just testing.

### 2. Configure the extension

Edit `extension/config.js`:

```js
TARGET_ACCOUNT: "the_handle_without_@",
POINTS: { like: 5, retweet: 10 },
BACKEND_URL: "https://your-actual-railway-url",
```

Also update `manifest.json`'s `host_permissions` entry to match your real
backend URL instead of the placeholder.

### 3. Load the extension in Chrome

1. Go to `chrome://extensions`.
2. Enable "Developer mode" (top right).
3. Click "Load unpacked" and select the `extension/` folder.
4. Visit x.com, like/retweet a post from your target account, then click
   the extension's toolbar icon to see the points land.

## Customizing the shop

Shop items are **hidden images** — locked with a 🔒 and a cost in the
popup until a device spends enough points to unlock them, after which the
image displays inline in the popup for that device only (other devices
stay locked).

To add your own:
1. Drop an image file into `backend/shop_images/`.
2. Add a row referencing it, either by editing the seed list in
   `init_db()` in `app.py`, or with a one-off script/SQL:
   ```sql
   INSERT INTO shop_items (name, cost, image_filename)
   VALUES ('My Item', 75, 'my_image.png');
   ```
3. `/api/shop-image/<item_id>` only serves the file to a `device_id` that
   has an actual redemption on record — there's no way to view an image
   without spending the points first.

## Known limitations

- **DOM scraping is fragile.** X changes its markup periodically; if likes
  stop being detected, the `data-testid` selectors in `content.js`
  (`unlike`, `unretweet`, tweet `article`) are the first thing to check
  against X's current DOM.
- **No login** means points are tied to one browser install. Reinstalling
  the extension or using a different browser/profile starts a fresh
  balance.
- Retweet detection relies on the button already showing the "retweeted"
  state — since X requires a confirm-menu click, there's a brief delay
  before the extension picks it up on the next DOM scan.
