# ONNX Runtime discovers JNI/native providers and model metadata reflectively.
# Keep the public API and native bridge even when R8 shrinks the rest of the app.
-keep class ai.onnxruntime.** { *; }
-keep class com.lilyco42.rembgui.** { *; }
-keepattributes *Annotation*,InnerClasses,EnclosingMethod,Signature
-dontwarn ai.onnxruntime.**
