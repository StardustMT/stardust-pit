//! Device-level rebind + panic integration tests (stardust-pit#1, #3).
//!
//! These open real cpal streams, so they can't run on CI runners (no
//! audio devices) — they're `#[ignore]`d and run locally:
//!
//! ```sh
//! cargo test --test rebind_live_device -- --ignored
//! ```

use stardust_pit_lib::engine::{
    AudioPick, EngineCommand, EngineStatus, RebindSpec, StartConfig, spawn_with_sink,
};
use stardust_pit_lib::engine_graph::self_test_graph;
use std::sync::mpsc;
use std::time::Duration;

fn wait_for_running(rx: &mpsc::Receiver<EngineStatus>) -> EngineStatus {
    let deadline = std::time::Instant::now() + Duration::from_secs(10);
    loop {
        let remaining = deadline
            .checked_duration_since(std::time::Instant::now())
            .expect("timed out waiting for Running status");
        match rx.recv_timeout(remaining).expect("status stream closed") {
            s @ EngineStatus::Running { .. } => return s,
            EngineStatus::Error { messages } => panic!("engine error: {messages:?}"),
            EngineStatus::Idle => {}
        }
    }
}

/// Start on the default output, hold a chord, rebind to the same
/// physical device by explicit name (default → named is a real
/// stream swap, not a no-op), and keep playing. The plan must survive:
/// rebind returns Ok, the engine stays Running, and the swap happens
/// while the testtone sustains under load.
#[test]
#[ignore = "requires a real audio output device; run locally"]
fn rebind_swaps_stream_without_teardown_under_load() {
    let (status_tx, status_rx) = mpsc::channel();
    let handle = spawn_with_sink(status_tx);

    handle
        .send(EngineCommand::Start(StartConfig {
            graph: self_test_graph(),
            midi_inputs: vec![],
            audio_output: None,
        }))
        .expect("start queued");
    let running = wait_for_running(&status_rx);
    let EngineStatus::Running { audio_output, .. } = running else {
        unreachable!()
    };

    // Sustained 4-note chord — the load the swap happens under.
    for note in [60u8, 64, 67, 71] {
        handle
            .send(EngineCommand::SendMidi(
                stardust_core::midi::MidiMessage::NoteOn {
                    channel: 0,
                    note,
                    velocity: 100,
                },
            ))
            .expect("note queued");
    }
    std::thread::sleep(Duration::from_millis(500));

    // Swap default → the same device picked by name. Different stream,
    // same plan.
    handle
        .rebind(RebindSpec {
            audio: Some(AudioPick {
                device: Some(audio_output.clone()),
            }),
            midi_inputs: None,
        })
        .expect("rebind succeeds");

    // Keep rendering on the new stream for the rest of the 5s window;
    // audible continuity is the manual half of this check.
    std::thread::sleep(Duration::from_secs(3));
    let snapshot = handle.snapshot();
    assert!(
        matches!(snapshot, EngineStatus::Running { .. }),
        "engine must still be running after rebind, got {snapshot:?}"
    );

    // Panic must not error while running.
    handle.send(EngineCommand::Panic).expect("panic queued");
    std::thread::sleep(Duration::from_millis(200));
    assert!(matches!(handle.snapshot(), EngineStatus::Running { .. }));
}

/// Rebinding to a device that doesn't exist must fail cleanly and leave
/// the original device active.
#[test]
#[ignore = "requires a real audio output device; run locally"]
fn rebind_to_missing_device_keeps_original_active() {
    let (status_tx, status_rx) = mpsc::channel();
    let handle = spawn_with_sink(status_tx);

    handle
        .send(EngineCommand::Start(StartConfig {
            graph: self_test_graph(),
            midi_inputs: vec![],
            audio_output: None,
        }))
        .expect("start queued");
    wait_for_running(&status_rx);

    let err = handle
        .rebind(RebindSpec {
            audio: Some(AudioPick {
                device: Some("no such device — stardust test".into()),
            }),
            midi_inputs: None,
        })
        .expect_err("rebind to a missing device must fail");
    assert!(
        matches!(
            err,
            stardust_pit_lib::engine::RebindError::AudioDeviceNotFound { .. }
        ),
        "got {err:?}"
    );
    assert!(matches!(handle.snapshot(), EngineStatus::Running { .. }));
}
