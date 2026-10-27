package com.storycircle.game;

import static org.junit.Assert.*;

import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.SystemClock;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Exercises the actual bundled, minified release WebView and native App plugin. */
@RunWith(AndroidJUnit4.class)
public class AppLaunchTest {
    private static final String WEB = "https://striking-sparkle-production-adf7.up.railway.app";

    private String evaluate(ActivityScenario<MainActivity> scenario, String expression) throws Exception {
        AtomicReference<String> result = new AtomicReference<>("");
        CountDownLatch done = new CountDownLatch(1);
        scenario.onActivity(activity -> activity.getBridge().getWebView().evaluateJavascript(expression, value -> {
            result.set(value);
            done.countDown();
        }));
        assertTrue("WebView JavaScript responded", done.await(5, TimeUnit.SECONDS));
        return result.get();
    }

    private void awaitTrue(ActivityScenario<MainActivity> scenario, String expression) throws Exception {
        long until = SystemClock.elapsedRealtime() + 30000;
        do {
            if ("true".equals(evaluate(scenario, expression))) return;
            SystemClock.sleep(250);
        } while (SystemClock.elapsedRealtime() < until);
        fail("Expected native UI state: " + expression + "\n" + evaluate(scenario, "document.body.innerText"));
    }

    private Intent invitation(String url) {
        return new Intent(Intent.ACTION_VIEW, Uri.parse(url))
            .setClass(InstrumentationRegistry.getInstrumentation().getTargetContext(), MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    }

    private void screenshot(String filename) throws Exception {
        Bitmap image = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(image);
        File file = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), filename);
        try (FileOutputStream stream = new FileOutputStream(file)) { image.compress(Bitmap.CompressFormat.PNG, 100, stream); }
        image.recycle();
    }

    @Test public void bundledHomeAndNativeInvitations() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            awaitTrue(scenario, "location.origin === 'https://localhost' && !!window.Capacitor && window.Capacitor.isNativePlatform() && document.body.innerText.includes('สร้างวงใหม่')");
            screenshot("android-home.png");
            InstrumentationRegistry.getInstrumentation().getTargetContext().startActivity(invitation("storycircle://join/AB12CD"));
            awaitTrue(scenario, "location.pathname === '/join/AB12CD' && !!document.querySelector('[role=dialog]') && !!document.querySelector('input[value=AB12CD]')");
            screenshot("android-invitation.png");
            InstrumentationRegistry.getInstrumentation().getTargetContext().startActivity(invitation(WEB + "/join/EF34GH"));
            awaitTrue(scenario, "location.pathname === '/join/EF34GH' && !!document.querySelector('input[value=EF34GH]')");
            androidx.test.espresso.Espresso.closeSoftKeyboard();
            androidx.test.espresso.Espresso.pressBack();
            awaitTrue(scenario, "location.pathname === '/' && !document.querySelector('[role=dialog]')");
        }
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(invitation(WEB + "/join/JK56LM"))) {
            awaitTrue(scenario, "location.pathname === '/join/JK56LM' && !!document.querySelector('input[value=JK56LM]')");
            androidx.test.espresso.Espresso.closeSoftKeyboard();
            androidx.test.espresso.Espresso.pressBack();
            awaitTrue(scenario, "location.pathname === '/' && !document.querySelector('[role=dialog]')");
            SystemClock.sleep(1000);
            assertEquals("Cold-launch invitation must not reopen on every route change", "true", evaluate(scenario, "location.pathname === '/'"));
        }
    }
}
