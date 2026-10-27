#!/usr/bin/env python3
"""Offline validation of the game's built-in metadata and Chinese dictionaries."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app/src/main/assets"

def decode(path):
    value = json.loads(path.read_text(encoding="utf-8"))
    assert isinstance(value, dict), path
    return value

catalog = decode(ASSETS / "games.json")
games = catalog["games"]
assert len(games) >= 2
assert {g["id"] for g in games} >= {"digits-of-despair", "lineage-of-logic"}
assert all(g["url"].startswith("https://sudokupad.app/") for g in games)
assert all("setting-largepuzzle=1" in g["url"] for g in games[:2])

shared = decode(ASSETS / "i18n/zh-Hans.json")
assert len(shared) >= 50
for g in games:
    specific = decode(ASSETS / f'i18n/games/{g["id"]}.zh-Hans.json')
    for key, value in {**shared, **specific}.items():
        assert isinstance(key, str) and key.strip(), repr(key)
        assert isinstance(value, str) and value.strip(), (key, value)

assert not (ASSETS / "i18n/ms.json").exists(), "Chinese-only app must not ship Malay pack"
print("Chinese translation assets OK:", len(shared), "shared terms;",
      len(games), "built-in games.")

# Android touch controls and both original source HTML pages must exist.
offline = ASSETS / "offline"
manifest = decode(offline / "index.json")
for resource in ("android.css", "android.js"):
    url = "https://sudokupad.app/__android/" + resource
    item = manifest["assets"].get(url)
    assert item is not None, f"Missing offline mapping: {resource}"
    assert (offline / item["file"]).is_file(), resource
for game in games:
    assert (offline / "pages" / (game["id"] + ".html")).is_file()
    assert manifest["assets"][game["url"]]["file"].endswith(".zh-Hans.html")
assert (offline / "translation-candidates.json").is_file()
print("Offline Android touch assets, translated HTML and review catalog exist.")
