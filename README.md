# SudokuPad Android — 离线移植版

**目标：** 用 Android APK 离线运行 Sudokuvania 1《Digits of Despair》与 Sudokuvania 2《Lineage of Logic》，并最终提供经人工审校的简体中文剧情与规则。

这不再是在线 WebView 或边玩边使用机器翻译的方式。离线构建步骤通过 Chromium 打开原始游戏，捕获 HTML、JS、CSS、WASM（如有）、图片、字体以及浏览器实际请求的谜题 API 响应，然后统一打包进 APK。Android WebView 仍使用原站 URL，但所有 HTTP(S) 请求会被 APK 中的拦截器改为读取本地文件，未捕获的请求会被拒绝（503），因此不会偷偷回源联网。

## 个人使用：制作 APK

1. 在你的 GitHub 项目中打开 **Actions → Build offline APK**。
2. 只有需要**更新/扩充**网页资源时才点击 **Run workflow**。普通推送只从已提交的 `offline/` 构建 APK，不会重新下载游戏。手动抓取脚本在 Ubuntu 24.04 中下载网页资源，然后通过 GitHub Actions 自动提交资源文件。**当前仓库公开时，提交的第三方资源对所有人可见；强烈建议先将仓库设为 Private 并确认有权保存/分享这些文件。**
3. 手动抓取流程执行 `npm run capture` → `npm run build-html` → `npm run build-puzzle-zh` → `npm run verify` → `npm run extract-strings` → 提交资源 → Gradle 构建 → 离线回放测试。`main` 普通推送会运行更快的 **build-cached-apk**，并上传 `Sudokuvania-android-touch-debug-APK`。
4. 只有构建**成功**之后，才到该次运行的 **Artifacts** 下载 `Sudokuvania-offline-debug-APK`。它是个人测试用的 debug APK，并不代表两部游戏所有隐藏章节均已验证可脱机运行。

## 本地构建

需要 Node 22、Java 17、Android SDK 35、Gradle 8.13 和 Chromium/Playwright。

```sh
npm install
npx playwright install chromium
npm run capture
npm run apply-translations
npm run build-html
npm run build-puzzle-zh
npm run verify
npm run extract-strings
# 在 translation-candidates.json 中填写 zhHans 后：
npm run apply-translations
npm run build-html
npm run build-puzzle-zh
gradle :app:assembleDebug
```

下载结果保存于 `app/src/main/assets/offline/`。目录仍在 `.gitignore` 中，但 GitHub Actions 在你启动捕获时会强制 `git add -f` 提交它。这样你可以直接在 GitHub 中查看 HTML、JS、CSS、WASM（如果存在）等响应。**没有实际下载的离线资源就不能玩离线版本**；应用会显示错误而不是回源联网。单个超过 90 MiB 的文件会被跳过并报告。

### 直接基于 HTML 的中文化

- `app/src/main/assets/offline/pages/digits-of-despair.html`：第一部捕获的原始 HTML（可直接查看/编辑）。
- `app/src/main/assets/offline/pages/lineage-of-logic.html`：第二部原始 HTML。
- `app/src/main/assets/offline/pages/*.zh-Hans.html`：根据简体中文词典生成、**APK 实际使用**的 HTML。
- `app/src/main/assets/offline/files/`：按 URL 哈希保存的原始 JS、CSS、WASM、图片、字体和原版 Puzzle API 响应。
- `app/src/main/assets/offline/translated/`：从原版 `scl` 压缩数据生成的中文版游戏包。只对 `metadata.rules`、`metadata.msgcorrect` 和 `metadata.grids[*].rules` 中**已有人工译文**的字符串进行替换。构建脚本会对解压/重压结果做一致性验证，并检查其他游戏数据未被改变。APK 的离线 API 响应指向这些中文版文件。
- `app/src/main/assets/offline/translation-candidates.json`：直接解开 SudokuPad `scl` 压缩的主谜题 JSON 后提取故事、规则、任务等文本。目前已识别 420 个不同的英语片段；截至本次改动，已为所提取的全部 420 条提供简体中文译文（仍须持续审校）。这份清单不代表所有隐藏副本已找到。

翻译修复：先运行 `npm run apply-translations`，再运行 `npm run build-html && npm run build-puzzle-zh`；只修改候选清单、不导入词典会导致棋盘仍显示英文。CI 现会检查词典与候选清单保持一致，并在打包前自动导入。

翻译步骤：打开 `offline/translation-candidates.json`，给每个需要翻译的 `english` 原句填写自然、准确的简体中文 `zhHans` 字段；完成后运行 `npm run apply-translations`，脚本会根据 `gameIds` 将译文导入通用或游戏专用词典。然后运行 `npm run build-html && npm run build-puzzle-zh`，重新生成中文版 HTML **和**压缩的中文版谜题数据。也可以直接编辑 `i18n/games/<game-id>.zh-Hans.json` 的**真实英文原句 → 中文译文**。原始 HTML 不会因重新捕获而被覆盖；想重新抓原始 HTML，需要手动删除 `offline/pages/<game-id>.html`。不要直接篡改 JS 内部的逻辑与数独答案。

## Android 专用触屏界面

- `app/src/main/assets/offline/mobile/android.css`：隐藏原网页头栏、赞助和 PC 侧边控制区，把棋盘留在屏幕上方，底部固定大按钮。
- `app/src/main/assets/offline/mobile/android.js`：自带中文控制台，支持数字 0–9、删除、撤销/重做、数字/角标/中心/颜色/画线/字母工具、检查、规则和主页。
- 选 **移动** 后可单指拖动地图、双指尝试缩放；点击 **＋**/**－** 也可缩放。关掉移动模式，恢复正常点格填数。触摸缩放基于 SudokuPad 已有的大棋盘功能，真机兼容性仍须验证。
- 打包时 `npm run build-html` 将上述 CSS/JS 注入两部游戏的 `*.zh-Hans.html`；不会删除原棋盘 DOM、题目 JS 或存档逻辑。
- 画线/字母工具在原站相关模块就绪时启用；不可用时会显示中文提示。

## 简体中文化

- `app/src/main/assets/i18n/zh-Hans.json`：通用菜单和标准术语。
- `app/src/main/assets/i18n/games/<game-id>.zh-Hans.json`：某一游戏中**经人工审核**的固定文本。
- `scripts/extract-text.mjs`：从已捕获的 HTML/JSON/解码后的谜题文本中提取候选原句，保存到 `offline/translation-candidates.json`。**自动资源提交也会发布这个可能包含剧透的文件**，请勿在未确认权限时公开。
- 主要剧情、网格规则通过离线重打包写入游戏自身压缩数据中，使它们直接以中文显示；其他动态 UI 标签才采用无需联网的展示层词典替换。没有在线翻译服务或语言模型。尚未审稿的英语保持原文；误译数学规则可能改变解谜结论，因此必须认真校对。

## 首领谜题与独立副本（Android）

- 地图中选中**已探索的区域格子**后，按底部 **「区域」** 查看原版当前选区规则；按 **「首领」** 查看其中的首领谜题链接。链接始终由 SudokuPad 的动态 gridrules 组件生成，不擅自绕过迷雾或猜测首领位置。首次未显示链接时，继续探索、切换到所属网格内已揭开的格子后再查看。
- 轻触首领链接会在**同一个 WebView** 打开已捕获的独立题目，保留 SudokuPad 原本的按题目自动存档功能。副本中的底部 **「返回」** 可通过页面历史回到地图；Android 系统返回键同样生效。副本使用与主地图相同的中文手机触摸按键，且不会被错误移动到大地图入口坐标。
- 抓取程序以离线 translation-candidates.json 中地图已明确给出的 Markdown 链接为种子，并从解码后的 scl 中进一步发现隐藏页。当前翻译目录可识别 **20 个首领链接**和约 **50 个独立/支线页面链接**。这只是源地图里的已知链接清单，不代表作者未来更新的所有分支。
- 离线 index.json 的 requiredBossPuzzles 会列出本次抓取实际要求的首领副本；离线校验强制检查每个首领的 **HTML 页面、API 谜题数据和手机控制脚本**。没有这些资源的包不得被视为首领功能已完成。capture-report.json 会记录缺失链接。
- 新资源必须由仓库 **Actions → Build offline APK → Run workflow** 重新捕获。通常的 main 推送只重建已缓存的离线内容，**不会补上新副本**。单次显式抓取也可以由带 [capture-bosses] 标记的推送请求（本次迭代使用）；普通后续推送不会再次抓取。

**版权与分发：** 捕获的首领/敌人题目是第三方创作，本工作流会自动提交到仓库。仓库当前为公开仓库时，资源会对外公开。运行任何捕获前请确认所需权限并优先使用私有仓库。

## 首领谜题完整简体中文化

首领副本的剧情、规则、通关文字不是主地图的文本字段。两部游戏共 20 个已导入的首领谜题，现在分别提供可维护的中文翻译，保存在 `app/src/main/assets/i18n/bosses/<首领ID>.zh-Hans.json`，包含 `title`、`rules`、`msgcorrect`。译文保留所有数学规则、关卡后续链接和首领格答案数字。

离线构建顺序：

```sh
npm run build-html
npm run build-puzzle-zh
npm run build-boss-zh
npm run verify
npm run test-boss-zh
```

其中 `build-boss-zh` 从**原始首领 SCL**读取数据，分别处理 Sudokuvania 1 的标准 JSON 压缩包和 Sudokuvania 2 的 SudokuMaker 紧凑字面量压缩包。**不会使用 eval** 处理第三方题目数据；只替换标题（原数据中有标题时）、规则和通关剧情，再压缩成新的 `translated/boss-*.scl`。测试会把翻译字段还原，并逐字对比未修改的全部数独数据，检查题目答案和其他数独规则没有变化。手机页面标题也以中文版生成。

`npm run build-html` 会始终从 `originalFile` 重建独立副本，解决重复构建时新词典无法生效的问题。正常推送已自动运行以上流程并生成新的 APK，无需重新抓取第三方谜题。

注意：二代首领有些原始胜利剧情包含继续前进和简化版的链接；汉化保留网址原样。尚未打包的分支依然不能离线进入，并非汉化失败。

## 已知限制

- Playwright 会从压缩题目数据中提取并发现潜在首领链接，但它仍只能捕获实际访问到的相关 SudokuPad 谜题页面和资源。还没出现的 Boss 游戏、分支、媒体或特殊 API 请求可能缺失，遇到缺少资源时应用会拒绝访问。请按 `offline/capture-report.json` 的提示补齐，**不要认为当前的首次抓取等于完整 100% 离线镜像**。
- SudokuPad 本身没有为巨型 Sudokuvania 地图设计完备的移动端操作；本仓库增加了独立的触屏移动、缩放与输入控制。尚未在真实 Android 手机上确认所有特殊手势、画线和字母谜题都正常。
- 两个主谜题的压缩数据**已成功解码**。约 420 个不同的英文文本片段已有原文与对应来源路径，其中 **420 项已填写中文译文**（包括地图上的 SVG 提示、剧情、支线、规则、任务和结局）。已提取的文字已全部覆盖，但隐藏谜题可能包含尚未捕获的英语；复杂数学规则和双关语仍需要真实游玩校对。
- 翻译只改游戏元数据中的故事与规则文字、以及 UI 显示文本，不改数独格子数据、答案、进度和迷雾判定。保存进度继续存储在 Android WebView 的本地存储中，清除应用数据会丢失存档。
- 原网页资源与游戏内容属于其权利人，SudokuPad 的前端源代码不是开放源代码许可项目。现在按需求启用了**将原站资源提交到 Git 仓库**的工作流，因此建议在执行前就把仓库设为私有，并确认所需的许可。**日后改为 Private 不会撤销此前的公开访问记录或别人已创建的副本。**

## 如何扩展到其他 SudokuPad 游戏

先把新网址与唯一 `id` 加入 `app/src/main/assets/games.json`，重新运行个人抓取和 APK 构建。之后添加对应的中文词典。不同游戏共享同一个 Android 容器和离线资源格式。

## 使用的项目

- [SudokuPad](https://sudokupad.app/) (Sven Neumann)
- [Sudokuvania](https://sudokuvania.com/) (Skeptical Mario)
- [Test SudokuPad at Home](https://github.com/ewenmcneill/testsudokupadathome) 的离线缓存思路（没有复制其源代码）
