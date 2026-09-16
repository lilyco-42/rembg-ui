# ONNX Runtime discovers JNI/native providers and model metadata reflectively.
# Keep the public API and native bridge even when R8 shrinks the rest of the app.
-keep class ai.onnxruntime.** { *; }
-keep class com.lilyco42.rembgui.** { *; }
-keepattributes *Annotation*,InnerClasses,EnclosingMethod,Signature
-dontwarn ai.onnxruntime.**
# The verifier accepts raw Ed25519 public keys and never uses the JDK X.509
# bridge; the optional desktop-only class is absent from Android.
-dontwarn sun.security.x509.X509Key
