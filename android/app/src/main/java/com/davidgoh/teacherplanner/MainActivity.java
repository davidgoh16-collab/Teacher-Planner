package com.davidgoh.teacherplanner;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Edge-to-edge: let the WebView draw behind the status and navigation bars so the app's own
        // background fills the entire screen (no grey system-bar bands). Content is kept clear of the
        // bars in CSS via env(safe-area-inset-*) — see AppShell header + BottomNav. Status-bar icon
        // colour is set per theme from JS via @capacitor/status-bar (see App.tsx).
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
    }
}
