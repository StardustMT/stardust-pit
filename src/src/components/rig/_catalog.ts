/**
 * Rig device catalog — a library of pre-defined gear specs the user picks from
 * when assembling a rig. Each entry carries enough metadata to drive both the
 * library card display and the canvas visual.
 *
 * Add new gear by appending to RIG_DEVICE_CATALOG. Visual rendering for new
 * `kind` values goes in the rig setup screen's DeviceVisual switch.
 */

export type RigDeviceKind =
  | "keyboard88"
  | "keyboard76"
  | "keyboard61"
  | "keyboard49"
  | "pad-keyboard" // keyboard with on-board pads (Launchkey, MPK)
  | "pad-controller" // pads only (MPD, Launchpad)
  | "footswitch" // single sustain-style switch
  | "multi-switch" // dual/multi switch (FS-6, FS-7)
  | "expression-pedal"
  | "foot-controller" // multi-pedal floor unit (FCB1010)
  | "wind-controller"
  | "audio-interface"
  | "other"

export interface RigDeviceSpec {
  id: string
  vendor: string
  model: string
  kind: RigDeviceKind
  /** Number of keys, for keyboards */
  keys?: number
  /** Pad grid (rows × cols) for pad controllers / pad-keyboards */
  pads?: { rows: number; cols: number }
  /** Number of pedals/switches on a foot controller */
  pedals?: number
  hasUsbMidi?: boolean
  hasDinMidi?: boolean
  hasTrsMidi?: boolean
  /** Short one-line description shown in the library card */
  notes?: string
}

export const RIG_DEVICE_CATALOG: RigDeviceSpec[] = [
  // 88-key stage keyboards
  { id: "rd-2000", vendor: "Roland", model: "RD-2000", kind: "keyboard88", keys: 88,
    hasUsbMidi: true, hasDinMidi: true, hasTrsMidi: true, notes: "Stage piano with synth section" },
  { id: "cp88", vendor: "Yamaha", model: "CP88", kind: "keyboard88", keys: 88,
    hasUsbMidi: true, hasDinMidi: true, hasTrsMidi: true, notes: "Stage piano, weighted action" },
  { id: "stage-4-88", vendor: "Nord", model: "Stage 4 88", kind: "keyboard88", keys: 88,
    hasUsbMidi: true, hasDinMidi: true, notes: "Triple-engine stage keyboard" },
  { id: "mp11se", vendor: "Kawai", model: "MP11SE", kind: "keyboard88", keys: 88,
    hasUsbMidi: true, hasDinMidi: true, notes: "Stage piano, wood-key grand action" },
  { id: "generic-88", vendor: "Generic", model: "88-key keyboard", kind: "keyboard88", keys: 88,
    hasUsbMidi: true, notes: "Use for any unrecognised 88-key board" },

  // 76-key
  { id: "stage-4-76", vendor: "Nord", model: "Stage 4 76", kind: "keyboard76", keys: 76,
    hasUsbMidi: true, hasDinMidi: true },
  { id: "generic-76", vendor: "Generic", model: "76-key keyboard", kind: "keyboard76", keys: 76,
    hasUsbMidi: true },

  // 61-key
  { id: "stage-4-compact", vendor: "Nord", model: "Stage 4 Compact", kind: "keyboard61", keys: 73,
    hasUsbMidi: true, hasDinMidi: true, notes: "73-key semi-weighted" },
  { id: "yc61", vendor: "Yamaha", model: "YC61", kind: "keyboard61", keys: 61,
    hasUsbMidi: true, hasDinMidi: true, notes: "Stage organ/piano hybrid" },
  { id: "generic-61", vendor: "Generic", model: "61-key keyboard", kind: "keyboard61", keys: 61,
    hasUsbMidi: true },

  // 49-key + keys+pads controllers
  { id: "launchkey-49-mk4", vendor: "Novation", model: "Launchkey 49 MK4", kind: "pad-keyboard",
    keys: 49, pads: { rows: 2, cols: 8 }, hasUsbMidi: true,
    notes: "49 keys + 16 RGB pads + 9 faders + 8 knobs" },
  { id: "mpk261", vendor: "Akai", model: "MPK261", kind: "pad-keyboard",
    keys: 61, pads: { rows: 4, cols: 4 }, hasUsbMidi: true,
    notes: "61 semi-weighted keys + 16 MPC pads" },
  { id: "kk-m32", vendor: "Native Instruments", model: "Komplete Kontrol M32",
    kind: "pad-keyboard", keys: 32, hasUsbMidi: true, notes: "Mini-keys controller" },
  { id: "generic-49", vendor: "Generic", model: "49-key keyboard", kind: "keyboard49", keys: 49,
    hasUsbMidi: true },

  // Pad-only controllers
  { id: "mpd218", vendor: "Akai", model: "MPD218", kind: "pad-controller",
    pads: { rows: 4, cols: 4 }, hasUsbMidi: true },
  { id: "launchpad-x", vendor: "Novation", model: "Launchpad X", kind: "pad-controller",
    pads: { rows: 8, cols: 8 }, hasUsbMidi: true, notes: "64 RGB velocity pads" },
  { id: "maschine-mikro", vendor: "Native Instruments", model: "Maschine Mikro Mk3",
    kind: "pad-controller", pads: { rows: 4, cols: 4 }, hasUsbMidi: true },

  // Footswitches (sustain-style)
  { id: "fs-5u", vendor: "Boss", model: "FS-5U", kind: "footswitch",
    notes: "Sustain pedal, unlatched" },
  { id: "dp-10", vendor: "Roland", model: "DP-10", kind: "footswitch",
    notes: "Sustain + half-damper" },

  // Multi-switches
  { id: "fs-6", vendor: "Boss", model: "FS-6", kind: "multi-switch",
    notes: "Dual switch, latched + unlatched modes" },
  { id: "fs-7", vendor: "Boss", model: "FS-7", kind: "multi-switch",
    notes: "Dual footstomp switch" },

  // Expression pedals
  { id: "fc7", vendor: "Yamaha", model: "FC7", kind: "expression-pedal",
    notes: "Standard expression pedal" },
  { id: "ep-3", vendor: "Moog", model: "EP-3", kind: "expression-pedal",
    notes: "Expression pedal with polarity switch" },
  { id: "ex-p", vendor: "M-Audio", model: "EX-P", kind: "expression-pedal" },

  // Foot controllers
  { id: "fcb1010", vendor: "Behringer", model: "FCB1010", kind: "foot-controller",
    pedals: 12, hasDinMidi: true, notes: "10 footswitches + 2 expression pedals, DIN MIDI" },
  { id: "irig-blueboard", vendor: "IK Multimedia", model: "iRig Blueboard",
    kind: "foot-controller", pedals: 4, notes: "Bluetooth, 4 switches" },

  // Wind controllers
  { id: "ewi-5000", vendor: "Akai", model: "EWI 5000", kind: "wind-controller",
    hasUsbMidi: true, hasDinMidi: true, notes: "Wind synth + onboard sounds, MIDI out" },

  // Audio interfaces (for the audio-input feature pivot)
  { id: "scarlett-2i2", vendor: "Focusrite", model: "Scarlett 2i2", kind: "audio-interface",
    notes: "2-in / 2-out USB-C interface" },
  { id: "volt-2", vendor: "Universal Audio", model: "Volt 2", kind: "audio-interface",
    notes: "2-in / 2-out USB-C, UA preamp emulation" },
  { id: "motu-m2", vendor: "MOTU", model: "M2", kind: "audio-interface",
    notes: "2-in / 2-out USB-C with metering" },
]

/**
 * IDs of devices simulated as currently physically connected. Drives the
 * "match plugged-in" filter in the library. Replace with the real connected-
 * device list once the rig setup screen is wired to the Tauri backend.
 */
export const MOCK_CONNECTED_DEVICE_IDS = ["rd-2000", "launchkey-49-mk4", "fs-5u"]

export function findSpec(id: string): RigDeviceSpec | undefined {
  return RIG_DEVICE_CATALOG.find((d) => d.id === id)
}
