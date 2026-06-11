package com.example.nodera

import android.content.Context

object HotelOpsShiftStatus {
    fun start(context: Context, employeeName: String?, departmentName: String?): Long {
        val appContext = context.applicationContext
        val prefs = appContext.getSharedPreferences(HotelOpsPrefs.NAME, Context.MODE_PRIVATE)
        val startedAt = prefs.getLong(HotelOpsPrefs.SHIFT_STARTED_AT, 0L).takeIf { it > 0L }
            ?: System.currentTimeMillis()
        val cleanEmployeeName = employeeName?.trim().orEmpty()
        val cleanDepartmentName = departmentName?.trim().orEmpty()

        prefs.edit()
            .putBoolean(HotelOpsPrefs.SHIFT_ACTIVE, true)
            .putLong(HotelOpsPrefs.SHIFT_STARTED_AT, startedAt)
            .putString(HotelOpsPrefs.SHIFT_EMPLOYEE_NAME, cleanEmployeeName)
            .putString(HotelOpsPrefs.SHIFT_DEPARTMENT_NAME, cleanDepartmentName)
            .apply()

        HotelOpsNotifier.cancelShiftStartReminder(appContext)
        HotelOpsNotifier.showShiftNotification(appContext, cleanEmployeeName, cleanDepartmentName, startedAt)
        return startedAt
    }

    fun end(context: Context) {
        val appContext = context.applicationContext
        val prefs = appContext.getSharedPreferences(HotelOpsPrefs.NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .remove(HotelOpsPrefs.SHIFT_ACTIVE)
            .remove(HotelOpsPrefs.SHIFT_STARTED_AT)
            .remove(HotelOpsPrefs.SHIFT_EMPLOYEE_NAME)
            .remove(HotelOpsPrefs.SHIFT_DEPARTMENT_NAME)
            .apply()

        HotelOpsNotifier.cancelShiftStartReminder(appContext)
        HotelOpsNotifier.cancelShiftNotification(appContext)
    }

    fun isActive(context: Context): Boolean {
        val prefs = context.applicationContext.getSharedPreferences(HotelOpsPrefs.NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(HotelOpsPrefs.SHIFT_ACTIVE, false)
    }

    fun startedAt(context: Context): Long {
        val prefs = context.applicationContext.getSharedPreferences(HotelOpsPrefs.NAME, Context.MODE_PRIVATE)
        return prefs.getLong(HotelOpsPrefs.SHIFT_STARTED_AT, 0L)
    }

    fun restore(context: Context) {
        val appContext = context.applicationContext
        val prefs = appContext.getSharedPreferences(HotelOpsPrefs.NAME, Context.MODE_PRIVATE)
        if (!prefs.getBoolean(HotelOpsPrefs.SHIFT_ACTIVE, false)) return

        HotelOpsNotifier.showShiftNotification(
            appContext,
            prefs.getString(HotelOpsPrefs.SHIFT_EMPLOYEE_NAME, "").orEmpty(),
            prefs.getString(HotelOpsPrefs.SHIFT_DEPARTMENT_NAME, "").orEmpty(),
            prefs.getLong(HotelOpsPrefs.SHIFT_STARTED_AT, System.currentTimeMillis())
        )
    }
}
