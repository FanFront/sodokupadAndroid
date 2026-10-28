package com.fanfront.sodokupadandroid;

import java.util.HashMap;
import java.util.Map;

/** Simplified Chinese native strings and spoiler-free guides. */
final class LanguageStrings {
    private static final Map<String, String> TEXT = new HashMap<>();
    static {
        TEXT.put("title", "数独魔城 · 离线版");
        TEXT.put("subtitle", "选择要玩的谜题");
        TEXT.put("note", "离线版：游戏文件已打包在 APK 中。部分剧情与特殊规则仍未完成汉化。");
        TEXT.put("game", "开始游戏");
        TEXT.put("add", "添加数独链接");
        TEXT.put("name", "谜题名称");
        TEXT.put("link", "https://sudokupad.app/...");
        TEXT.put("addTitle", "添加自己的谜题");
        TEXT.put("invalid", "请填写名称和有效的 sudokupad.app HTTPS 链接。");
        TEXT.put("added", "谜题已添加");
        TEXT.put("cancel", "取消");
        TEXT.put("save", "保存");
        TEXT.put("home", "主页");
        TEXT.put("rules", "规则指南");
        TEXT.put("language", "语言");
        TEXT.put("reload", "重新加载");
        TEXT.put("rotate", "旋转屏幕");
        TEXT.put("guideTitle", "入门规则（无剧透）");
        TEXT.put("ok", "确定");
        TEXT.put("loadError", "资源加载失败，请检查离线包是否完整。");
        TEXT.put("permission", "无需联网。存档保存在本机，请勿清除应用数据。");
        TEXT.put("own", "我的谜题");
        TEXT.put("builtIn", "冒险数独游戏");
        TEXT.put("translateNote", "本指南已翻译，但游戏内大量剧情和规则尚未翻译。");
    }

    private LanguageStrings() { }

    static String get(String key) {
        return TEXT.getOrDefault(key, key);
    }

    static String guide(String gameId) {
        final String guide;
        if ("digits-of-despair".equals(gameId)) {
            guide = "城堡地图由多个相互连接的数独网格组成。在每个网格中，每行、每列及每个宫都需要填入指定范围的数字，不能重复。\n\n迷雾遮住部分地图。填入某些正确数字后，会揭开新的区域。特殊线索只有在学会相应规则后才能使用。注意：选择迷雾中的格子时，可能提前看到尚未解锁的规则。\n\n点选地图上的格子，可查看其所属网格；在「已学会的规则」面板里查看详细规则。";
        } else if ("lineage-of-logic".equals(gameId)) {
            guide = "完成任务即可推进故事；不一定要填完所有网格才能到达结局。除非已解锁的特殊规则另有说明，否则各网格遵循普通数独规则：同一行、列、宫内的数字不能重复。\n\n填入正确数字会驱散迷雾。探索过程中会出现新规则，但尚未揭开的区域，其规则暂时不能使用。日志、任务和物品栏可以帮助你了解进度。\n\n注意「数值」与「填入的数字」有时不同；需要依照对应的特殊规则判断。";
        } else {
            guide = "请查看原始 SudokuPad 页面上的规则。这个新增链接目前没有专属翻译。";
        }
        return guide + "\\n\\n" + get("translateNote");
    }
}
