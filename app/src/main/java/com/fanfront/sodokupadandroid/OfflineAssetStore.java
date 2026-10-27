package com.fanfront.sodokupadandroid;

import android.content.res.AssetManager;
import android.net.Uri;
import android.util.Log;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

final class OfflineAssetStore {
    private final AssetManager assets;
    private final Map<String, Entry> byUrl = new HashMap<>();

    private static final class Entry {
        final String file;
        final String mime;
        Entry(String file, String mime) { this.file = file; this.mime = mime; }
    }

    OfflineAssetStore(AssetManager assets) throws IOException, JSONException {
        this.assets = assets;
        byte[] bytes;
        try (java.io.InputStream stream = assets.open("offline/index.json")) {
            java.io.ByteArrayOutputStream output = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[32768];
            int n;
            while ((n = stream.read(buffer)) >= 0) output.write(buffer, 0, n);
            bytes = output.toByteArray();
        }
        JSONObject index = new JSONObject(new String(bytes, StandardCharsets.UTF_8));
        if (index.getInt("format") != 1) throw new IOException("Unsupported snapshot");
        JSONObject map = index.getJSONObject("assets");
        java.util.Iterator<String> keys = map.keys();
        while (keys.hasNext()) {
            String url = keys.next();
            JSONObject item = map.getJSONObject(url);
            String file = item.getString("file");
            if (!file.matches("files/[a-f0-9]{64}")) throw new IOException("Unsafe path");
            byUrl.put(key(url), new Entry("offline/" + file,
                    item.optString("mime", "application/octet-stream")));
        }
    }

    private static String key(String url) {
        return Uri.parse(url).buildUpon().fragment(null).build().toString();
    }

    boolean has(String url) { return lookup(url) != null; }
    int size() { return byUrl.size(); }

    private Entry lookup(String url) {
        Uri uri = Uri.parse(key(url));
        Entry found = byUrl.get(uri.toString());
        if (found != null) return found;
        String path = uri.getPath();
        if (path != null && path.matches("(?i).*\\.(js|css|wasm|svg|png|jpg|jpeg|woff2?|ico)")) {
            return byUrl.get(uri.buildUpon().clearQuery().build().toString());
        }
        return null;
    }

    WebResourceResponse serve(WebResourceRequest request) {
        Uri uri = request.getUrl();
        String scheme = uri.getScheme();
        if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) {
            return null;
        }
        Entry e = lookup(uri.toString());
        if (e == null) {
            Log.w("SudokuPadOffline", "Missing resource: " + uri);
            return unavailable("Missing offline resource");
        }
        try {
            WebResourceResponse result = new WebResourceResponse(e.mime,
                    e.mime.startsWith("text/") || e.mime.contains("json") ||
                            e.mime.contains("javascript") ? "UTF-8" : null,
                    assets.open(e.file));
            Map<String,String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Cross-Origin-Resource-Policy", "cross-origin");
            headers.put("Cache-Control", "no-store");
            result.setResponseHeaders(headers);
            return result;
        } catch (IOException err) {
            Log.w("SudokuPadOffline", "Cannot read resource: " + e.file, err);
            return unavailable("Offline resource unavailable");
        }
    }

    private static WebResourceResponse unavailable(String message) {
        WebResourceResponse r = new WebResourceResponse("text/plain", "UTF-8",
                new ByteArrayInputStream(message.getBytes(StandardCharsets.UTF_8)));
        r.setStatusCodeAndReasonPhrase(503, "Offline Resource Missing");
        return r;
    }
}
