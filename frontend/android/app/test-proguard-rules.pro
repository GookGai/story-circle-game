# Error Prone's compile-time annotation enum is a JDK type absent from Android.
# Keep this narrow exception in the test harness only, never in application rules.
-dontwarn javax.lang.model.element.Modifier
