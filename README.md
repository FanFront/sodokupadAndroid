# SudokuPad Android — 离线移植版

**目标：** 用 Android APK 离线运行 Sudokuvania 1《Digits of Despair》与 Sudokuvania 2《Lineage of Logic》，并最终提供经人工审校的简体中文剧情与规则。

这不再是在线 WebView 或边玩边使用机器翻译的方式。离线构建步骤通过 Chromium 打开原始游戏，捕获 HTML、JS、CSS、WASM（如有）、图片、字体以及浏览器实际请求的谜题 API 响应，然后统一打包进 APK。Android WebView 仍使用原站 URL，但所有 HTTP(S) 请求会被 APK 中的拦截器改为读取本地文件，未捕获的请求会被拒绝（503），因此不会偷偷回源联网。

## 个人使用：制作 APK

1. 在你的 GitHub 项目中打开 **Actions → Build offline APK**。
2. 点击 **Run workflow**。该操作会在构建机上获取第三方网页文件；不要未经授权再公开分发打包结果。
3. 工作流会执行 `npm run capture`、`npm run verify`，然后使用 Gradle 构建 APK。
4. 只有构建**成功**之后，才到该次运行的 **Artifacts** 下载 `Sudokuvania-offline-debug-APK`。它是个人测试用的 debug APK，并不代表两部游戏所有隐藏章节均已验证可脱机运行。

## 本地构建

需要 Node 22、Java 17、Android SDK 35、Gradle 8.13 和 Chromium/Playwright。

```sh
npm install
npx playwright install chromium
npm run capture
npm run verify
npm run extract-strings
gradle :app:assembleDebug
```

生成的本地资源位于 `app/src/main/assets/offline/`，已被 `.gitignore` 排除，以免把未经许可的第三方内容推送到你的公开仓库。**没有离线资源就不能生成可玩的离线版**；应用内会显示明确的缺少资源提示。

## 简体中文化

- `app/src/main/assets/i18n/zh-Hans.json`：通用菜单和标准术语。
- `app/src/main/assets/i18n/games/<game-id>.zh-Hans.json`：某一游戏中**经人工审核**的固定文本。
- `scripts/extract-text.mjs`：从本地缓存的 HTML/JSON 提取待译候选文本，输出在被忽略的 `offline/translation-candidates.json` 中。不会自动发布包含剧透的原文清单。
- 中文文本在原文**正常显示时**按词典替换；未译文本仍显示英文。没有引入任何在线翻译服务或语言模型。译错特殊规则可能导致无解，因此宁可保留英文，也不能猜测。

## 已知限制

- Playwright 只能捕获首次加载、点击开始游戏后，以及它发现并打开的相关 SudokuPad 谜题链接。还没出现的 Boss 游戏、分支、媒体或特殊 API 请求可能缺失，遇到缺少资源时应用会拒绝访问。请按 `offline/capture-report.json` 的提示补齐，**不要认为当前的首次抓取等于完整 100% 离线镜像**。
- SudokuPad 本身没有为巨型 Sudokuvania 地图设计完备的移动端缩放/平移；APK 封装不自动解决复杂触摸手势。
- 两个游戏的**全部剧情、动态规则与隐藏谜题文本尚未取得并人工翻译完成**。现有中文词库仅覆盖常见词汇和规则概述。要达到自然、完整汉化，需要取得可审阅的游戏数据文本并逐段校对。
- 翻译只改显示文本，不改数独格子数据、答案、进度和迷雾判定。保存进度继续存储在 Android WebView 的本地存储中，清除应用数据会丢失存档。
- 原网页资源与游戏内容属于其权利人。SudokuPad 的前端源代码不是开放源代码许可项目。出于版权原因，公开仓库**不包含**网页、游戏脚本、图片或谜题资源。打包前应确认你的使用与分发权利。

## 如何扩展到其他 SudokuPad 游戏

先把新网址与唯一 `id` 加入 `app/src/main/assets/games.json`，重新运行个人抓取和 APK 构建。之后添加对应的中文词典。不同游戏共享同一个 Android 容器和离线资源格式。

## 使用的项目

- [SudokuPad](https://sudokupad.app/) (Sven Neumann)
- [Sudokuvania](https://sudokuvania.com/) (Skeptical Mario)
- [Test SudokuPad at Home](https://github.com/ewenmcneill/testsudokupadathome) 的离线缓存思路（没有复制其源代码）
