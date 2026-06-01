package com.example.nodera

// Android tarafinda saklanan native degerler. AUTH_TOKEN web login oturumunu,
// FCM_TOKEN ise Firebase'in bu cihaza verdigi push hedefini temsil eder.
object HotelOpsPrefs {
    const val NAME = "hotelops.android.notifications"
    const val AUTH_TOKEN = "auth_token"
    const val FCM_TOKEN = "fcm_token"
    const val SHIFT_ACTIVE = "shift_active"
    const val SHIFT_STARTED_AT = "shift_started_at"
    const val SHIFT_EMPLOYEE_NAME = "shift_employee_name"
    const val SHIFT_DEPARTMENT_NAME = "shift_department_name"
}
