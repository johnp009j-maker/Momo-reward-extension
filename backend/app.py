import os
import sqlite3
from datetime import datetime, timezone

from flask import Flask, g, jsonify, request, send_from_directory
from flask_cors import CORS

DB_PATH = os.environ.get("DB_PATH", "rewards.db")
IMAGES_DIR = os.environ.get("SHOP_IMAGES_DIR", os.path.join(os.path.dirname(__file__), "shop_images"))

app = Flask(__name__)
# Requests come from the extension's own chrome-extension:// origin, which
# is unpredictable per-install, so we allow all origins on the API routes.
CORS(app, resources={r"/api/*": {"origins": "*"}})


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            device_id TEXT PRIMARY KEY,
            points INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS awarded_actions (
            device_id TEXT NOT NULL,
            post_id TEXT NOT NULL,
            action TEXT NOT NULL,
            points INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (device_id, post_id, action)
        );

        CREATE TABLE IF NOT EXISTS shop_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            cost INTEGER NOT NULL,
            image_filename TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS redemptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            redeemed_at TEXT NOT NULL
        );
        """
    )
    # Seed a couple of placeholder shop items if the table is empty.
    # Drop real image files into backend/shop_images/ and reference the
    # filename here (see README).
    row = db.execute("SELECT COUNT(*) AS c FROM shop_items").fetchone()
    if row["c"] == 0:
        db.executemany(
            "INSERT INTO shop_items (name, cost, image_filename) VALUES (?, ?, ?)",
            [
            ("Bonus Art #1", 50, "bonus_art_1.png"),
            ("Bonus Art #2", 50, "bonus_art_2.png"),
            ("Bonus Art #3", 50, "bonus_art_3.png"),
            ("Bonus Art #4", 50, "bonus_art_4.png"),
            ("Bonus Art #5", 50, "bonus_art_5.png"),
            ("Bonus Art #6", 50, "bonus_art_6.png"),
            ("Bonus Art #7", 50, "bonus_art_7.png"),
            ("Bonus Art #8", 50, "bonus_art_8.png"),
            ("Bonus Art #9", 50, "bonus_art_9.png"),
            ("Bonus Art #10", 50, "bonus_art_10.png"),
            ("Bonus Art #11", 50, "bonus_art_11.png"),
            ("Bonus Art #12", 50, "bonus_art_12.png"),
            ("Bonus Art #13", 50, "bonus_art_13.png"),
            ("Bonus Art #14", 50, "bonus_art_14.png"),
            ("Bonus Art #15", 50, "bonus_art_15.png"),
            ("Bonus Art #16", 50, "bonus_art_16.png"),
            ("Bonus Art #17", 50, "bonus_art_17.png"),
            ("Bonus Art #18", 50, "bonus_art_18.png"),
            ("Bonus Art #19", 50, "bonus_art_19.png"),
            ("Bonus Art #20", 50, "bonus_art_20.png"),
            ("Bonus Art #21", 50, "bonus_art_21.png"),
            ("Bonus Art #22", 50, "bonus_art_22.png"),
            ("Bonus Art #23", 50, "bonus_art_23.png"),
            ("Bonus Art #24", 50, "bonus_art_24.png"),
            ("Bonus Art #25", 50, "bonus_art_25.png"),
            ("Bonus Art #26", 50, "bonus_art_26.png"),
            ("Bonus Art #27", 50, "bonus_art_27.png"),
            ("Bonus Art #28", 50, "bonus_art_28.png"),
            ("Bonus Art #29", 50, "bonus_art_29.png"),
            ("Bonus Art #30", 50, "bonus_art_30.png"),
            ("Bonus Art #31", 100, "bonus_art_31.gif"),
            ("Bonus Art #32", 100, "bonus_art_32.gif"),
            ("Bonus Art #33", 100, "bonus_art_33.gif"),
            ("Bonus Art #34", 100, "bonus_art_34.gif"),
            ("Bonus Art #35", 100, "bonus_art_35.gif"),
            ],
        )
    db.commit()
    db.close()


def get_or_create_user(db, device_id):
    row = db.execute("SELECT * FROM users WHERE device_id = ?", (device_id,)).fetchone()
    if row is None:
        db.execute("INSERT INTO users (device_id, points) VALUES (?, 0)", (device_id,))
        db.commit()
        row = db.execute("SELECT * FROM users WHERE device_id = ?", (device_id,)).fetchone()
    return row


def is_owned(db, device_id, item_id):
    row = db.execute(
        "SELECT 1 FROM redemptions WHERE device_id = ? AND item_id = ?",
        (device_id, item_id),
    ).fetchone()
    return row is not None


@app.post("/api/award")
def award():
    data = request.get_json(silent=True) or {}
    device_id = data.get("device_id")
    post_id = data.get("post_id")
    action = data.get("action")
    points = data.get("points")

    if not all([device_id, post_id, action]) or not isinstance(points, int):
        return jsonify({"error": "device_id, post_id, action, and integer points are required"}), 400

    db = get_db()
    get_or_create_user(db, device_id)

    try:
        db.execute(
            "INSERT INTO awarded_actions (device_id, post_id, action, points, created_at) VALUES (?, ?, ?, ?, ?)",
            (device_id, post_id, action, points, datetime.now(timezone.utc).isoformat()),
        )
    except sqlite3.IntegrityError:
        # Already awarded for this device/post/action - no-op.
        row = db.execute("SELECT points FROM users WHERE device_id = ?", (device_id,)).fetchone()
        return jsonify({"awarded": False, "points": row["points"]})

    db.execute("UPDATE users SET points = points + ? WHERE device_id = ?", (points, device_id))
    db.commit()

    row = db.execute("SELECT points FROM users WHERE device_id = ?", (device_id,)).fetchone()
    return jsonify({"awarded": True, "points": row["points"]})


@app.get("/api/balance")
def balance():
    device_id = request.args.get("device_id")
    if not device_id:
        return jsonify({"error": "device_id is required"}), 400

    db = get_db()
    row = get_or_create_user(db, device_id)
    return jsonify({"points": row["points"]})


@app.get("/api/shop")
def shop():
    device_id = request.args.get("device_id")
    db = get_db()
    rows = db.execute("SELECT id, name, cost FROM shop_items ORDER BY cost ASC").fetchall()

    items = []
    for r in rows:
        owned = bool(device_id) and is_owned(db, device_id, r["id"])
        items.append({"id": r["id"], "name": r["name"], "cost": r["cost"], "owned": owned})

    return jsonify(items)


@app.get("/api/shop-image/<int:item_id>")
def shop_image(item_id):
    device_id = request.args.get("device_id")
    if not device_id:
        return jsonify({"error": "device_id is required"}), 400

    db = get_db()
    if not is_owned(db, device_id, item_id):
        return jsonify({"error": "Not redeemed yet"}), 403

    item = db.execute("SELECT image_filename FROM shop_items WHERE id = ?", (item_id,)).fetchone()
    if item is None:
        return jsonify({"error": "Item not found"}), 404

    return send_from_directory(IMAGES_DIR, item["image_filename"])


@app.post("/api/redeem")
def redeem():
    data = request.get_json(silent=True) or {}
    device_id = data.get("device_id")
    item_id = data.get("item_id")

    if not device_id or not item_id:
        return jsonify({"error": "device_id and item_id are required"}), 400

    db = get_db()
    user = get_or_create_user(db, device_id)
    item = db.execute("SELECT * FROM shop_items WHERE id = ?", (item_id,)).fetchone()

    if item is None:
        return jsonify({"error": "Item not found"}), 404
    if user["points"] < item["cost"]:
        return jsonify({"error": "Not enough points"}), 400

    db.execute("UPDATE users SET points = points - ? WHERE device_id = ?", (item["cost"], device_id))
    db.execute(
        "INSERT INTO redemptions (device_id, item_id, redeemed_at) VALUES (?, ?, ?)",
        (device_id, item_id, datetime.now(timezone.utc).isoformat()),
    )
    db.commit()

    row = db.execute("SELECT points FROM users WHERE device_id = ?", (device_id,)).fetchone()
    return jsonify({"points": row["points"]})


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
