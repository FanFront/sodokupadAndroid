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

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Locale;

/**
 * Lightweight WebView host. Games remain on the SudokuPad origin so the
 * website can maintain its own saves and dynamic rules.
 */
public final class MainActivity extends Activity {
    private static final String PREFS = "sudokupad_android";
    private static final String KEY_LANGUAGE = "language";
    private static final String KEY_CUSTOM_GAMES = "custom_games";
    private static final String[] LANGUAGE_NAMES = {"English", "简体中文", "Bahasa Melayu"};
    private static final String[] LANGUAGE_CODES = {"en", "zh-Hans", "ms"};
    private static final int BACKGROUND = Color.rgb(249, 248, 245);

    private SharedPreferences preferences;
    private String language;
    private LinearLayout root;
    private WebView webView;
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
        String defaultLanguage = Locale.getDefault().getLanguage();
        String initial = "zh".equals(defaultLanguage) ? "zh-Hans"
            : "ms".equals(defaultLanguage) ? "ms" : "en";
        language = preferences.getString(KEY_LANGUAGE, initial);
        showHome();
    }

    private int dp(float dimension) {
        return (int) (dimension * getResources().getDisplayMetrics().density + 0.5f);
    }

    private String tr(String key) {
        return LanguageStrings.get(language, key);
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
        content.addView(button(tr("language") + ": " + languageLabel(), view -> chooseLanguage()));
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

    private String languageLabel() {
        for (int i = 0; i < LANGUAGE_CODES.length; i++) {
            if (LANGUAGE_CODES[i].equals(language)) return LANGUAGE_NAMES[i];
        }
        return LANGUAGE_NAMES[0];
    }

    private void chooseLanguage() {
        new AlertDialog.Builder(this)
                .setTitle(tr("language"))
                .setItems(LANGUAGE_NAMES, (dialog, which) -> {
                    String changed = LANGUAGE_CODES[which];
                    if (changed.equals(language)) return;
                    language = changed;
                    preferences.edit().putString(KEY_LANGUAGE, language).apply();
                    if (selectedGame == null) showHome();
                    else showPlayer(selectedGame); // Reload document so text starts in its original language.
                })
                .show();
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
        toolbar.addView(button(tr("language"), v -> chooseLanguage()));
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
        if ("en".equals(language)) return;
        try {
            String script = readAsset("translate.js");
            String localeJson = readAsset("i18n/" + language + ".json");
            // Parse before injection to fail closed on malformed local assets.
            String dictionary = new JSONObject(localeJson).toString();
            view.evaluateJavascript(script + "\nwindow.SudokuPadAndroidTranslate(" + dictionary + ");", null);
        } catch (IOException | JSONException error) {
            Toast.makeText(this, "Translation pack unavailable", Toast.LENGTH_SHORT).show();
        }
    }

    private void showGuide() {
        if (selectedGame == null) return;
        new AlertDialog.Builder(this)
                .setTitle(tr("guideTitle"))
                .setMessage(LanguageStrings.guide(language, selectedGame.id))
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
