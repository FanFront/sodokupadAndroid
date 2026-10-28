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
import os
allow_pending = os.environ.get("SUDOKU_ALLOW_PENDING_CAPTURE", "").lower() == "true"
for game in games:
    if allow_pending and game["id"].startswith("super-sudokoid-") and game["url"] not in manifest["assets"]:
        print("Pending targeted offline capture:", game["id"])
        continue
    assert (offline / "pages" / (game["id"] + ".html")).is_file()
    assert manifest["assets"][game["url"]]["file"].endswith(".zh-Hans.html")

candidates = json.loads((offline / "translation-candidates.json").read_text(encoding="utf-8"))
assert isinstance(candidates, list), "Translation catalog must be a list"
reviewed = 0
for item in candidates:
    en, zh = item.get("english", ""), item.get("zhHans", "")
    if not isinstance(en, str) or not isinstance(zh, str) or not zh.strip():
        continue  # Newly discovered unreviewed text can remain in English.
    reviewed += 1
    for game_id in item.get("gameIds", []):
        terms = decode(ASSETS / f'i18n/games/{game_id}.zh-Hans.json')
        actual = terms.get(en, shared.get(en))
        assert actual == zh, (
            f"Chinese translation missing from shipped dictionary: {game_id}: {en[:100]!r}"
        )
assert reviewed >= 400, f"Expected localized text candidates, found {reviewed}"
print(f"Offline puzzle source/catalog synced: {reviewed}/{len(candidates)} translated.")


# Every authored Super Sudokoid main-map text candidate must be localized.
import re
for super_id in ("super-sudokoid-1", "super-sudokoid-2"):
    entries = [item for item in candidates if super_id in item.get("gameIds", [])]
    assert len(entries) >= 160, f"Incomplete {super_id} text extraction: {len(entries)}"
    for item in entries:
        zh = item.get("zhHans", "")
        assert isinstance(zh, str) and re.search(r"[\u3400-\u9fff]", zh), (
            f"Untranslated Super Sudokoid main-map text: {super_id} "
            + repr(item.get("english", "")[:100])
        )
        urls = lambda text: sorted(re.findall(r"https://sudokupad\\.app/[^\\s)]+", text))
        assert urls(item["english"]) == urls(zh), (
            f"Game links modified by translation: {super_id}"
        )

# Every imported Super Sudokoid linked puzzle must have Chinese metadata.
linked = json.loads((offline / "super-linked-chinese-candidates.json").read_text(encoding="utf-8"))
assert len(linked) == 22, "All 22 Super Sudokoid side/boss puzzles require translations"
assert len({item["id"] for item in linked}) == len(linked)
assert {item["url"] for item in linked} == {
    item["url"] for item in manifest["superSudokoidLinkedPuzzles"]
}
for item in linked:
    for field in ("title", "rules", "msgcorrect"):
        source = item["fields"][field]["english"]
        zh = item["fields"][field]["zhHans"]
        assert isinstance(source, str) and isinstance(zh, str)
        assert source != zh and re.search(r"[\u3400-\u9fff]", zh), (
            f"Missing Chinese {field} in {item['id']}"
        )
        assert sorted(re.findall(r"https://sudokupad\\.app/[^\\s)]+", source)) == sorted(
            re.findall(r"https://sudokupad\\.app/[^\\s)]+", zh)
        ), f"Broken linked puzzle URL in {item['id']} {field}"
print("Super Sudokoid Chinese complete:", len(linked), "linked puzzles and two main maps.")
