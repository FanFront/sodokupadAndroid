package com.fanfront.sodokupadandroid;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.ClipboardManager;
import android.content.ClipData;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

/**
 * Lightweight WebView host. Games remain on the SudokuPad origin so the
 * website can maintain its own saves and dynamic rules.
 */
public final class MainActivity extends Activity {
    private static final String PREFS = "sudokupad_android";
    private static final String KEY_CUSTOM_GAMES = "custom_games";
    private static final int BACKGROUND = Color.rgb(249, 248, 245);
    private static final int EXPORT_CHECKPOINT = 901;
    private static final int IMPORT_CHECKPOINT = 902;
    private static final int MAX_CHECKPOINT_BYTES = 8 * 1024 * 1024;
    private String checkpointToSave;

    private SharedPreferences preferences;
    private LinearLayout root;
    private WebView webView;
    private OfflineAssetStore offline;
    private Game selectedGame;
    private boolean landscape = false;

    private static final class Game {
        final String id;
        final String title;
        final String url;
        final boolean custom;

        Game(String id, String title, String url, boolean custom) {
            this.id = id;
            this.title = title;
            this.url = url;
            this.custom = custom;
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        try {
            offline = new OfflineAssetStore(getAssets());
        } catch (Exception error) {
            offline = null;
        }
        showHome();
    }

    private int dp(float dimension) {
        return (int) (dimension * getResources().getDisplayMetrics().density + 0.5f);
    }

    private String tr(String key) {
        return LanguageStrings.get(key);
    }

    private LinearLayout createRoot() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(BACKGROUND);
        layout.setFitsSystemWindows(true);
        return layout;
    }

    private TextView text(String value, int sp) {
        TextView label = new TextView(this);
        label.setText(value);
        label.setTextSize(sp);
        label.setTextColor(Color.rgb(28, 36, 47));
        label.setPadding(dp(5), dp(8), dp(5), dp(8));
        return label;
    }

    private Button button(String caption, View.OnClickListener click) {
        Button b = new Button(this);
        b.setText(caption);
        b.setAllCaps(false);
        b.setOnClickListener(click);
        return b;
    }

    private void newRoot() {
        closeWebView();
        root = createRoot();
        setContentView(root);
    }

    private String readAsset(String filename) throws IOException {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(getAssets().open(filename), StandardCharsets.UTF_8))) {
            StringBuilder content = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) content.append(line).append('\n');
            return content.toString();
        }
    }

    private ArrayList<Game> loadGames() {
        ArrayList<Game> games = new ArrayList<>();
        try {
            JSONObject catalog = new JSONObject(readAsset("games.json"));
            JSONArray builtIn = catalog.getJSONArray("games");
            for (int i = 0; i < builtIn.length(); i++) {
                JSONObject entry = builtIn.getJSONObject(i);
                String url = entry.getString("url");
                if (isSudokuPadUrl(Uri.parse(url))) {
                    games.add(new Game(entry.getString("id"), entry.getString("title"), url, false));
                }
            }
        } catch (IOException | JSONException exception) {
            Toast.makeText(this, "Game catalog unavailable", Toast.LENGTH_LONG).show();
        }

        try {
            JSONArray custom = new JSONArray(preferences.getString(KEY_CUSTOM_GAMES, "[]"));
            for (int i = 0; i < custom.length(); i++) {
                JSONObject entry = custom.getJSONObject(i);
                String url = entry.getString("url");
                if (isSudokuPadUrl(Uri.parse(url))) {
                    games.add(new Game(entry.optString("id", "custom"), entry.getString("title"), url, true));
                }
            }
        } catch (JSONException ignored) {
            // Invalid custom entries must not prevent the built-in games from loading.
        }
        return games;
    }

    private void showHome() {
        selectedGame = null;
        newRoot();

        ScrollView scroll = new ScrollView(this);
        root.addView(scroll, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(14), dp(14), dp(14), dp(30));
        scroll.addView(content);

        content.addView(text(tr("title"), 25));
        content.addView(text(tr("subtitle"), 17));
        content.addView(text(tr("note"), 13));
        content.addView(text(tr("builtIn"), 21));

        ArrayList<Game> games = loadGames();
        boolean customHeaderAdded = false;
        for (Game game : games) {
            if (game.custom && !customHeaderAdded) {
                content.addView(text(tr("own"), 21));
                customHeaderAdded = true;
            }
            content.addView(button(game.title + "  ▶", view -> showPlayer(game)));
        }

        if (offline == null) {
            content.addView(text("此 APK 缺少离线资源；请使用构建离线 APK 工作流重新打包。", 16));
        } else {
            content.addView(text("已加载 " + offline.size() + " 个离线资源；无需联网。", 13));
        }
        content.addView(text(tr("permission"), 13));
    }

    private static boolean isSudokuPadUrl(Uri uri) {
        return uri != null
                && "https".equalsIgnoreCase(uri.getScheme())
                && "sudokupad.app".equalsIgnoreCase(uri.getHost())
                && uri.getUserInfo() == null;
    }

    private void showAddDialog() {
        LinearLayout fields = new LinearLayout(this);
        fields.setPadding(dp(18), dp(4), dp(18), 0);
        fields.setOrientation(LinearLayout.VERTICAL);

        EditText name = new EditText(this);
        name.setSingleLine(true);
        name.setHint(tr("name"));
        fields.addView(name);

        EditText url = new EditText(this);
        url.setSingleLine(true);
        url.setInputType(android.text.InputType.TYPE_CLASS_TEXT
                | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        url.setHint(tr("link"));
        fields.addView(url);

        new AlertDialog.Builder(this)
                .setTitle(tr("addTitle"))
                .setView(fields)
                .setNegativeButton(tr("cancel"), null)
                .setPositiveButton(tr("save"), (dialog, which) -> {
                    String title = name.getText().toString().trim();
                    String address = url.getText().toString().trim();
                    if (title.isEmpty() || !isSudokuPadUrl(Uri.parse(address))) {
                        Toast.makeText(this, tr("invalid"), Toast.LENGTH_LONG).show();
                        return;
                    }
                    try {
                        JSONArray custom = new JSONArray(preferences.getString(KEY_CUSTOM_GAMES, "[]"));
                        JSONObject added = new JSONObject();
                        added.put("id", "custom-" + System.currentTimeMillis());
                        added.put("title", title);
                        added.put("url", address);
                        custom.put(added);
                        preferences.edit().putString(KEY_CUSTOM_GAMES, custom.toString()).apply();
                        Toast.makeText(this, tr("added"), Toast.LENGTH_SHORT).show();
                        showHome();
                    } catch (JSONException exception) {
                        Toast.makeText(this, tr("invalid"), Toast.LENGTH_LONG).show();
                    }
                })
                .show();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void showPlayer(Game game) {
        if (offline == null || !offline.has(game.url)) {
            new AlertDialog.Builder(this)
                    .setTitle("离线资源缺失")
                    .setMessage("尚未将此游戏打包进 APK。请重新获取资源并构建：" + game.title)
                    .setPositiveButton("确定", null).show();
            return;
        }
        selectedGame = game;
        newRoot();

        // The offline HTML provides its own Android numberpad and action dock.
        // No duplicate desktop-like Android header above the board.

        ProgressBar loading = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        loading.setMax(100);
        root.addView(loading, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        CookieManager.getInstance().setAcceptCookie(true);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int progress) {
                loading.setProgress(progress);
                loading.setVisibility(progress == 100 ? View.GONE : View.VISIBLE);
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public android.webkit.WebResourceResponse shouldInterceptRequest(
                    WebView view, WebResourceRequest request) {
                return offline.serve(request);
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri destination = request.getUrl();
                if ("sudokuandroid".equals(destination.getScheme())
                        && "home".equals(destination.getHost())) {
                    runOnUiThread(MainActivity.this::showHome);
                    return true;
                }
                if (offline.has(destination.toString())) return false;
                Toast.makeText(MainActivity.this,
                        "离线模式下无法访问未打包的链接。", Toast.LENGTH_SHORT).show();
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (isSudokuPadUrl(Uri.parse(url))) applyTranslation(view);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    Toast.makeText(MainActivity.this, tr("loadError"), Toast.LENGTH_LONG).show();
                }
            }
        });

        LinearLayout checkpointButtons = new LinearLayout(this);
        checkpointButtons.setOrientation(LinearLayout.HORIZONTAL);
        Button exportButton = button("导出存档", v -> exportCurrentCheckpoint());
        Button importButton = button("读取文件", v -> selectCheckpointFile());
        Button pasteButton = button("粘贴存档", v -> pasteCheckpoint());
        checkpointButtons.addView(exportButton, new LinearLayout.LayoutParams(0, dp(43), 1f));
        checkpointButtons.addView(importButton, new LinearLayout.LayoutParams(0, dp(43), 1f));
        checkpointButtons.addView(pasteButton, new LinearLayout.LayoutParams(0, dp(43), 1f));
        root.addView(checkpointButtons);
        root.addView(webView, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        webView.loadUrl(game.url);
    }

    private String checkpointScript() throws IOException {
        return readAsset("checkpoint-transfer.js");
    }

    private void exportCurrentCheckpoint() {
        if (webView == null) return;
        try {
            final String script = "(function(){\n" + checkpointScript()
                    + "\nreturn SudokuPadTransfer.exportCheckpoint("
                    + JSONObject.quote(webView.getUrl()) + ","
                    + JSONObject.quote(selectedGame.id) + ");})()";
            webView.evaluateJavascript(script, encoded -> {
                try {
                    String payload = new JSONArray("[" + encoded + "]").getString(0);
                    JSONObject checkpoint = new JSONObject(payload);
                    if (checkpoint.has("error")) throw new JSONException(checkpoint.getString("error"));
                    if (!"sudokupadx-checkpoint".equals(checkpoint.optString("format")))
                        throw new JSONException("不支持此存档格式");
                    checkpointToSave = payload;
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("application/json");
                    intent.putExtra(Intent.EXTRA_TITLE, "sudokupad-"
                            + selectedGame.id + "-checkpoint.json");
                    startActivityForResult(intent, EXPORT_CHECKPOINT);
                } catch (Exception error) {
                    Toast.makeText(this, "存档导出失败：" + error.getMessage(),
                            Toast.LENGTH_LONG).show();
                }
            });
        } catch (IOException error) {
            Toast.makeText(this, "缺少存档脚本：" + error.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private void selectCheckpointFile() {
        if (webView == null) return;
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        startActivityForResult(intent, IMPORT_CHECKPOINT);
    }

    private void pasteCheckpoint() {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
        ClipData data = clipboard == null ? null : clipboard.getPrimaryClip();
        CharSequence text = data == null || data.getItemCount() == 0
                ? null : data.getItemAt(0).coerceToText(this);
        if (text == null || text.length() == 0) {
            Toast.makeText(this, "剪贴板中没有存档 JSON", Toast.LENGTH_LONG).show();
            return;
        }
        if (text.length() > MAX_CHECKPOINT_BYTES) {
            Toast.makeText(this, "存档超过 8 MiB 限制", Toast.LENGTH_LONG).show();
            return;
        }
        importCheckpointFromFile(text.toString());
    }

    private String readCheckpoint(Uri uri) throws IOException {
        try (InputStream in = getContentResolver().openInputStream(uri);
                ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (in == null) throw new IOException("无法读取此文件");
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                if (output.size() + read > MAX_CHECKPOINT_BYTES)
                    throw new IOException("存档超过 8 MiB 限制");
                output.write(buffer, 0, read);
            }
            return output.toString("UTF-8");
        }
    }

    private void importCheckpointFromFile(String text) {
        if (webView == null) return;
        try {
            JSONObject cp = new JSONObject(text);
            if (!"sudokupadx-checkpoint".equals(cp.optString("format"))
                    || cp.optInt("version") != 1)
                throw new JSONException("不支持的存档格式");
            if (!cp.has("cells") || !cp.has("givens"))
                throw new JSONException("缺少存档单元");
            new AlertDialog.Builder(this)
                    .setTitle("导入存档")
                    .setMessage("导入将覆盖当前谜题的进度，建议先点“导出存档”备份。\n"
                            + "存档：" + cp.optString("title", "未命名")
                            + "\n确认当前打开的是同一道谜题？")
                    .setNegativeButton("取消", null)
                    .setPositiveButton("导入并覆盖", (dialog, which) -> {
                        try {
                            final String script = "(function(){\n" + checkpointScript()
                                    + "\nreturn SudokuPadTransfer.importCheckpoint("
                                    + JSONObject.quote(text) + ","
                                    + JSONObject.quote(webView.getUrl()) + ");})()";
                            webView.evaluateJavascript(script, encoded -> {
                                try {
                                    String result = new JSONArray("[" + encoded + "]").getString(0);
                                    JSONObject response = new JSONObject(result);
                                    if (!response.optBoolean("ok"))
                                        throw new JSONException(response.optString("error", "导入失败"));
                                    Toast.makeText(this, "已恢复 "
                                            + response.optInt("count") + " 格存档",
                                            Toast.LENGTH_LONG).show();
                                } catch (Exception error) {
                                    Toast.makeText(this, "存档导入失败：" + error.getMessage(),
                                            Toast.LENGTH_LONG).show();
                                }
                            });
                        } catch (IOException error) {
                            Toast.makeText(this, "缺少存档脚本：" + error.getMessage(),
                                    Toast.LENGTH_LONG).show();
                        }
                    }).show();
        } catch (JSONException error) {
            Toast.makeText(this, "无效存档：" + error.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK || data == null || data.getData() == null) return;
        try {
            if (requestCode == EXPORT_CHECKPOINT && checkpointToSave != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out == null) throw new IOException("无法创建存档文件");
                    out.write(checkpointToSave.getBytes(StandardCharsets.UTF_8));
                }
                checkpointToSave = null;
                Toast.makeText(this, "存档已保存到所选位置", Toast.LENGTH_LONG).show();
            } else if (requestCode == IMPORT_CHECKPOINT) {
                importCheckpointFromFile(readCheckpoint(data.getData()));
            }
        } catch (IOException error) {
            Toast.makeText(this, "存档文件操作失败：" + error.getMessage(),
                    Toast.LENGTH_LONG).show();
        }
    }

    private void applyTranslation(WebView view) {
        try {
            String script = readAsset("translate.js");
            JSONObject translations = new JSONObject(readAsset("i18n/zh-Hans.json"));
            // Each game can have its own independently reviewed Chinese entries.
            if (selectedGame != null && selectedGame.id.matches("[a-z0-9-]+")) {
                try {
                    JSONObject gameTranslations = new JSONObject(readAsset(
                            "i18n/games/" + selectedGame.id + ".zh-Hans.json"));
                    java.util.Iterator<String> keys = gameTranslations.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        translations.put(key, gameTranslations.get(key));
                    }
                } catch (IOException ignored) {
                    // No game-specific pack; common UI translations still work.
                }
            }
            String dictionary = translations.toString();
            view.evaluateJavascript(script + "\nwindow.SudokuPadAndroidTranslate(" + dictionary + ");", null);
        } catch (IOException | JSONException error) {
            Toast.makeText(this, "Translation pack unavailable", Toast.LENGTH_SHORT).show();
        }
    }

    private void showGuide() {
        if (selectedGame == null) return;
        new AlertDialog.Builder(this)
                .setTitle(tr("guideTitle"))
                .setMessage(LanguageStrings.guide(selectedGame.id))
                .setPositiveButton(tr("ok"), null)
                .show();
    }

    private void closeWebView() {
        if (webView == null) return;
        if (webView.getParent() instanceof ViewGroup) {
            ((ViewGroup) webView.getParent()).removeView(webView);
        }
        webView.stopLoading();
        webView.destroy();
        webView = null;
    }

    @Override
    public void onBackPressed() {
        if (selectedGame != null) {
            if (webView != null && webView.canGoBack()) webView.goBack();
            else showHome();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    public void onConfigurationChanged(Configuration config) {
        super.onConfigurationChanged(config);
        // Retain the same WebView and local page state during rotation.
    }

    @Override
    protected void onDestroy() {
        closeWebView();
        super.onDestroy();
    }
}
