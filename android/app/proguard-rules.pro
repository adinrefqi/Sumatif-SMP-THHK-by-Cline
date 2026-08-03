# Exambrowser THHK - ProGuard rules
-keepattributes *Annotation*

# WebView / Javascript
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Gson/JSON (jika digunakan)
-keep class com.thhk.exambrowser.** { *; }