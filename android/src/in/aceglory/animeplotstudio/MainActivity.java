package in.aceglory.animeplotstudio;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.DialogInterface;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
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
import android.widget.EditText;
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

    // Active Project & Part IDs
    private int mActiveProjectId = 3;
    private int mActivePartId = 4;
    private int mCurrentScenesCount = 0;
    private int mPendingUploadSceneId = -1;
    private int mPendingUploadSceneNumber = -1;

    // UI elements
    private Button mTabScenes;
    private Button mTabReader;
    private Button mBtnRefresh;
    private Button mBtnCreateScene;
    private Button mBtnCreatePart;
    private ScrollView mScrollViewScenes;
    private LinearLayout mScenesContainer;
    private LinearLayout mPartsChipsContainer;
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

    private JSONArray mLoadedParts = new JSONArray();

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

        // Load project parts and scenes from server
        loadPartsFromServer();
        loadScenesFromServer();
    }

    private void initViews() {
        mTabScenes = (Button) findViewById(R.id.tabScenes);
        mTabReader = (Button) findViewById(R.id.tabReader);
        mBtnRefresh = (Button) findViewById(R.id.btnRefresh);
        mBtnCreateScene = (Button) findViewById(R.id.btnCreateScene);
        mBtnCreatePart = (Button) findViewById(R.id.btnCreatePart);
        mScrollViewScenes = (ScrollView) findViewById(R.id.scrollViewScenes);
        mScenesContainer = (LinearLayout) findViewById(R.id.scenesContainer);
        mPartsChipsContainer = (LinearLayout) findViewById(R.id.partsChipsContainer);
        mProgressBar = (ProgressBar) findViewById(R.id.progressBar);
        mReaderWebView = (WebView) findViewById(R.id.readerWebView);
        mUploadOverlay = (LinearLayout) findViewById(R.id.uploadOverlay);
        mTxtUploadStatus = (TextView) findViewById(R.id.txtUploadStatus);
        mTxtStoryTitle = (TextView) findViewById(R.id.txtStoryTitle);
        mTxtPartTitle = (TextView) findViewById(R.id.txtPartTitle);

        mBtnRefresh.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                loadPartsFromServer();
                loadScenesFromServer();
            }
        });

        mBtnCreatePart.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showCreatePartDialog();
            }
        });

        mBtnCreateScene.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showCreateSceneDialog();
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

        // Load standalone reader mode (zero web dashboard, only illustrated storybook)
        mReaderWebView.loadUrl(BASE_URL + "/?mode=reader#standalone-reader");
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

                // Auto-authenticate and strictly hide any web navigation/dashboard elements
                String hideScript = "javascript:(function() {" +
                        "try {" +
                        "  document.body.classList.add('standalone-reader');" +
                        "  var h = document.querySelector('header'); if (h) h.style.display = 'none';" +
                        "  var nav = document.querySelector('.mobile-bottom-nav'); if (nav) nav.style.display = 'none';" +
                        "  var cta = document.getElementById('view-landing'); if (cta) cta.style.display = 'none';" +
                        "  var sb = document.getElementById('view-storyboard'); if (sb) sb.style.display = 'none';" +
                        "  var vr = document.getElementById('view-reader'); if (vr) { vr.style.display = 'block'; vr.style.paddingTop = '1rem'; }" +
                        "  if (typeof renderReaderView === 'function') renderReaderView('all');" +
                        "} catch(e) {}" +
                        "})();";
                view.loadUrl(hideScript);
            }
        });
    }

    /**
     * Dialog to create a new Part natively in Android
     */
    private void showCreatePartDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Create New Story Part");

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dpToPx(20), dpToPx(12), dpToPx(20), dpToPx(12));

        int nextPartNum = mLoadedParts.length() + 1;

        final EditText inputTitle = new EditText(this);
        inputTitle.setHint("Part Title (e.g. Part " + nextPartNum + ": The Climax Spire)");
        inputTitle.setText("Part " + nextPartNum + ": ");
        layout.addView(inputTitle);

        final EditText inputSummary = new EditText(this);
        inputSummary.setHint("Part Summary (Optional)");
        layout.addView(inputSummary);

        builder.setView(layout);

        builder.setPositiveButton("Create Part", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                String title = inputTitle.getText().toString().trim();
                String summary = inputSummary.getText().toString().trim();
                if (TextUtils.isEmpty(title)) {
                    Toast.makeText(MainActivity.this, "Please enter part title", Toast.LENGTH_SHORT).show();
                    return;
                }
                createNewPartOnServer(title, summary);
            }
        });

        builder.setNegativeButton("Cancel", null);
        builder.show();
    }

    /**
     * Dialog to write and create a new Scene Prompt natively in Android
     */
    private void showCreateSceneDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("✍️ Write Scene Prompt for Jiya");

        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setPadding(dpToPx(20), dpToPx(12), dpToPx(20), dpToPx(12));

        int nextSceneNum = mCurrentScenesCount + 1;

        final EditText inputTitle = new EditText(this);
        inputTitle.setHint("Scene Title (e.g. Scene " + nextSceneNum + ": Rooftop Climax)");
        inputTitle.setText("Scene " + nextSceneNum + ": ");
        layout.addView(inputTitle);

        final EditText inputPrompt = new EditText(this);
        inputPrompt.setHint("AI Visual Prompt (For Midjourney / Sora / Kling)...");
        inputPrompt.setMinLines(4);
        inputPrompt.setGravity(Gravity.TOP | Gravity.START);
        LinearLayout.LayoutParams pParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
        );
        pParams.topMargin = dpToPx(8);
        inputPrompt.setLayoutParams(pParams);
        layout.addView(inputPrompt);

        final EditText inputDialogue = new EditText(this);
        inputDialogue.setHint("Character Dialogue (Optional, e.g. AKIRA: Look at that!)");
        LinearLayout.LayoutParams dParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
        );
        dParams.topMargin = dpToPx(8);
        inputDialogue.setLayoutParams(dParams);
        layout.addView(inputDialogue);

        builder.setView(layout);

        builder.setPositiveButton("Save Scene Prompt", new DialogInterface.OnClickListener() {
            @Override
            public void onClick(DialogInterface dialog, int which) {
                String title = inputTitle.getText().toString().trim();
                String prompt = inputPrompt.getText().toString().trim();
                String dialogue = inputDialogue.getText().toString().trim();

                if (TextUtils.isEmpty(prompt)) {
                    Toast.makeText(MainActivity.this, "Please write an AI visual prompt", Toast.LENGTH_SHORT).show();
                    return;
                }
                createNewSceneOnServer(title, prompt, dialogue);
            }
        });

        builder.setNegativeButton("Cancel", null);
        builder.show();
    }

    /**
     * Sends POST /api/parts/project/{projectId}
     */
    private void createNewPartOnServer(final String title, final String summary) {
        mProgressBar.setVisibility(View.VISIBLE);

        mExecutor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    URL url = new URL(BASE_URL + "/api/parts/project/" + mActiveProjectId);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setDoOutput(true);
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");

                    JSONObject payload = new JSONObject();
                    payload.put("title", title);
                    payload.put("summary", summary);
                    payload.put("created_by", "Jiya");

                    OutputStream os = conn.getOutputStream();
                    os.write(payload.toString().getBytes("UTF-8"));
                    os.close();

                    int responseCode = conn.getResponseCode();
                    if (responseCode == 200) {
                        BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = in.readLine()) != null) sb.append(line);
                        in.close();

                        JSONObject res = new JSONObject(sb.toString());
                        JSONObject newPart = res.optJSONObject("part");
                        final int newPartId = newPart != null ? newPart.optInt("id", mActivePartId) : mActivePartId;

                        mMainHandler.post(new Runnable() {
                            @Override
                            public void run() {
                                mProgressBar.setVisibility(View.GONE);
                                Toast.makeText(MainActivity.this, "✨ New Part created successfully!", Toast.LENGTH_SHORT).show();
                                mActivePartId = newPartId;
                                loadPartsFromServer();
                                loadScenesFromServer();
                            }
                        });
                        return;
                    }
                    throw new Exception("HTTP response " + responseCode);
                } catch (final Exception e) {
                    Log.e(TAG, "Error creating part", e);
                    mMainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            mProgressBar.setVisibility(View.GONE);
                            Toast.makeText(MainActivity.this, "Failed to create part: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                }
            }
        });
    }

    /**
     * Sends POST /api/scenes/part/{partId}
     */
    private void createNewSceneOnServer(final String title, final String prompt, final String dialogue) {
        mProgressBar.setVisibility(View.VISIBLE);

        mExecutor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    URL url = new URL(BASE_URL + "/api/scenes/part/" + mActivePartId);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setDoOutput(true);
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");

                    JSONObject payload = new JSONObject();
                    payload.put("title", title);
                    payload.put("visual_prompt", prompt);
                    payload.put("narrative_script", prompt);
                    payload.put("dialogue", dialogue);
                    payload.put("status", "Prompt Ready");
                    payload.put("created_by", "Jiya");

                    OutputStream os = conn.getOutputStream();
                    os.write(payload.toString().getBytes("UTF-8"));
                    os.close();

                    int responseCode = conn.getResponseCode();
                    if (responseCode == 200) {
                        mMainHandler.post(new Runnable() {
                            @Override
                            public void run() {
                                mProgressBar.setVisibility(View.GONE);
                                Toast.makeText(MainActivity.this, "✨ Scene created! Prompt ready for Sahil.", Toast.LENGTH_SHORT).show();
                                loadScenesFromServer();
                            }
                        });
                        return;
                    }
                    throw new Exception("HTTP response " + responseCode);
                } catch (final Exception e) {
                    Log.e(TAG, "Error creating scene", e);
                    mMainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            mProgressBar.setVisibility(View.GONE);
                            Toast.makeText(MainActivity.this, "Failed to create scene: " + e.getMessage(), Toast.LENGTH_SHORT).show();
                        }
                    });
                }
            }
        });
    }

    /**
     * Fetches all Parts for the project: GET /api/parts/project/{projectId}
     */
    private void loadPartsFromServer() {
        mExecutor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    URL url = new URL(BASE_URL + "/api/parts/project/" + mActiveProjectId);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("GET");

                    int responseCode = conn.getResponseCode();
                    if (responseCode == 200) {
                        BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = in.readLine()) != null) sb.append(line);
                        in.close();

                        JSONObject json = new JSONObject(sb.toString());
                        final JSONArray parts = json.optJSONArray("parts");
                        if (parts != null) {
                            mLoadedParts = parts;
                            mMainHandler.post(new Runnable() {
                                @Override
                                public void run() {
                                    renderPartsChips(parts);
                                }
                            });
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Could not load parts: " + e.getMessage());
                }
            }
        });
    }

    /**
     * Renders horizontal part chips in Android native layout
     */
    private void renderPartsChips(JSONArray parts) {
        mPartsChipsContainer.removeAllViews();

        for (int i = 0; i < parts.length(); i++) {
            JSONObject part = parts.optJSONObject(i);
            if (part == null) continue;

            final int partId = part.optInt("id");
            final int partNumber = part.optInt("part_number", i + 1);
            final String title = part.optString("title", "Part " + partNumber);
            final int sceneCount = part.optInt("scene_count", 0);
            final boolean isSelected = (partId == mActivePartId);

            Button chip = new Button(this);
            chip.setText("📖 Part " + partNumber + ": " + title + " (" + sceneCount + ")");
            chip.setTextSize(12);
            chip.setTypeface(Typeface.DEFAULT_BOLD);
            chip.setPadding(dpToPx(14), 0, dpToPx(14), 0);

            if (isSelected) {
                chip.setBackgroundResource(R.drawable.tab_selected_bg);
                chip.setTextColor(0xFFFFFFFF);
                mTxtPartTitle.setText("Part " + partNumber + ": " + title);
            } else {
                chip.setBackgroundResource(R.drawable.tab_unselected_bg);
                chip.setTextColor(0xFFCBD5E1);
            }

            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, dpToPx(38)
            );
            lp.rightMargin = dpToPx(8);
            chip.setLayoutParams(lp);

            chip.setOnClickListener(new View.OnClickListener() {
                @Override
                public void onClick(View v) {
                    mActivePartId = partId;
                    renderPartsChips(mLoadedParts);
                    loadScenesFromServer();
                }
            });

            mPartsChipsContainer.addView(chip);
        }
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
                                    mCurrentScenesCount = scenes.length();
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
            emptyText.setText("No scenes found in this part yet.\nTap '✍️ + Write Scene' above to add Scene 1.");
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
