package com.fanfront.sodokupadandroid;

import java.util.HashMap;
import java.util.Map;

/** Native app text and spoiler-free, independently summarized rule guidance. */
final class LanguageStrings {
    private static final Map<String, String[]> TEXT = new HashMap<>();

    static {
        put("title", "SudokuPad Android", "数独游戏盒", "SudokuPad Android");
        put("subtitle", "Choose a puzzle to play", "选择要玩的谜题", "Pilih teka-teki untuk dimainkan");
        put("note", "Online puzzles. Some English game text is not yet translated.", "在线游戏。部分剧情和特殊规则仍未翻译。", "Teka-teki dalam talian. Sebahagian teks permainan belum diterjemahkan.");
        put("game", "Play", "开始游戏", "Main");
        put("add", "Add SudokuPad link", "添加数独链接", "Tambah pautan SudokuPad");
        put("name", "Puzzle name", "谜题名称", "Nama teka-teki");
        put("link", "https://sudokupad.app/...", "https://sudokupad.app/...", "https://sudokupad.app/...");
        put("addTitle", "Add your own puzzle", "添加自己的谜题", "Tambah teka-teki anda");
        put("invalid", "Enter a name and a valid https://sudokupad.app/ link.", "请填写名称和有效的 sudokupad.app HTTPS 链接。", "Masukkan nama dan pautan HTTPS sudokupad.app yang sah.");
        put("added", "Puzzle added", "谜题已添加", "Teka-teki ditambah");
        put("cancel", "Cancel", "取消", "Batal");
        put("save", "Save", "保存", "Simpan");
        put("home", "Home", "主页", "Utama");
        put("rules", "Guide", "规则指南", "Panduan");
        put("language", "Language", "语言", "Bahasa");
        put("reload", "Reload", "重新加载", "Muat semula");
        put("rotate", "Rotate", "旋转屏幕", "Putar skrin");
        put("guideTitle", "Quick rules (no spoilers)", "入门规则（无剧透）", "Peraturan ringkas (tanpa pembayang)");
        put("ok", "OK", "确定", "OK");
        put("loadError", "Could not load game. Check your connection.", "游戏加载失败，请检查网络。", "Permainan gagal dimuatkan. Semak sambungan internet.");
        put("permission", "The game website needs internet. Your progress remains in this app's web storage.", "游戏需要联网，进度保存在此应用的网页存储中。", "Laman permainan memerlukan internet. Kemajuan disimpan dalam storan web aplikasi ini.");
        put("own", "Your puzzles", "我的谜题", "Teka-teki anda");
        put("builtIn", "Sudokuvania", "恶魔城数独", "Sudokuvania");
        put("translateNote", "This guide is translated, but many in-game story and rule texts are not yet available in other languages.", "本指南已翻译，但游戏内大量剧情和规则尚未翻译。", "Panduan ini diterjemahkan, tetapi banyak teks cerita dan peraturan dalam permainan belum diterjemahkan.");
    }

    private LanguageStrings() { }

    private static void put(String key, String en, String zh, String ms) {
        TEXT.put(key, new String[]{en, zh, ms});
    }

    static String get(String lang, String key) {
        String[] translations = TEXT.get(key);
        if (translations == null) return key;
        int index = "zh-Hans".equals(lang) ? 1 : "ms".equals(lang) ? 2 : 0;
        return translations[index];
    }

    static String guide(String lang, String gameId) {
        String en;
        String zh;
        String ms;
        if ("digits-of-despair".equals(gameId)) {
            en = "The castle is made of several linked Sudoku grids. Within a grid, fill each row, column and region with the permitted digits without repeats.\n\nFog hides parts of the map. Entering certain correct digits reveals new areas. Only apply a special clue after you have discovered its rule. Be careful: selecting a hidden cell may reveal rule text before you are supposed to see it.\n\nSelect a map cell to inspect its grid. Check the Learned Rules panel for rule details.";
            zh = "城堡地图由多个相互连接的数独网格组成。在每个网格中，每行、每列及每个宫都需要填入指定范围的数字，不能重复。\n\n迷雾遮住部分地图。填入某些正确数字后，会揭开新的区域。特殊线索只有在学会相应规则后才能使用。注意：选择迷雾中的格子时，可能提前看到尚未解锁的规则。\n\n点选地图上的格子，可查看其所属网格；在「已学会的规则」面板里查看详细规则。";
            ms = "Istana terdiri daripada beberapa grid Sudoku yang bersambung. Isikan digit yang dibenarkan pada setiap baris, lajur dan rantau tanpa pengulangan.\n\nKabus menyembunyikan sebahagian peta. Digit tertentu yang betul akan membuka kawasan baharu. Gunakan petunjuk khas hanya selepas peraturannya dipelajari. Memilih sel berkabus mungkin memperlihatkan peraturan terlalu awal.\n\nPilih sel peta untuk melihat gridnya. Rujuk panel peraturan yang telah dipelajari untuk maklumat lanjut.";
        } else if ("lineage-of-logic".equals(gameId)) {
            en = "Complete quests to move through the story; you do not have to finish every grid to reach an ending. Unless a newly discovered rule says otherwise, each Sudoku grid uses its usual no-repeat rules for rows, columns and boxes.\n\nCorrect entries remove fog. New grid rules appear as you explore, but rules for still-hidden areas should not be used yet. The journal, quests and inventory guide your progress.\n\nA cell's value can sometimes differ from its written digit: follow any special rule that explains the difference.";
            zh = "完成任务即可推进故事；不一定要填完所有网格才能到达结局。除非已解锁的特殊规则另有说明，否则各网格遵循普通数独规则：同一行、列、宫内的数字不能重复。\n\n填入正确数字会驱散迷雾。探索过程中会出现新规则，但尚未揭开的区域，其规则暂时不能使用。日志、任务和物品栏可以帮助你了解进度。\n\n注意「数值」与「填入的数字」有时不同；需要依照对应的特殊规则判断。";
            ms = "Selesaikan misi untuk meneruskan cerita; tidak semua grid perlu dilengkapkan untuk mencapai pengakhiran. Melainkan peraturan baharu menyatakan sebaliknya, setiap grid mengikut peraturan Sudoku biasa: tiada digit berulang dalam baris, lajur atau kotak.\n\nIsian yang betul menghapuskan kabus. Peraturan baharu muncul semasa penerokaan, tetapi peraturan kawasan tersembunyi belum boleh digunakan. Jurnal, misi dan inventori membantu anda menjejak kemajuan.\n\nNilai sel kadangkala berbeza daripada digit yang ditulis. Ikut peraturan khas yang menerangkan perbezaan itu.";
        } else {
            en = "Use the rules on the original SudokuPad page. This app has no puzzle-specific translation for this link yet.";
            zh = "请查看原始 SudokuPad 页面上的规则。这个新增链接目前没有专属翻译。";
            ms = "Rujuk peraturan pada halaman SudokuPad asal. Belum ada terjemahan khusus untuk pautan ini.";
        }
        String result = "zh-Hans".equals(lang) ? zh : "ms".equals(lang) ? ms : en;
        return result + "\n\n" + get(lang, "translateNote");
    }
}
