#!/usr/bin/env python3
"""Backfill missing auction_log rows for already-sold players."""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from collections import defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_env() -> None:
    for name in [".env", ".env.local"]:
        path = ROOT / name
        if not path.exists():
            continue
        for raw_line in path.read_text().splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def request_json(path: str, method: str = "GET", body: list[dict] | None = None):
    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + path
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if method != "GET":
        headers["Prefer"] = "return=representation"
    payload = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(url, headers=headers, method=method, data=payload)
    with urllib.request.urlopen(req, timeout=30) as response:
        raw = response.read().decode()
        return json.loads(raw) if raw else None


def build_backfill_rows() -> list[dict]:
    sold_players = request_json(
        "/rest/v1/players?select=id,name,base_price,category,gender,sold_to_team_id,sold_price&is_sold=eq.true"
    )
    logs = request_json("/rest/v1/auction_log?select=id,player_id&deleted=eq.false")
    bids = request_json(
        "/rest/v1/bids?select=id,player_id,team_id,bid_amount,is_winning_bid,created_at&order=created_at.asc"
    )

    active_log_players = {row["player_id"] for row in logs if row.get("player_id")}
    bids_by_player: dict[str, list[dict]] = defaultdict(list)
    for bid in bids:
        bids_by_player[bid["player_id"]].append(bid)

    rows: list[dict] = []
    for player in sold_players:
        if player["id"] in active_log_players:
            continue

        player_bids = bids_by_player.get(player["id"], [])
        winning_bids = [
            bid
            for bid in player_bids
            if bid.get("is_winning_bid") and bid.get("team_id") == player.get("sold_to_team_id")
        ]
        exact_winning_bids = [
            bid for bid in winning_bids if bid.get("bid_amount") == player.get("sold_price")
        ]
        chosen_bid = (exact_winning_bids or winning_bids or player_bids[-1:])[0] if player_bids else None

        rows.append(
            {
                "player_id": player["id"],
                "team_id": player["sold_to_team_id"],
                "status": "sold" if player_bids else "manual",
                "sale_price": player["sold_price"],
                "base_price": player["base_price"],
                "bid_count": len(player_bids),
                "category": player["category"],
                "gender": player["gender"],
                "is_manual": not bool(player_bids),
                "logged_at": chosen_bid["created_at"] if chosen_bid else None,
            }
        )

    return rows


def main() -> int:
    load_env()
    rows = build_backfill_rows()
    print(json.dumps(rows, indent=2))

    if "--dry-run" in sys.argv:
        return 0

    if not rows:
        print("No missing auction_log rows found.")
        return 0

    inserted = request_json("/rest/v1/auction_log", method="POST", body=rows)
    print(f"Inserted {len(inserted or rows)} rows.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
