//! # stardust-pit
//!
//! Stardust app process. Hosts the Tauri runtime, owns the Show/Song/Patch
//! model, and drives the audio thread (via the stardust-core library).
//!
//! This file is the v0.1 scaffold — the real modules land in v0.2 (engine)
//! and v0.4 (data model + UI wiring).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
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
