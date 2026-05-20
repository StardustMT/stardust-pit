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
mod engine;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::list_clap_plugins,
            commands::list_midi_inputs,
            commands::list_audio_outputs,
            commands::engine_start,
            commands::engine_stop,
            commands::engine_status,
            commands::load_patch,
            commands::save_patch,
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
            app.manage(commands::DiscoveryLock::default());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running stardust");
}
