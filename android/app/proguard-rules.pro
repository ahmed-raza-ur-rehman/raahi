# App-specific R8 rules. The libraries in use (kotlinx.serialization, Room, OkHttp, WorkManager, Compose) ship their own
# consumer rules, so nothing is kept here by default. Workers are instantiated by class name through WorkManager:
-keep class pk.raahi.app.work.SyncWorker { <init>(...); }
-keep class pk.raahi.app.work.ReminderWorker { <init>(...); }
