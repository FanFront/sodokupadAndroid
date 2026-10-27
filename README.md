# SudokuPad Android

A small **unofficial** Android companion app for playing SudokuPad puzzles. Built initially for **Sudokuvania: Digits of Despair** and **Sudokuvania 2: Lineage of Logic**, with an extensible game list and translation packs.

> This is a work-in-progress WebView companion, **not** a reimplementation or offline distribution of SudokuPad or the puzzles. The puzzles are hosted by [SudokuPad](https://sudokupad.app/) and were created by Skeptical Mario. SudokuPad was made by Sven Neumann. This project is not affiliated with either creator.

## Current features

- Two preconfigured Sudokuvania games with the requested `setting-nogrid=1&setting-largepuzzle=1` URL settings.
- Add additional `https://sudokupad.app/...` puzzles from within the app without changing the Java source.
- Local game catalog in `app/src/main/assets/games.json` for future built-in games.
- The Android menus and brief guides use **Simplified Chinese (简体中文) only**, plus *selected, exact-match* SudokuPad UI translations. Untranslated content remains in English.
- Reviewed exact-match Chinese terminology takes priority in `app/src/main/assets/i18n/`.
- **Opt-in on-device ML Kit English→Chinese translator** for visible, newly revealed story, quest and rule text that does not have a reviewed translation. Tap **全文翻译** inside a game and approve the ~30 MB Wi-Fi-only language model download. Tap the same button (then shown as **显示英文** after reopening a game) to compare the original English text.
- Dynamic text-node translation watches the site's HTML and eligible SVG text; it does not rewrite original puzzle data, puzzle answers, or stored progress. This is **machine translation, not a proofread complete Chinese script**.
- WebView DOM/local storage enabled. The app does **not** clear website data when switching games or relaunching.
- Landscape-mode toggle for large grids. Pinch zoom is enabled in WebView, but **this cannot guarantee Sudokuvania zoom or pan works on Android**.
- Minimal permissions: internet only. No ad SDK, analytics SDK, injected native JS bridge, or unrestricted browsing.
- GitHub Actions builds an Android **debug APK** as a downloadable workflow artifact.

## Important limitations

1. **Internet connection required.** The app loads the original SudokuPad website, not local copies of its assets.
2. **Machine translation ≠ fully reviewed translation.** Live English text is translated on-device once the model is installed and enabled, including many dynamically revealed story and rule descriptions. Some text hidden in images/canvas/tooltips or inaccessible to the DOM remains English; some dynamically rendered SVG text may overflow. Do not trust machine translations for subtle rules; use **显示英文** to compare. The hand-reviewed translation files currently cover menus, selected terms, and a basic guide, **not the complete original game manuscripts**.
3. Sudokuvania is primarily designed for desktop. Its developer specifically notes that mobile zooming/panning and some pen-tool controls are unsupported. The orientation toggle and WebView zoom options are experimental conveniences, not fixes to the source engine.
4. SudokuPad saves progress in its own browser storage. Data in **this app** is separate from Chrome or another browser; installing a new app or clearing Android app data can erase saved progress. Keep the same Android package ID and do not clear storage. Use SudokuPad's export/backup features if available.
5. The APK created by CI is debug-signed, appropriate for personal testing. A release APK needs your own signing key and release process.
6. The puzzle and site artwork, data and story are owned by their respective creators. This repository intentionally does not bundle those works. Ask the rights holders before redistributing translated game content or publishing an unofficial bundle.

## Translation architecture

- AndroidX WebKit uses an **origin-scoped** message listener on `https://sudokupad.app` for asynchronous JS→native translation. Third-party iframes are excluded; no `addJavascriptInterface` bridge is used.
- On-device ML Kit translation model is downloaded **only after consent, only via Wi-Fi**. Text goes through the local model, not a custom translation server. ML Kit may still send diagnostic/model metadata; see [Google's disclosures](https://developers.google.com/ml-kit/android-data-disclosure).
- The shared `zh-Hans.json` and per-game dictionaries override machine output for short verified terms. The dynamically revealed text is translated when it appears; we do not unlock any clues or quests early.
- Original English appears if the model is unavailable, a translation fails, or the player disables automatic translation. A comparison switch is provided.

## Build with GitHub Actions

Open **Actions** → **Build debug APK** → **Run workflow** (or push to `main`). After the job succeeds, open the workflow run and download the `SudokuPadAndroid-debug-APK` artifact. Unzip it and install `app-debug.apk` on Android 8.0+.

For local builds, install JDK 17, Android SDK 35, and Gradle 8.13, then run:

```bash
gradle :app:assembleDebug
```

The source project can also be opened in Android Studio; the Gradle wrapper executable/JAR is not currently vendored.

## How to add games and translations

- **New built-in game:** add `{"id":"unique-id","title":"Game name","url":"https://sudokupad.app/puzzle-id"}` to `app/src/main/assets/games.json`. Or use the app's Add puzzle form, which stores personal links only on that phone.
- **Chinese translations:** update the shared `app/src/main/assets/i18n/zh-Hans.json`, or use `app/src/main/assets/i18n/games/<game-id>.zh-Hans.json` for game-specific phrases. The app merges a matching game dictionary into the common Chinese dictionary. Other languages are deliberately unsupported.
- **More translations for existing games:** add exact original UI snippets as JSON keys with Simplified Chinese values. Avoid spoilers. Please review rules carefully: a mistranslation can change how a sudoku is solved.
- **Real full game localization:** coordinate with puzzle creators, obtain a translatable data source or an authorized localization mechanism, and audit generated rules, narrative, quests, and SVG-rendered labels. The existing DOM translator is only a best-effort enhancement.

## Credits

- [SudokuPad](https://sudokupad.app/) — Sven Neumann.
- [Sudokuvania](https://sudokuvania.com/) — Skeptical Mario.
- [Sudokuvania help and mobile limitations](https://sudokuvania.com/help-and-hints/).

## Privacy and security

The app allows top-level in-app navigation to `https://sudokupad.app` only; external sites open in your browser. JavaScript is required for gameplay. WebView local storage and cookies are deliberately preserved for save data. As with any embedded website, the remote site's own privacy policies and network requests continue to apply.
