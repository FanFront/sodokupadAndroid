# Sudokuvania Android 简体中文移植进度

最后核对：2026-10-27

## 已实施

- 已从 repo 中的原始 `offline/files/*.html`（实际上是压缩 `scl` 谜题包）解出两部游戏的元数据、开篇规则、各区域规则和结局文字。
- `offline/translation-candidates.json` 收集了目前 420 个不同的英文文本候选，含来源路径与 `zhHans` 中文编辑字段；其中 **78 项已经人工翻译**。
- 游戏通用汉化和独立文本在 `assets/i18n/zh-Hans.json`、`assets/i18n/games/*.zh-Hans.json` 中维护。
- 使用 `npm run build-puzzle-zh` 将**已审校的**剧情、规则与结局原文替换到本地解压后的元数据中，重新压缩为 `offline/translated/*.scl`，并让离线 API 加载它们。原 `offline/files/` 资源保留。
- 该脚本在覆盖映射之前进行解压-重压校验，并检查除 `metadata.rules`、`metadata.msgcorrect`、`metadata.grids[*].rules` 之外的所有字段未被改变。
- `npm run build-html` 注入 `offline/mobile/android.css`、`android.js`，隐藏桌面头栏与捐助链接，提供固定的中文版数字键盘、画线/字母、检查/撤销、移动/缩放功能。
- 没有在线翻译 API，没有云端自动机翻，也没有 Android `INTERNET` 权限。用户设备的存档仍由 SudokuPad 自己管理。

## 当前仍存在的缺口

- 420 个文字候选中仍有 **342 项没有经人工逐条翻译**（真实源资源中可能还有更多）；不能称为完整汉化。
- 该存档仅证明 2 个主谜题及部分相关文件已经捕获。首领支线、序章以及某些游戏阶段可能仍缺单独谜题包或素材。抓取器现在会从解压后的元数据寻找这些 URL，需重新运行人工抓取后验证。
- 手机上的触摸手势、横竖屏、专用笔/字母工具、地图移动与所有隐藏任务还没有通过 Android 真机全程测试。
- 当前 GitHub 是公开仓库，已经包含第三方资源。公开发布前请获得相关权利人的许可；转为私有只能限制未来访问。

## 维护步骤

```sh
npm install
npm run extract-strings          # 重新提取英文规则（保留已有译文）
# 修改 offline/translation-candidates.json 的 zhHans
npm run apply-translations       # 导入经审校的中文到词典
npm run build-html
npm run build-puzzle-zh          # 直接创建离线中文数独包
npm run verify
gradle :app:assembleDebug
```

数学规则里 **digit = 填入的数字**，**value = 数值**，二者未必相同。请重点检查 `exactly`、`only`、`at least`、`greater than`、`orthogonally adjacent` 等限定词。
