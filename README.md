# SudokuPad Android — 离线移植版

**目标：** 用 Android APK 离线运行 Sudokuvania 1《Digits of Despair》与 Sudokuvania 2《Lineage of Logic》，并最终提供经人工审校的简体中文剧情与规则。

这不再是在线 WebView 或边玩边使用机器翻译的方式。离线构建步骤通过 Chromium 打开原始游戏，捕获 HTML、JS、CSS、WASM（如有）、图片、字体以及浏览器实际请求的谜题 API 响应，然后统一打包进 APK。Android WebView 仍使用原站 URL，但所有 HTTP(S) 请求会被 APK 中的拦截器改为读取本地文件，未捕获的请求会被拒绝（503），因此不会偷偷回源联网。

## 个人使用：制作 APK

1. 在你的 GitHub 项目中打开 **Actions → Build offline APK**。
2. 点击 **Run workflow**（也会在更新 `main` 时尝试自动运行）。脚本在 Ubuntu 24.04 中下载网页资源，然后通过 GitHub Actions 自动提交资源文件。**当前仓库公开时，提交的第三方资源对所有人可见；强烈建议先将仓库设为 Private 并确认有权保存/分享这些文件。**
3. 工作流执行 `npm run capture` → `npm run build-html` → `npm run verify` → 无网络回放测试 → `npm run extract-strings`，把捕获结果提交回仓库，再使用 Gradle 构建 APK。
4. 只有构建**成功**之后，才到该次运行的 **Artifacts** 下载 `Sudokuvania-offline-debug-APK`。它是个人测试用的 debug APK，并不代表两部游戏所有隐藏章节均已验证可脱机运行。

## 本地构建

需要 Node 22、Java 17、Android SDK 35、Gradle 8.13 和 Chromium/Playwright。

```sh
npm install
npx playwright install chromium
npm run capture
npm run build-html
npm run verify
npm run extract-strings
# 在 translation-candidates.json 中填写 zhHans 后：
npm run apply-translations
npm run build-html
gradle :app:assembleDebug
```

下载结果保存于 `app/src/main/assets/offline/`。目录仍在 `.gitignore` 中，但 GitHub Actions 在你启动捕获时会强制 `git add -f` 提交它。这样你可以直接在 GitHub 中查看 HTML、JS、CSS、WASM（如果存在）等响应。**没有实际下载的离线资源就不能玩离线版本**；应用会显示错误而不是回源联网。单个超过 90 MiB 的文件会被跳过并报告。

### 直接基于 HTML 的中文化

- `app/src/main/assets/offline/pages/digits-of-despair.html`：第一部捕获的原始 HTML（可直接查看/编辑）。
- `app/src/main/assets/offline/pages/lineage-of-logic.html`：第二部原始 HTML。
- `app/src/main/assets/offline/pages/*.zh-Hans.html`：根据简体中文词典生成、**APK 实际使用**的 HTML。
- `app/src/main/assets/offline/files/`：按 URL 哈希保存的 JS、CSS、WASM、图片、字体、Puzzle API 响应。用 `offline/index.json` 把文件名映射回原始网址。
- `app/src/main/assets/offline/translation-candidates.json`：从 HTML、JSON、已解码数独对象中提取的待译英文句子列表。这份清单不代表所有隐藏剧情都已找到。

翻译步骤：打开 `offline/translation-candidates.json`，给每个需要翻译的 `english` 原句填写自然、准确的简体中文 `zhHans` 字段；完成后运行 `npm run apply-translations`，脚本会根据 `gameIds` 将译文导入通用或游戏专用词典。然后运行 `npm run build-html` 生成中文版 HTML。也可以直接编辑 `i18n/games/<game-id>.zh-Hans.json` 的**真实英文原句 → 中文译文**。原始 HTML 不会因重新捕获而被覆盖；想重新抓原始 HTML，需要手动删除 `offline/pages/<game-id>.html`。不要直接篡改 JS 内部的逻辑与数独答案。

## 简体中文化

- `app/src/main/assets/i18n/zh-Hans.json`：通用菜单和标准术语。
- `app/src/main/assets/i18n/games/<game-id>.zh-Hans.json`：某一游戏中**经人工审核**的固定文本。
- `scripts/extract-text.mjs`：从已捕获的 HTML/JSON/解码后的谜题文本中提取候选原句，保存到 `offline/translation-candidates.json`。**自动资源提交也会发布这个可能包含剧透的文件**，请勿在未确认权限时公开。
- 中文文本在原文**正常显示时**按词典替换；未译文本仍显示英文。没有引入任何在线翻译服务或语言模型。译错特殊规则可能导致无解，因此宁可保留英文，也不能猜测。

## 已知限制

- Playwright 只能捕获首次加载、点击开始游戏后，以及它发现并打开的相关 SudokuPad 谜题链接。还没出现的 Boss 游戏、分支、媒体或特殊 API 请求可能缺失，遇到缺少资源时应用会拒绝访问。请按 `offline/capture-report.json` 的提示补齐，**不要认为当前的首次抓取等于完整 100% 离线镜像**。
- SudokuPad 本身没有为巨型 Sudokuvania 地图设计完备的移动端缩放/平移；APK 封装不自动解决复杂触摸手势。
- 两个游戏的**全部剧情、动态规则与隐藏谜题文本尚未取得并人工翻译完成**。现有中文词库仅覆盖常见词汇和规则概述。要达到自然、完整汉化，需要取得可审阅的游戏数据文本并逐段校对。
- 翻译只改显示文本，不改数独格子数据、答案、进度和迷雾判定。保存进度继续存储在 Android WebView 的本地存储中，清除应用数据会丢失存档。
- 原网页资源与游戏内容属于其权利人，SudokuPad 的前端源代码不是开放源代码许可项目。现在按需求启用了**将原站资源提交到 Git 仓库**的工作流，因此建议在执行前就把仓库设为私有，并确认所需的许可。**日后改为 Private 不会撤销此前的公开访问记录或别人已创建的副本。**

## 如何扩展到其他 SudokuPad 游戏

先把新网址与唯一 `id` 加入 `app/src/main/assets/games.json`，重新运行个人抓取和 APK 构建。之后添加对应的中文词典。不同游戏共享同一个 Android 容器和离线资源格式。

## 使用的项目

- [SudokuPad](https://sudokupad.app/) (Sven Neumann)
- [Sudokuvania](https://sudokuvania.com/) (Skeptical Mario)
- [Test SudokuPad at Home](https://github.com/ewenmcneill/testsudokupadathome) 的离线缓存思路（没有复制其源代码）
