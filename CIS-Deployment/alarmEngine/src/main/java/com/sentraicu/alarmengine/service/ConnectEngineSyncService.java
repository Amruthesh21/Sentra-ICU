package com.sentraicu.alarmengine.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Batches Connect Engine restarts — MongoDB is the Hub source of truth;
 * at most one CE restart per debounce window no matter how many beds/patients change.
 */
@Service
public class ConnectEngineSyncService {

    private static final Logger log = LoggerFactory.getLogger(ConnectEngineSyncService.class);

    private final ConnectEngineReloader reloader;
    private final boolean autoRestart;
    private final long debounceMs;

    private final long postSaveDebounceMs;

    public enum SyncTrigger {
        /** New/removed bed or device IP change — CE must reload bed list. */
        STRUCTURAL,
        /** Patient admit/discharge on existing bed — Mongo updated; restart optional. */
        PATIENT_ASSIGNMENT,
        /** Manual admin sync. */
        MANUAL
    }

    private final AtomicBoolean pending = new AtomicBoolean(false);
    private final AtomicLong lastRestartAt = new AtomicLong(0);
    private final AtomicLong lastSaveAt = new AtomicLong(0);
    private final boolean restartOnPatientChange;

    public ConnectEngineSyncService(
            ConnectEngineReloader reloader,
            @Value("${connect.engine.auto-restart:true}") boolean autoRestart,
            @Value("${connect.engine.restart-debounce-ms:15000}") long debounceMs,
            @Value("${connect.engine.post-save-debounce-ms:10000}") long postSaveDebounceMs,
            @Value("${connect.engine.restart-on-patient-change:true}") boolean restartOnPatientChange) {
        this.reloader = reloader;
        this.autoRestart = autoRestart;
        this.debounceMs = debounceMs;
        this.postSaveDebounceMs = postSaveDebounceMs;
        this.restartOnPatientChange = restartOnPatientChange;
    }

    /** Hub saved to MongoDB — queues CE restart based on change type. */
    public void markPending(SyncTrigger trigger) {
        if (trigger == SyncTrigger.PATIENT_ASSIGNMENT && !restartOnPatientChange) {
            log.info("Connect Engine restart skipped for patient assignment (restart-on-patient-change=false)");
            return;
        }
        pending.set(true);
        lastSaveAt.set(System.currentTimeMillis());
    }

    /** @deprecated use markPending(SyncTrigger) */
    public void markPending() {
        markPending(SyncTrigger.STRUCTURAL);
    }

    public boolean isPending() {
        return pending.get();
    }

    /**
     * Called after MongoDB save. Returns true = Hub is synced (mongo). CE may catch up later.
     */
    public boolean hubSynced(ConnectEngineSyncService.SyncTrigger trigger) {
        markPending(trigger);
        return true;
    }

    public boolean hubSynced() {
        return hubSynced(SyncTrigger.STRUCTURAL);
    }

    /** Drift detected between MongoDB beds and CE retrieve — restart sooner than batch debounce. */
    public void restartOnDrift() {
        markPending();
        if (!autoRestart) {
            log.info("Connect Engine drift queued — auto-restart disabled");
            return;
        }
        long elapsed = System.currentTimeMillis() - lastRestartAt.get();
        if (lastRestartAt.get() > 0 && elapsed < postSaveDebounceMs) {
            return;
        }
        executeRestart("drift");
    }

    /** Optional immediate restart (admin "Sync" button). */
    public boolean forceRestart() {
        pending.set(false);
        return executeRestart("manual");
    }

    @Scheduled(fixedRate = 10000)
    public void processPendingRestart() {
        if (!autoRestart || !pending.get()) {
            return;
        }
        long elapsed = System.currentTimeMillis() - lastRestartAt.get();
        long requiredDebounce = debounceMs;
        long sinceSave = System.currentTimeMillis() - lastSaveAt.get();
        if (lastSaveAt.get() > 0 && sinceSave < 120_000) {
            requiredDebounce = Math.min(debounceMs, postSaveDebounceMs);
        }
        if (lastRestartAt.get() > 0 && elapsed < requiredDebounce) {
            return;
        }
        executeRestart("batch");
    }

    private boolean executeRestart(String reason) {
        pending.set(false);
        lastRestartAt.set(System.currentTimeMillis());
        log.info("Connect Engine sync restart ({})", reason);
        return reloader.restartNow();
    }
}
