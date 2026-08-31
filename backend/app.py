import os
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

DATABASE_URL = os.environ.get("DATABASE_URL")
IMAGES_DIR = os.environ.get("SHOP_IMAGES_DIR", os.path.join(os.path.dirname(__file__), "shop_images"))

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})


def get_db():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
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
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            cost INTEGER NOT NULL,
            image_filename TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS redemptions (
            id SERIAL PRIMARY KEY,
            device_id TEXT NOT NULL,
            item_id INTEGER NOT NULL,
            redeemed_at TEXT NOT NULL
        );
        """
    )
    conn.commit()

    cur.execute("SELECT COUNT(*) AS c FROM shop_items")
    if cur.fetchone()["c"] == 0:
        seed = [
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
            ("Bonus Art #31", 50, "bonus_art_31.gif"),
            ("Bonus Art #32", 50, "bonus_art_32.gif"),
            ("Bonus Art #33", 50, "bonus_art_33.gif"),
            ("Bonus Art #34", 50, "bonus_art_34.gif"),
            ("Bonus Art #35", 50, "bonus_art_35.gif"),
            ("Bonus Art #36", 50, "bonus_art_36.png"),
            ("Bonus Art #37", 50, "bonus_art_37.png"),
            ("Bonus Art #38", 50, "bonus_art_38.png"),
            ("Bonus Art #39", 50, "bonus_art_39.png"),
            ("Bonus Art #40", 50, "bonus_art_40.png"),
            ("Bonus Art #41", 50, "bonus_art_41.png"),
            ("Bonus Art #42", 50, "bonus_art_42.png"),
            ("Bonus Art #43", 50, "bonus_art_43.png"),
            ("Bonus Art #44", 50, "bonus_art_44.png"),
            ("Bonus Art #45", 100, "bonus_art_45.png"),
            ("Bonus Art #46", 100, "bonus_art_46.png"),
            ("Bonus Art #47", 100, "bonus_art_47.png"),
            ("Bonus Art #48", 100, "bonus_art_48.png"),
            ("Bonus Art #49", 100, "bonus_art_49.png"),
            ("Bonus Art #50", 100, "bonus_art_50.png"),
        ]
        psycopg2.extras.execute_values(
            cur,
            "INSERT INTO shop_items (name, cost, image_filename) VALUES %s",
            seed,
        )
        conn.commit()

    cur.close()
    conn.close()


def get_or_create_user(cur, device_id):
    cur.execute("SELECT * FROM users WHERE device_id = %s", (device_id,))
    row = cur.fetchone()
    if row is None:
        cur.execute("INSERT INTO users (device_id, points) VALUES (%s, 0)", (device_id,))
        cur.execute("SELECT * FROM users WHERE device_id = %s", (device_id,))
        row = cur.fetchone()
    return row


def is_owned(cur, device_id, item_id):
    cur.execute(
        "SELECT 1 FROM redemptions WHERE device_id = %s AND item_id = %s",
        (device_id, item_id),
    )
    return cur.fetchone() is not None


@app.post("/api/award")
def award():
    data = request.get_json(silent=True) or {}
    device_id = data.get("device_id")
    post_id = data.get("post_id")
    action = data.get("action")
    points = data.get("points")

    if not all([device_id, post_id, action]) or not isinstance(points, int):
        return jsonify({"error": "device_id, post_id, action, and integer points are required"}), 400

    conn = get_db()
    cur = conn.cursor()
    get_or_create_user(cur, device_id)
    conn.commit()

    try:
        cur.execute(
            "INSERT INTO awarded_actions (device_id, post_id, action, points, created_at) VALUES (%s, %s, %s, %s, %s)",
            (device_id, post_id, action, points, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        cur.execute("SELECT points FROM users WHERE device_id = %s", (device_id,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        return jsonify({"awarded": False, "points": row["points"]})

    cur.execute("UPDATE users SET points = points + %s WHERE device_id = %s", (points, device_id))
    conn.commit()

    cur.execute("SELECT points FROM users WHERE device_id = %s", (device_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return jsonify({"awarded": True, "points": row["points"]})


@app.get("/api/balance")
def balance():
    device_id = request.args.get("device_id")
    if not device_id:
        return jsonify({"error": "device_id is required"}), 400

    conn = get_db()
    cur = conn.cursor()
    row = get_or_create_user(cur, device_id)
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"points": row["points"]})


@app.get("/api/shop")
def shop():
    device_id = request.args.get("device_id")
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, name, cost FROM shop_items ORDER BY cost ASC")
    rows = cur.fetchall()

    items = []
    for r in rows:
        owned = bool(device_id) and is_owned(cur, device_id, r["id"])
        items.append({"id": r["id"], "name": r["name"], "cost": r["cost"], "owned": owned})

    cur.close()
    conn.close()
    return jsonify(items)


@app.get("/api/shop-image/<int:item_id>")
def shop_image(item_id):
    device_id = request.args.get("device_id")
    if not device_id:
        return jsonify({"error": "device_id is required"}), 400

    conn = get_db()
    cur = conn.cursor()
    owned = is_owned(cur, device_id, item_id)
    if not owned:
        cur.close()
        conn.close()
        return jsonify({"error": "Not redeemed yet"}), 403

    cur.execute("SELECT image_filename FROM shop_items WHERE id = %s", (item_id,))
    item = cur.fetchone()
    cur.close()
    conn.close()

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

    conn = get_db()
    cur = conn.cursor()
    user = get_or_create_user(cur, device_id)
    conn.commit()

    cur.execute("SELECT * FROM shop_items WHERE id = %s", (item_id,))
    item = cur.fetchone()

    if item is None:
        cur.close()
        conn.close()
        return jsonify({"error": "Item not found"}), 404
    if user["points"] < item["cost"]:
        cur.close()
        conn.close()
        return jsonify({"error": "Not enough points"}), 400

    cur.execute("UPDATE users SET points = points - %s WHERE device_id = %s", (item["cost"], device_id))
    cur.execute(
        "INSERT INTO redemptions (device_id, item_id, redeemed_at) VALUES (%s, %s, %s)",
        (device_id, item_id, datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()

    cur.execute("SELECT points FROM users WHERE device_id = %s", (device_id,))
    row = cur.fetchone()
    cur.close()
    conn.close()
    return jsonify({"points": row["points"]})


init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))