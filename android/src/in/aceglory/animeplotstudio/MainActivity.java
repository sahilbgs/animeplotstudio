package in.aceglory.animeplotstudio;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.PrintWriter;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {

    private static final String TAG = "AnimePlotStudio";
    private static final String BASE_URL = "https://anime.aceglory.in";
    private static final int REQUEST_PICK_IMAGE = 2001;

    // Active Part ID for THE LAST PAGE
    private int mActivePartId = 4;
    private int mPendingUploadSceneId = -1;
    private int mPendingUploadSceneNumber = -1;

    // UI elements
    private Button mTabScenes;
    private Button mTabReader;
    private Button mBtnRefresh;
    private ScrollView mScrollViewScenes;
    private LinearLayout mScenesContainer;
    private ProgressBar mProgressBar;
    private WebView mReaderWebView;
    private LinearLayout mUploadOverlay;
    private TextView mTxtUploadStatus;
    private TextView mTxtStoryTitle;
    private TextView mTxtPartTitle;

    // Background Thread Executor & UI Handler
    private final ExecutorService mExecutor = Executors.newFixedThreadPool(4);
    private final Handler mMainHandler = new Handler(Looper.getMainLooper());
    private final Map<String, Bitmap> mBitmapCache = new ConcurrentHashMap<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().setStatusBarColor(0xFF090E17);
        }

        initViews();
        setupTabs();
        setupReaderWebView();

        // Load scenes from server immediately
        loadScenesFromServer();
    }

    private void initViews() {
        mTabScenes = (Button) findViewById(R.id.tabScenes);
        mTabReader = (Button) findViewById(R.id.tabReader);
        mBtnRefresh = (Button) findViewById(R.id.btnRefresh);
        mScrollViewScenes = (ScrollView) findViewById(R.id.scrollViewScenes);
        mScenesContainer = (LinearLayout) findViewById(R.id.scenesContainer);
        mProgressBar = (ProgressBar) findViewById(R.id.progressBar);
        mReaderWebView = (WebView) findViewById(R.id.readerWebView);
        mUploadOverlay = (LinearLayout) findViewById(R.id.uploadOverlay);
        mTxtUploadStatus = (TextView) findViewById(R.id.txtUploadStatus);
        mTxtStoryTitle = (TextView) findViewById(R.id.txtStoryTitle);
        mTxtPartTitle = (TextView) findViewById(R.id.txtPartTitle);

        mBtnRefresh.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                loadScenesFromServer();
            }
        });
    }

    private void setupTabs() {
        mTabScenes.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                selectScenesTab();
            }
        });

        mTabReader.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                selectReaderTab();
            }
        });
    }

    private void selectScenesTab() {
        mTabScenes.setBackgroundResource(R.drawable.tab_selected_bg);
        mTabScenes.setTextColor(0xFFFFFFFF);
        mTabReader.setBackgroundResource(R.drawable.tab_unselected_bg);
        mTabReader.setTextColor(0xFF94A3B8);

        mScrollViewScenes.setVisibility(View.VISIBLE);
        mReaderWebView.setVisibility(View.GONE);
    }

    private void selectReaderTab() {
        mTabReader.setBackgroundResource(R.drawable.tab_selected_bg);
        mTabReader.setTextColor(0xFFFFFFFF);
        mTabScenes.setBackgroundResource(R.drawable.tab_unselected_bg);
        mTabScenes.setTextColor(0xFF94A3B8);

        mScrollViewScenes.setVisibility(View.GONE);
        mReaderWebView.setVisibility(View.VISIBLE);
        mReaderWebView.loadUrl(BASE_URL + "/#reader");
    }

    private void setupReaderWebView() {
        WebSettings settings = mReaderWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);

        mReaderWebView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                // Ensure auth as Sahil
                String authScript = "javascript:(function() {" +
                        "try {" +
                        "  var current = localStorage.getItem('anime_plot_auth');" +
                        "  if (!current) {" +
                        "    localStorage.setItem('anime_plot_auth', JSON.stringify({" +
                        "      token: 'tok_sahil_native_app'," +
                        "      user: { id: 5, username: 'sahil', display_name: 'Sahil', role: 'Manager', avatar_color: '#4f46e5', avatar_emoji: '🎨' }" +
                        "    }));" +
                        "  }" +
                        "} catch(e) {}" +
                        "})();";
                view.loadUrl(authScript);
            }
        });
    }

    /**
     * Connects to backend API: GET /api/scenes/part/{partId}
     */
    private void loadScenesFromServer() {
        mProgressBar.setVisibility(View.VISIBLE);

        mExecutor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    URL url = new URL(BASE_URL + "/api/scenes/part/" + mActivePartId);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("GET");
                    conn.setConnectTimeout(10000);
                    conn.setReadTimeout(15000);

                    int responseCode = conn.getResponseCode();
                    if (responseCode == 200) {
                        BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                        StringBuilder response = new StringBuilder();
                        String line;
                        while ((line = in.readLine()) != null) {
                            response.append(line);
                        }
                        in.close();

                        JSONObject json = new JSONObject(response.toString());
                        if (json.optBoolean("success")) {
                            final JSONArray scenes = json.getJSONArray("scenes");
                            mMainHandler.post(new Runnable() {
                                @Override
                                public void run() {
                                    mProgressBar.setVisibility(View.GONE);
                                    renderScenesNative(scenes);
                                }
                            });
                            return;
                        }
                    }

                    throw new Exception("HTTP response " + responseCode);
                } catch (final Exception e) {
                    Log.e(TAG, "Error fetching scenes", e);
                    mMainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            mProgressBar.setVisibility(View.GONE);
                            Toast.makeText(MainActivity.this, "Could not load scenes: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                }
            }
        });
    }

    /**
     * Dynamically builds native Android Card UI for each scene
     */
    private void renderScenesNative(JSONArray scenes) {
        mScenesContainer.removeAllViews();

        if (scenes == null || scenes.length() == 0) {
            TextView emptyText = new TextView(this);
            emptyText.setText("No scenes found for this story part yet.");
            emptyText.setTextColor(0xFF94A3B8);
            emptyText.setTextSize(14);
            emptyText.setGravity(Gravity.CENTER);
            emptyText.setPadding(0, dpToPx(32), 0, 0);
            mScenesContainer.addView(emptyText);
            return;
        }

        for (int i = 0; i < scenes.length(); i++) {
            JSONObject scene = scenes.optJSONObject(i);
            if (scene == null) continue;

            final int sceneId = scene.optInt("id");
            final int sceneNumber = scene.optInt("scene_number", i + 1);
            final String title = scene.optString("title", "Scene " + sceneNumber);
            final String visualPrompt = scene.optString("visual_prompt", "");
            final String status = scene.optString("status", "Draft");
            final String primaryImage = scene.optString("primary_image", "");
            final String dialogue = scene.optString("dialogue", "");

            final boolean isSubmitted = "Submitted".equalsIgnoreCase(status);
            final boolean hasArt = !TextUtils.isEmpty(primaryImage) && !primaryImage.contains("shibuya_rain_establishing.svg");

            // 1. Root Scene Card
            LinearLayout card = new LinearLayout(this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setBackgroundResource(R.drawable.card_background);
            card.setPadding(dpToPx(16), dpToPx(16), dpToPx(16), dpToPx(16));
            LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
            );
            cardParams.bottomMargin = dpToPx(16);
            card.setLayoutParams(cardParams);

            // 2. Header Row: Badge, Title, Status
            LinearLayout headerRow = new LinearLayout(this);
            headerRow.setOrientation(LinearLayout.HORIZONTAL);
            headerRow.setGravity(Gravity.CENTER_VERTICAL);

            TextView badgeScene = new TextView(this);
            badgeScene.setBackgroundResource(R.drawable.badge_scene_number);
            badgeScene.setText("SCENE " + sceneNumber);
            badgeScene.setTextColor(0xFFFFFFFF);
            badgeScene.setTextSize(11);
            badgeScene.setTypeface(Typeface.DEFAULT_BOLD);
            badgeScene.setPadding(dpToPx(8), dpToPx(4), dpToPx(8), dpToPx(4));
            headerRow.addView(badgeScene);

            TextView txtTitle = new TextView(this);
            txtTitle.setText(title);
            txtTitle.setTextColor(0xFFFFFFFF);
            txtTitle.setTextSize(15);
            txtTitle.setTypeface(Typeface.DEFAULT_BOLD);
            LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            titleParams.leftMargin = dpToPx(10);
            titleParams.rightMargin = dpToPx(8);
            txtTitle.setLayoutParams(titleParams);
            headerRow.addView(txtTitle);

            TextView badgeStatus = new TextView(this);
            if (isSubmitted) {
                badgeStatus.setBackgroundResource(R.drawable.badge_status_submitted);
                badgeStatus.setText("✅ Submitted");
            } else if (hasArt) {
                badgeStatus.setBackgroundResource(R.drawable.badge_status_ready);
                badgeStatus.setText("✨ Art Ready");
            } else {
                badgeStatus.setBackgroundResource(R.drawable.badge_status_waiting);
                badgeStatus.setText("⏳ Awaiting Art");
            }
            badgeStatus.setTextColor(0xFFFFFFFF);
            badgeStatus.setTextSize(11);
            badgeStatus.setTypeface(Typeface.DEFAULT_BOLD);
            badgeStatus.setPadding(dpToPx(10), dpToPx(4), dpToPx(10), dpToPx(4));
            headerRow.addView(badgeStatus);

            card.addView(headerRow);

            // 3. Jiya's Prompt Section (Clean, High-Contrast Box)
            LinearLayout promptBox = new LinearLayout(this);
            promptBox.setOrientation(LinearLayout.VERTICAL);
            promptBox.setBackgroundResource(R.drawable.prompt_box_background);
            promptBox.setPadding(dpToPx(12), dpToPx(12), dpToPx(12), dpToPx(12));
            LinearLayout.LayoutParams promptParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
            );
            promptParams.topMargin = dpToPx(14);
            promptBox.setLayoutParams(promptParams);

            LinearLayout promptHeader = new LinearLayout(this);
            promptHeader.setOrientation(LinearLayout.HORIZONTAL);
            promptHeader.setGravity(Gravity.CENTER_VERTICAL);

            TextView lblPrompt = new TextView(this);
            lblPrompt.setText("✍️ JIYA'S AI VISUAL PROMPT");
            lblPrompt.setTextColor(0xFF38BDF8);
            lblPrompt.setTextSize(12);
            lblPrompt.setTypeface(Typeface.DEFAULT_BOLD);
            LinearLayout.LayoutParams lblParams = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            lblPrompt.setLayoutParams(lblParams);
            promptHeader.addView(lblPrompt);

            // 1-Tap Native Copy Button
            Button btnCopy = new Button(this);
            btnCopy.setBackgroundResource(R.drawable.btn_copy_background);
            btnCopy.setText("📋 Copy Prompt");
            btnCopy.setTextColor(0xFFFFFFFF);
            btnCopy.setTextSize(12);
            btnCopy.setTypeface(Typeface.DEFAULT_BOLD);
            btnCopy.setPadding(dpToPx(12), 0, dpToPx(12), 0);
            LinearLayout.LayoutParams btnCopyParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, dpToPx(36)
            );
            btnCopy.setLayoutParams(btnCopyParams);

            final String promptToCopy = !TextUtils.isEmpty(visualPrompt) ? visualPrompt : "No prompt provided";
            btnCopy.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    copyToClipboard(promptToCopy, sceneNumber);
                }
            });
            promptHeader.addView(btnCopy);
            promptBox.addView(promptHeader);

            // Prompt text content
            TextView txtPrompt = new TextView(this);
            txtPrompt.setText(promptToCopy);
            txtPrompt.setTextColor(0xFFE2E8F0);
            txtPrompt.setTextSize(13);
            txtPrompt.setLineSpacing(dpToPx(2), 1f);
            txtPrompt.setTextIsSelectable(true);
            LinearLayout.LayoutParams txtPromptParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
            );
            txtPromptParams.topMargin = dpToPx(8);
            txtPrompt.setLayoutParams(txtPromptParams);
            promptBox.addView(txtPrompt);

            card.addView(promptBox);

            // 4. Scene Image Preview
            final ImageView imgPreview = new ImageView(this);
            imgPreview.setScaleType(ImageView.ScaleType.CENTER_CROP);
            imgPreview.setBackgroundColor(0xFF000000);
            LinearLayout.LayoutParams imgParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, dpToPx(190)
            );
            imgParams.topMargin = dpToPx(14);
            imgPreview.setLayoutParams(imgParams);

            if (!TextUtils.isEmpty(primaryImage)) {
                loadBitmapAsync(BASE_URL + primaryImage, imgPreview);
            }
            card.addView(imgPreview);

            // 5. 1-Click Native Upload Button
            Button btnUpload = new Button(this);
            btnUpload.setBackgroundResource(R.drawable.btn_upload_background);
            btnUpload.setText(hasArt ? "📷 Replace Image / Video" : "📷 Upload Created Image");
            btnUpload.setTextColor(0xFFFFFFFF);
            btnUpload.setTextSize(14);
            btnUpload.setTypeface(Typeface.DEFAULT_BOLD);
            LinearLayout.LayoutParams uploadParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, dpToPx(44)
            );
            uploadParams.topMargin = dpToPx(12);
            btnUpload.setLayoutParams(uploadParams);

            btnUpload.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    mPendingUploadSceneId = sceneId;
                    mPendingUploadSceneNumber = sceneNumber;
                    launchImagePicker();
                }
            });
            card.addView(btnUpload);

            // 6. Dialogue snippet (if present)
            if (!TextUtils.isEmpty(dialogue)) {
                TextView txtDialogue = new TextView(this);
                txtDialogue.setText("💬 " + dialogue);
                txtDialogue.setTextColor(0xFFF472B6);
                txtDialogue.setTextSize(12);
                txtDialogue.setTypeface(Typeface.defaultFromStyle(Typeface.ITALIC));
                LinearLayout.LayoutParams diagParams = new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
                );
                diagParams.topMargin = dpToPx(8);
                txtDialogue.setLayoutParams(diagParams);
                card.addView(txtDialogue);
            }

            // 7. Submit / Unsubmit Button
            Button btnSubmit = new Button(this);
            btnSubmit.setBackgroundResource(R.drawable.tab_unselected_bg);
            btnSubmit.setText(isSubmitted ? "↩ Re-open Scene for Edits" : "✅ Submit Scene to Book");
            btnSubmit.setTextColor(isSubmitted ? 0xFF94A3B8 : 0xFF34D399);
            btnSubmit.setTextSize(12);
            btnSubmit.setTypeface(Typeface.DEFAULT_BOLD);
            LinearLayout.LayoutParams submitParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, dpToPx(38)
            );
            submitParams.topMargin = dpToPx(8);
            btnSubmit.setLayoutParams(submitParams);

            btnSubmit.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    toggleSceneSubmission(sceneId, isSubmitted ? "Draft" : "Submitted");
                }
            });
            card.addView(btnSubmit);

            mScenesContainer.addView(card);
        }
    }

    private void copyToClipboard(String text, int sceneNumber) {
        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        ClipData clip = ClipData.newPlainText("Scene " + sceneNumber + " Prompt", text);
        if (clipboard != null) {
            clipboard.setPrimaryClip(clip);
            Toast.makeText(this, "📋 Scene " + sceneNumber + " prompt copied! Ready for Midjourney / Sora / Kling", Toast.LENGTH_SHORT).show();
        }
    }

    private void launchImagePicker() {
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("image/*");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        startActivityForResult(
                Intent.createChooser(intent, "Select Generated Image for Scene " + mPendingUploadSceneNumber),
                REQUEST_PICK_IMAGE
        );
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQUEST_PICK_IMAGE && resultCode == Activity.RESULT_OK && data != null) {
            Uri selectedUri = data.getData();
            if (selectedUri != null && mPendingUploadSceneId > 0) {
                uploadImageToServer(selectedUri, mPendingUploadSceneId, mPendingUploadSceneNumber);
            }
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }

    /**
     * Streams chosen photo to server via multipart POST /api/upload/scene/{id}
     */
    private void uploadImageToServer(final Uri fileUri, final int sceneId, final int sceneNum) {
        mUploadOverlay.setVisibility(View.VISIBLE);
        mTxtUploadStatus.setText("Uploading created art for Scene " + sceneNum + "...");

        mExecutor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    String boundary = "===" + System.currentTimeMillis() + "===";
                    URL url = new URL(BASE_URL + "/api/upload/scene/" + sceneId);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setDoOutput(true);
                    conn.setDoInput(true);
                    conn.setUseCaches(false);
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
                    conn.setRequestProperty("User-Agent", "AnimePlotStudio-AndroidNative/1.0");

                    OutputStream outputStream = conn.getOutputStream();
                    PrintWriter writer = new PrintWriter(new OutputStreamWriter(outputStream, "UTF-8"), true);

                    // Form field: uploaded_by = Sahil
                    writer.append("--" + boundary).append("\r\n");
                    writer.append("Content-Disposition: form-data; name=\"uploaded_by\"").append("\r\n\r\n");
                    writer.append("Sahil").append("\r\n");
                    writer.flush();

                    // Form field: set_primary = true
                    writer.append("--" + boundary).append("\r\n");
                    writer.append("Content-Disposition: form-data; name=\"set_primary\"").append("\r\n\r\n");
                    writer.append("true").append("\r\n");
                    writer.flush();

                    // File part: images
                    String fileName = "scene_" + sceneId + "_art_" + System.currentTimeMillis() + ".jpg";
                    writer.append("--" + boundary).append("\r\n");
                    writer.append("Content-Disposition: form-data; name=\"images\"; filename=\"" + fileName + "\"").append("\r\n");
                    writer.append("Content-Type: image/jpeg").append("\r\n\r\n");
                    writer.flush();

                    InputStream inputStream = getContentResolver().openInputStream(fileUri);
                    byte[] buffer = new byte[8192];
                    int bytesRead;
                    while ((bytesRead = inputStream.read(buffer)) != -1) {
                        outputStream.write(buffer, 0, bytesRead);
                    }
                    outputStream.flush();
                    inputStream.close();

                    writer.append("\r\n").flush();
                    writer.append("--" + boundary + "--").append("\r\n");
                    writer.close();

                    int responseCode = conn.getResponseCode();
                    if (responseCode >= 200 && responseCode < 300) {
                        mMainHandler.post(new Runnable() {
                            @Override
                            public void run() {
                                mUploadOverlay.setVisibility(View.GONE);
                                Toast.makeText(MainActivity.this, "✨ Scene " + sceneNum + " image uploaded! Book updated.", Toast.LENGTH_LONG).show();
                                loadScenesFromServer();
                            }
                        });
                        return;
                    }

                    throw new Exception("Server response " + responseCode);
                } catch (final Exception e) {
                    Log.e(TAG, "Upload failed", e);
                    mMainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            mUploadOverlay.setVisibility(View.GONE);
                            Toast.makeText(MainActivity.this, "Upload failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
                        }
                    });
                }
            }
        });
    }

    private void toggleSceneSubmission(final int sceneId, final String newStatus) {
        mExecutor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    URL url = new URL(BASE_URL + "/api/scenes/" + sceneId + "/submit");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setDoOutput(true);
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");

                    JSONObject payload = new JSONObject();
                    payload.put("status", newStatus);

                    OutputStream os = conn.getOutputStream();
                    os.write(payload.toString().getBytes("UTF-8"));
                    os.close();

                    int responseCode = conn.getResponseCode();
                    if (responseCode == 200) {
                        mMainHandler.post(new Runnable() {
                            @Override
                            public void run() {
                                Toast.makeText(MainActivity.this, "Scene marked as " + newStatus, Toast.LENGTH_SHORT).show();
                                loadScenesFromServer();
                            }
                        });
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error submitting scene", e);
                }
            }
        });
    }

    private void loadBitmapAsync(final String imageUrl, final ImageView imageView) {
        if (mBitmapCache.containsKey(imageUrl)) {
            imageView.setImageBitmap(mBitmapCache.get(imageUrl));
            return;
        }

        mExecutor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    URL url = new URL(imageUrl);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(10000);
                    InputStream in = conn.getInputStream();
                    final Bitmap bitmap = BitmapFactory.decodeStream(in);
                    in.close();

                    if (bitmap != null) {
                        mBitmapCache.put(imageUrl, bitmap);
                        mMainHandler.post(new Runnable() {
                            @Override
                            public void run() {
                                imageView.setImageBitmap(bitmap);
                            }
                        });
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Could not load image: " + imageUrl);
                }
            }
        });
    }

    private int dpToPx(int dp) {
        return (int) (dp * getResources().getDisplayMetrics().density + 0.5f);
    }

    @Override
    public void onBackPressed() {
        if (mReaderWebView != null && mReaderWebView.getVisibility() == View.VISIBLE && mReaderWebView.canGoBack()) {
            mReaderWebView.goBack();
        } else if (mReaderWebView != null && mReaderWebView.getVisibility() == View.VISIBLE) {
            selectScenesTab();
        } else {
            super.onBackPressed();
        }
    }
}
