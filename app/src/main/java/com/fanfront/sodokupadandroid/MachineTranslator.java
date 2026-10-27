package com.fanfront.sodokupadandroid;

import androidx.webkit.JavaScriptReplyProxy;

import com.google.mlkit.common.model.DownloadConditions;
import com.google.mlkit.nl.translate.TranslateLanguage;
import com.google.mlkit.nl.translate.Translation;
import com.google.mlkit.nl.translate.Translator;
import com.google.mlkit.nl.translate.TranslatorOptions;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * On-device English-to-Chinese translation for text shown inside SudokuPad.
 * No game story is bundled, uploaded or stored in our application.
 *
 * All methods are invoked on the UI thread by MainActivity and ML Kit callbacks.
 */
final class MachineTranslator {
    private final Translator translator;
    private boolean ready;
    private boolean downloading;
    private boolean closed;
    private final ArrayList<Runnable> readyCallbacks = new ArrayList<>();
    private final LinkedHashMap<String, String> cache = new LinkedHashMap<String, String>(128, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, String> eldest) {
            return size() > 600;
        }
    };

    MachineTranslator() {
        TranslatorOptions options = new TranslatorOptions.Builder()
                .setSourceLanguage(TranslateLanguage.ENGLISH)
                .setTargetLanguage(TranslateLanguage.CHINESE)
                .build();
        translator = Translation.getClient(options);
    }

    boolean isReady() {
        return ready && !closed;
    }

    void prepare(Runnable onReady, java.util.function.Consumer<String> onError) {
        if (closed) return;
        if (ready) {
            onReady.run();
            return;
        }
        readyCallbacks.add(onReady);
        if (downloading) return;
        downloading = true;
        // ML Kit's model is ~30MB. Never initiate mobile-data downloads by default.
        DownloadConditions conditions = new DownloadConditions.Builder().requireWifi().build();
        translator.downloadModelIfNeeded(conditions)
                .addOnSuccessListener(unused -> {
                    if (closed) return;
                    ready = true;
                    downloading = false;
                    for (Runnable callback : readyCallbacks) callback.run();
                    readyCallbacks.clear();
                })
                .addOnFailureListener(error -> {
                    if (closed) return;
                    downloading = false;
                    readyCallbacks.clear();
                    onError.accept(error.getLocalizedMessage());
                });
    }

    void translate(int id, String source, JavaScriptReplyProxy reply) {
        if (closed || !ready || id < 1 || id > 10000000 || source == null
                || source.length() > 1000 || source.trim().length() < 4) {
            replyText(reply, id, "");
            return;
        }
        String cached = cache.get(source);
        if (cached != null) {
            replyText(reply, id, cached);
            return;
        }
        translator.translate(source)
                .addOnSuccessListener(translated -> {
                    if (closed) return;
                    String result = translated == null ? "" : translated.trim();
                    cache.put(source, result);
                    replyText(reply, id, result);
                })
                .addOnFailureListener(error -> replyText(reply, id, ""));
    }

    private void replyText(JavaScriptReplyProxy reply, int id, String result) {
        if (closed) return;
        try {
            JSONObject response = new JSONObject();
            response.put("id", id);
            response.put("translated", result);
            reply.postMessage(response.toString());
        } catch (JSONException ignored) {
            // User's original English text remains visible.
        }
    }

    void close() {
        closed = true;
        readyCallbacks.clear();
        cache.clear();
        translator.close();
    }
}
