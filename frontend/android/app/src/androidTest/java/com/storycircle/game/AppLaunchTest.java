package com.storycircle.game;

import static org.junit.Assert.*;

import android.graphics.Bitmap;
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

/** Minimum trial acceptance: create, join by code, play one vote, reopen the circle. */
@RunWith(AndroidJUnit4.class)
public class AppLaunchTest {
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

    private void screenshot(String filename) throws Exception {
        Bitmap image = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(image);
        File file = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), filename);
        try (FileOutputStream stream = new FileOutputStream(file)) { image.compress(Bitmap.CompressFormat.PNG, 100, stream); }
        image.recycle();
    }

    @Test public void createJoinAndPlayByCode() throws Exception {
        String code = InstrumentationRegistry.getArguments().getString("roomCode");
        assertNotNull("Browser companion circle is available", code);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            awaitTrue(scenario, "location.origin === 'https://localhost' && !!window.Capacitor && window.Capacitor.isNativePlatform() && document.body.innerText.includes('สร้างวงใหม่')");
            screenshot("android-home.png");
            // Exercise real HTTPS authentication and Socket.IO from the packaged origin.
            awaitTrue(scenario, "Array.from(document.querySelectorAll('button')).some(b => b.textContent.trim() === 'สร้างวงใหม่' && !b.disabled)");
            evaluate(scenario, "Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'สร้างวงใหม่').click()");
            awaitTrue(scenario, "!!document.querySelector('input[autocomplete=nickname]')");
            evaluate(scenario, "(() => { const input = document.querySelector('input[autocomplete=nickname]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Android QA'); input.dispatchEvent(new Event('input', {bubbles:true})); })()");
            evaluate(scenario, "document.querySelector('.entry-form').requestSubmit()");
            awaitTrue(scenario, "/^\\/room\\/[A-Z0-9]{6}$/.test(location.pathname) && !!document.querySelector('.room-heading') && document.body.innerText.includes('Android QA')");
            screenshot("android-room.png");
            evaluate(scenario, "document.querySelector('button[aria-label=ออกจากวง]').click()");
            awaitTrue(scenario, "!!document.querySelector('.room-confirmation')");
            evaluate(scenario, "document.querySelector('.room-confirmation .p-button.primary').click()");
            awaitTrue(scenario, "location.pathname === '/' && !document.querySelector('[role=dialog]')");
            evaluate(scenario, "Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'มีรหัสเข้าวงแล้ว').click()");
            awaitTrue(scenario, "!!document.querySelector('.code-input')");
            evaluate(scenario, "(() => { const input = document.querySelector('.code-input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '" + code + "'); input.dispatchEvent(new Event('input', {bubbles:true})); })()");
            evaluate(scenario, "document.querySelector('.entry-form').requestSubmit()");
            awaitTrue(scenario, "location.pathname === '/room/" + code + "' && !!document.querySelector('.ready-action:not(:disabled)')");
            evaluate(scenario, "document.querySelector('.ready-action').click()");
            awaitTrue(scenario, "!!document.querySelector('.party-vote-option.option-a:not(:disabled)')");
            evaluate(scenario, "document.querySelector('.party-vote-option.option-a').click()");
            awaitTrue(scenario, "!!document.querySelector('.results-stage .vote-result-split')");
            screenshot("android-game-result.png");
            evaluate(scenario, "document.querySelector('a.wordmark').click()");
            awaitTrue(scenario, "location.pathname === '/' && document.body.innerText.includes('เล่นวงเดิมต่อ')");
        }
        // Destroy/recreate the WebView: identity and the live circle must survive.
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            awaitTrue(scenario, "location.pathname === '/' && document.body.innerText.includes('Android QA') && !!document.querySelector('.app-return')");
            evaluate(scenario, "document.querySelector('.app-return').click()");
            awaitTrue(scenario, "location.pathname.startsWith('/room/') && !!document.querySelector('.room-heading')");
            // Leave only this newly-created QA circle through the same control as players.
            evaluate(scenario, "document.querySelector('button[aria-label=ออกจากวง]').click()");
            awaitTrue(scenario, "!!document.querySelector('.room-confirmation')");
            evaluate(scenario, "document.querySelector('.room-confirmation .p-button.primary').click()");
            awaitTrue(scenario, "location.pathname === '/' && !document.querySelector('.app-return')");
        }
    }
}
