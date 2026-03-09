#!/usr/bin/env python3
"""Audit pricing and purse consistency across auction tables."""

from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
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


def request_json(path: str) -> list[dict]:
    base_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    api_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not base_url or not api_key:
        raise RuntimeError("Missing Supabase credentials in .env or .env.local")

    url = f"{base_url.rstrip('/')}/rest/v1{path}"
    request = urllib.request.Request(
        url,
        headers={
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
        },
    )

    with urllib.request.urlopen(request, timeout=30) as response:
        payload = response.read().decode()
        return json.loads(payload)


def query(table: str, **params: str) -> list[dict]:
    return request_json(f"/{table}?{urllib.parse.urlencode(params)}")


def main() -> int:
    load_env()

    settings_rows = query(
        "tournament_settings",
        select="global_purse,base_price_a_plus,base_price_a,base_price_b,base_price_f",
        limit="1",
    )
    settings = settings_rows[0] if settings_rows else {}

    teams = query("teams", select="id,team_name,captain_player_id")
    players = query(
        "players",
        select="id,name,category,base_price,is_sold,sold_price,is_captain,sold_to_team_id,captain_team_id",
    )
    rules = query("auction_rules", select="team_id,starting_purse,current_purse,captain_deduction")
    auction_state_rows = query(
        "auction_state",
        select="current_player_id,current_base_price,current_bid_amount,status",
        limit="1",
    )
    auction_state = auction_state_rows[0] if auction_state_rows else {}
    logs = query("auction_log", select="id,player_id,status,sale_price,deleted", deleted="eq.false")

    players_by_id = {player["id"]: player for player in players}
    rules_by_team_id = {rule["team_id"]: rule for rule in rules}

    issues: list[str] = []

    current_player_id = auction_state.get("current_player_id")
    if current_player_id:
        current_player = players_by_id.get(current_player_id)
        if not current_player:
            issues.append("auction_state.current_player_id points to a missing player")
        elif auction_state.get("current_base_price") != current_player.get("base_price"):
            issues.append(
                "auction_state.current_base_price does not match the current player's base_price"
            )

    for player in players:
        if player.get("is_sold") and not player.get("sold_to_team_id"):
            issues.append(f"Sold player without sold_to_team_id: {player['name']}")

        if player.get("is_captain"):
            if player.get("sold_price") not in (0, None):
                issues.append(f"Captain has unexpected sold_price: {player['name']} ({player.get('sold_price')})")
            if player.get("captain_team_id") != player.get("sold_to_team_id"):
                issues.append(f"Captain team mismatch for {player['name']}")

    for team in teams:
        team_id = team["id"]
        captain_player_id = team.get("captain_player_id")
        team_rule = rules_by_team_id.get(team_id)

        if not team_rule:
            issues.append(f"Team missing auction_rules row: {team['team_name']}")
            continue

        captain_deduction = team_rule.get("captain_deduction") or 0
        current_purse = team_rule.get("current_purse") or 0
        starting_purse = team_rule.get("starting_purse") or settings.get("global_purse") or 0

        if current_purse > starting_purse:
            issues.append(f"current_purse exceeds starting_purse for team {team['team_name']}")

        if captain_deduction > 0 and not captain_player_id:
            issues.append(
                f"Team has captain_deduction but no captain_player_id: {team['team_name']} (₹{captain_deduction:,})"
            )

        if captain_player_id:
            captain = players_by_id.get(captain_player_id)
            if not captain:
                issues.append(f"Team captain_player_id points to missing player: {team['team_name']}")
            else:
                if not captain.get("is_captain"):
                    issues.append(f"Team captain is not marked is_captain: {team['team_name']} -> {captain['name']}")
                if captain.get("sold_to_team_id") != team_id:
                    issues.append(f"Captain roster assignment mismatch: {team['team_name']} -> {captain['name']}")

    for log in logs:
        if log.get("status") in {"sold", "manual"} and log.get("sale_price") is None:
            issues.append(f"Completed sale log missing sale_price: log {log['id']}")

    print("Pricing Audit Summary")
    print("=====================")
    print(f"Tournament purse: ₹{(settings.get('global_purse') or 0):,}")
    print(f"Teams: {len(teams)} | Players: {len(players)} | Rules rows: {len(rules)} | Active logs: {len(logs)}")
    print()

    if not issues:
        print("No pricing consistency issues detected.")
        return 0

    print(f"Issues found: {len(issues)}")
    for issue in issues:
        print(f"- {issue}")

    return 1


if __name__ == "__main__":
    sys.exit(main())
