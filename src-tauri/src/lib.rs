//! # stardust-pit
//!
//! Stardust app process. Hosts the Tauri runtime, owns the Show/Song/Patch
//! model, and drives the audio thread (via the stardust-core library).
//!
//! v0.4 wires engine-state commands. The dedicated `engine` module
//! owns a thread that holds the `!Send` CLAP plugin instance; Tauri
//! commands send intents to it and the UI listens for status updates
//! on the `engine://status` event.

mod commands;
// Public for the device-level integration tests in `tests/` (they need
// a real audio device, so they're `#[ignore]`d in CI and run locally).
pub mod engine;
pub mod engine_graph;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::list_clap_plugins,
            commands::rescan_plugins,
            commands::set_plugin_scan_interval,
            commands::list_midi_inputs,
            commands::list_audio_outputs,
            commands::engine_start_from_patch,
            commands::engine_update_rig,
            commands::engine_learn_start,
            commands::engine_learn_stop,
            commands::engine_rebind_routing,
            commands::engine_panic,
            commands::engine_send_midi,
            commands::engine_stop,
            commands::engine_status,
            commands::engine_self_test,
            commands::load_show,
            commands::save_show,
        ])
        .setup(|app| {
            tracing_subscriber::fmt()
                .with_env_filter(
                    tracing_subscriber::EnvFilter::try_from_default_env()
                        .unwrap_or_else(|_| "stardust=info,stardust_core=info".into()),
                )
                .init();

            // Spawn the engine thread once at app startup; its handle
            // lives in Tauri state for the rest of the process.
            let handle = engine::spawn(app.handle().clone());
            app.manage(handle);

            // Serializes plugin / MIDI / audio device enumeration so
            // CLAP dlopen can't race CoreAudio HAL on macOS.
            let discovery = commands::DiscoveryLock::default();
            app.manage(discovery.clone());

            // Plugin scan snapshot + background rescan thread (#4). The
            // thread waits `interval` between passes; a "Rescan now"
            // kick short-circuits the wait. Each pass publishes the
            // fresh snapshot on `plugins://scan`.
            let cache = std::sync::Arc::new(commands::PluginCache::default());
            let (kick_tx, kick_rx) = std::sync::mpsc::channel::<()>();
            cache.set_kick(kick_tx);
            app.manage(cache.clone());
            let app_handle = app.handle().clone();
            std::thread::Builder::new()
                .name("stardust-plugin-rescan".into())
                .spawn(move || {
                    use tauri::Emitter;
                    // Kick = rescan now; timeout = periodic pass;
                    // disconnect = app shutdown.
                    while let Ok(()) | Err(std::sync::mpsc::RecvTimeoutError::Timeout) =
                        kick_rx.recv_timeout(cache.interval())
                    {
                        let snapshot = {
                            let _guard = discovery.0.blocking_lock();
                            cache.scan()
                        };
                        let _ = app_handle.emit("plugins://scan", (*snapshot).clone());
                    }
                })
                .expect("failed to spawn plugin rescan thread");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running stardust");
}
