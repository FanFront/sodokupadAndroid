package com.fanfront.sodokupadandroid;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
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

import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import java.util.Collections;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
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

    private SharedPreferences preferences;
    private LinearLayout root;
    private WebView webView;
    private Button translateButton;
    private MachineTranslator machineTranslator;
    private boolean machineEnabled = false;
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
        machineTranslator = new MachineTranslator();
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
        translateButton = null;
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

        content.addView(button("+ " + tr("add"), view -> showAddDialog()));
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
        selectedGame = game;
        newRoot();

        HorizontalScrollView toolbarScroll = new HorizontalScrollView(this);
        toolbarScroll.setHorizontalScrollBarEnabled(false);
        root.addView(toolbarScroll);

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setPadding(dp(3), 0, dp(3), 0);
        toolbarScroll.addView(toolbar);

        toolbar.addView(button("‹ " + tr("home"), v -> showHome()));
        toolbar.addView(button(tr("rules"), v -> showGuide()));
        translateButton = button(machineEnabled ? "显示英文" : "全文翻译",
                v -> toggleMachineTranslation());
        toolbar.addView(translateButton);
        toolbar.addView(button(tr("reload"), v -> { if (webView != null) webView.reload(); }));
        toolbar.addView(button(tr("rotate"), v -> {
            landscape = !landscape;
            setRequestedOrientation(landscape
                    ? ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                    : ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }));

        ProgressBar loading = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        loading.setMax(100);
        root.addView(loading, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));

        webView = new WebView(this);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            // Unlike addJavascriptInterface, this listener is restricted to the
            // trusted SudokuPad origin; third-party frames cannot invoke it.
            WebViewCompat.addWebMessageListener(webView, "SudokuTranslate",
                    Collections.singleton("https://sudokupad.app"),
                    (view, message, origin, mainFrame, reply) -> {
                        if (!mainFrame || !"https://sudokupad.app".equals(origin.toString())
                                || !machineEnabled || !machineTranslator.isReady()) return;
                        try {
                            JSONObject request = new JSONObject(message.getData());
                            machineTranslator.translate(request.getInt("id"),
                                    request.getString("text"), reply);
                        } catch (JSONException ignored) {
                            // Malformed remote messages have no native side effects.
                        }
                    });
        }
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
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
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri destination = request.getUrl();
                if (isSudokuPadUrl(destination)) return false;
                String scheme = destination.getScheme();
                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, destination));
                    } catch (Exception ignored) {
                        Toast.makeText(MainActivity.this, tr("loadError"), Toast.LENGTH_SHORT).show();
                    }
                }
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

        root.addView(webView, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        webView.loadUrl(game.url);
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
            boolean enableMachine = machineEnabled && machineTranslator.isReady()
                    && WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER);
            view.evaluateJavascript(script + "\nwindow.SudokuPadAndroidTranslate(" + dictionary
                    + ", " + enableMachine + ");", null);
        } catch (IOException | JSONException error) {
            Toast.makeText(this, "Translation pack unavailable", Toast.LENGTH_SHORT).show();
        }
    }

    /**
     * ML Kit translates only on the device, after an explicit Wi-Fi model download.
     * Returning to English never changes puzzle state, only displayed text nodes.
     */
    private void toggleMachineTranslation() {
        if (machineEnabled) {
            machineEnabled = false;
            if (translateButton != null) translateButton.setText("全文翻译");
            if (webView != null) webView.evaluateJavascript(
                    "window.__spAndroidTranslator && window.__spAndroidTranslator.setMachine(false);", null);
            Toast.makeText(this, "已关闭自动翻译；可对照英文原文", Toast.LENGTH_SHORT).show();
            return;
        }
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            Toast.makeText(this, "系统 WebView 版本过旧，无法使用动态翻译", Toast.LENGTH_LONG).show();
            return;
        }
        if (machineTranslator.isReady()) {
            enableMachineTranslation();
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle("启用中文全文机翻")
                .setMessage("首次使用需通过 Wi-Fi 下载约 30 MB 的英中语言模型。下载后，文字在手机本地翻译。"
                        + "剧情与新解锁的文字会尽量自动翻译，但 SVG 图片文字和复杂数独规则可能不准确。"
                        + "如遇歧义，请关闭翻译，查看英文原文。")
                .setNegativeButton("取消", null)
                .setPositiveButton("通过 Wi-Fi 下载", (dialog, which) -> {
                    Toast.makeText(this, "正在下载中文翻译模型（仅 Wi-Fi）…", Toast.LENGTH_LONG).show();
                    machineTranslator.prepare(this::enableMachineTranslation,
                            error -> Toast.makeText(this, "翻译模型下载失败，请连接 Wi-Fi 后重试",
                                    Toast.LENGTH_LONG).show());
                })
                .show();
    }

    private void enableMachineTranslation() {
        machineEnabled = true;
        if (translateButton != null) translateButton.setText("显示英文");
        if (webView != null) webView.evaluateJavascript(
                "window.__spAndroidTranslator && window.__spAndroidTranslator.setMachine(true);", null);
        Toast.makeText(this, "已启用中文翻译；复杂规则请与英文核对", Toast.LENGTH_LONG).show();
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
        if (machineTranslator != null) machineTranslator.close();
        super.onDestroy();
    }
}
