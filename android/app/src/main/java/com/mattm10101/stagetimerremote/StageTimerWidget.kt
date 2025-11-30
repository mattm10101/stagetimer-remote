package com.mattm10101.stagetimerremote

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.net.Uri
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class StageTimerWidget : AppWidgetProvider() {

    companion object {
        const val ACTION_PLAY_PAUSE = "com.mattm10101.stagetimerremote.ACTION_PLAY_PAUSE"
        const val ACTION_STOP = "com.mattm10101.stagetimerremote.ACTION_STOP"
        const val ACTION_NEXT = "com.mattm10101.stagetimerremote.ACTION_NEXT"
        const val PREFS_NAME = "StageTimerPrefs"
        const val PREF_ROOM_ID = "roomId"
        const val PREF_API_KEY = "apiKey"
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        when (intent.action) {
            ACTION_PLAY_PAUSE -> sendApiCommand(context, "/toggle")
            ACTION_STOP -> sendApiCommand(context, "/stop")
            ACTION_NEXT -> sendApiCommand(context, "/next")
        }
    }

    private fun sendApiCommand(context: Context, endpoint: String) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val roomId = prefs.getString(PREF_ROOM_ID, null)
        val apiKey = prefs.getString(PREF_API_KEY, null)

        if (roomId.isNullOrEmpty() || apiKey.isNullOrEmpty()) {
            // Open app if not configured
            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(launchIntent)
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url = URL("https://api.stagetimer.io/v1/rooms/$roomId$endpoint")
                val connection = url.openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.setRequestProperty("x-api-key", apiKey)
                connection.setRequestProperty("Content-Type", "application/json")
                connection.doOutput = true
                connection.outputStream.write("{}".toByteArray())
                connection.responseCode // Trigger the request
                connection.disconnect()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    private fun updateAppWidget(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int
    ) {
        val views = RemoteViews(context.packageName, R.layout.widget_stagetimer)

        // Set up click intents for buttons
        views.setOnClickPendingIntent(
            R.id.btn_play_pause,
            getPendingIntent(context, ACTION_PLAY_PAUSE, appWidgetId)
        )
        views.setOnClickPendingIntent(
            R.id.btn_stop,
            getPendingIntent(context, ACTION_STOP, appWidgetId)
        )
        views.setOnClickPendingIntent(
            R.id.btn_next,
            getPendingIntent(context, ACTION_NEXT, appWidgetId)
        )

        // Clicking on the timer display opens the app
        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        val launchPendingIntent = PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.timer_display, launchPendingIntent)
        views.setOnClickPendingIntent(R.id.timer_name, launchPendingIntent)

        appWidgetManager.updateAppWidget(appWidgetId, views)
    }

    private fun getPendingIntent(context: Context, action: String, appWidgetId: Int): PendingIntent {
        val intent = Intent(context, StageTimerWidget::class.java).apply {
            this.action = action
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
        }
        return PendingIntent.getBroadcast(
            context,
            appWidgetId + action.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }
}
