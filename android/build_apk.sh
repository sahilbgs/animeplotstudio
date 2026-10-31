#!/bin/bash
set -e
export PATH="/home/gtu-itr/tools/jdk17/bin:/home/gtu-itr/tools:$PATH"

BUILD_DIR="/home/gtu-itr/anime-studio-android-build"
TOOLS_DIR="/home/gtu-itr/tools"

cd "$BUILD_DIR"
rm -rf compiled_res bin
mkdir -p compiled_res bin/classes

echo "[1/6] Compiling resources with aapt2..."
"$TOOLS_DIR/aapt2" compile --dir res -o compiled_res/res.zip

echo "[2/6] Linking resources..."
"$TOOLS_DIR/aapt2" link -I "$TOOLS_DIR/android.jar" \
  --manifest AndroidManifest.xml \
  -o bin/base.apk \
  --java src \
  --auto-add-overlay \
  compiled_res/res.zip

echo "[3/6] Compiling Java classes..."
javac -cp "$TOOLS_DIR/android.jar" -d bin/classes \
  src/in/aceglory/animeplotstudio/*.java

echo "[4/6] Converting classes to DEX with D8..."
java -cp "$TOOLS_DIR/r8.jar" com.android.tools.r8.D8 \
  --lib "$TOOLS_DIR/android.jar" \
  --min-api 24 \
  --output bin \
  bin/classes/in/aceglory/animeplotstudio/*.class

echo "[5/6] Packaging DEX into APK..."
cd bin
jar -uf base.apk classes.dex
cd "$BUILD_DIR"

echo "[6/6] Zipalign and signing APK..."
python3 "$TOOLS_DIR/zipalign.py" 4 bin/base.apk bin/base-aligned.apk

# 1. Sign with Release Keystore
if [ -f "$BUILD_DIR/release.keystore" ]; then
    echo "Signing with Release Keystore..."
    java -jar "$TOOLS_DIR/uber-apk-signer.jar" \
        -a bin/base-aligned.apk \
        --ks "$BUILD_DIR/release.keystore" \
        --ksAlias agyvoice \
        --ksPass "AgyVoice@Release2026" \
        --ksKeyPass "AgyVoice@Release2026" \
        --skipZipAlign \
        -o bin/
fi

# 2. Check signed APK output
SIGNED_APK=""
if [ -f "bin/base-aligned-signed.apk" ]; then
    SIGNED_APK="bin/base-aligned-signed.apk"
elif [ -f "bin/base-aligned-debugSigned.apk" ]; then
    SIGNED_APK="bin/base-aligned-debugSigned.apk"
fi

if [ -z "$SIGNED_APK" ]; then
    echo "Fallback signing with default debug key..."
    java -jar "$TOOLS_DIR/uber-apk-signer.jar" -a bin/base-aligned.apk --skipZipAlign -o bin/
    SIGNED_APK="bin/base-aligned-debugSigned.apk"
fi

mkdir -p /home/gtu-itr/anime-story-studio/public/download
cp -f "$SIGNED_APK" /home/gtu-itr/anime-story-studio/public/download/AnimePlotStudio-Jiya.apk

echo "SUCCESS! AnimePlotStudio-Jiya.apk is built and signed."
ls -lh /home/gtu-itr/anime-story-studio/public/download/AnimePlotStudio-Jiya.apk
