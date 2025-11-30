package com.mattm10101.stagetimerremote

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class WidgetBridgeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WidgetBridge"

    @ReactMethod
    fun saveCredentials(roomId: String, apiKey: String, promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(
                StageTimerWidget.PREFS_NAME,
                Context.MODE_PRIVATE
            )
            prefs.edit()
                .putString(StageTimerWidget.PREF_ROOM_ID, roomId)
                .putString(StageTimerWidget.PREF_API_KEY, apiKey)
                .apply()

            // Update all widgets
            val intent = Intent(reactApplicationContext, StageTimerWidget::class.java)
            intent.action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            val ids = AppWidgetManager.getInstance(reactApplicationContext)
                .getAppWidgetIds(ComponentName(reactApplicationContext, StageTimerWidget::class.java))
            intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            reactApplicationContext.sendBroadcast(intent)

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun clearCredentials(promise: Promise) {
        try {
            val prefs = reactApplicationContext.getSharedPreferences(
                StageTimerWidget.PREFS_NAME,
                Context.MODE_PRIVATE
            )
            prefs.edit().clear().apply()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
}
