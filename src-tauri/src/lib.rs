//! # stardust-pit
//!
//! Stardust app process. Hosts the Tauri runtime, owns the Show/Song/Patch
//! model, and drives the audio thread (via the stardust-core library).
//!
//! Phase v0.2 in progress: read-only Tauri commands wire the React UI to
//! stardust-core. Engine-state commands (start/stop, route MIDI through
//! plugin chains) land in a dedicated `engine` module so the audio
//! thread + `!Send` plugin handles stay off the Tauri command pool.

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::list_clap_plugins,
            commands::list_midi_inputs,
            commands::list_audio_outputs,
        ])
        .setup(|_app| {
            tracing_subscriber::fmt()
                .with_env_filter(
                    tracing_subscriber::EnvFilter::try_from_default_env()
                        .unwrap_or_else(|_| "stardust=info,stardust_core=info".into()),
                )
                .init();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running stardust");
}
