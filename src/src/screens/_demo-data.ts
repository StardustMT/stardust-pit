// =============================================================================
// Little Shop of Horrors (1982, off-Broadway). The canonical Keys-2 book
// with weird custom synths, multi-keyboard splits, and lots of patch
// changes. Used as demo data through the app.
// =============================================================================

export const LSOH_ACT_ONE = [
  {
    id: "s1",
    number: 1,
    name: "Prologue / Little Shop of Horrors",
    patches: [
      { id: "s1.1", number: 1, name: "Narrator strings" },
      { id: "s1.2", number: 2, name: "Doo-wop trio entrance" },
      { id: "s1.3", number: 3, name: "Audrey II growl" },
    ],
  },
  {
    id: "s2",
    number: 2,
    name: "Skid Row (Downtown)",
    patches: [
      { id: "s2.1", number: 1, name: "Verse groove", compound: true },
      { id: "s2.2", number: 2, name: "Chorus tutti", compound: true },
      { id: "s2.3", number: 3, name: "Audrey II tag" },
      { id: "s2.4", number: 4, name: "Outro vamp" },
    ],
  },
  {
    id: "s3",
    number: 3,
    name: "Da-Doo",
    patches: [
      { id: "s3.1", number: 1, name: "Verse — Rhodes" },
      { id: "s3.2", number: 2, name: "Hand-claps + bass" },
    ],
  },
  {
    id: "s4",
    number: 4,
    name: "Grow For Me",
    patches: [
      { id: "s4.1", number: 1, name: "Verse — acoustic" },
      { id: "s4.2", number: 2, name: "Lift — strings", compound: true },
      { id: "s4.3", number: 3, name: "Outro chord" },
    ],
  },
  {
    id: "s5",
    number: 5,
    name: "Ya Never Know",
    patches: [
      { id: "s5.1", number: 1, name: "Vamp" },
      { id: "s5.2", number: 2, name: "Stings" },
    ],
  },
  {
    id: "s6",
    number: 6,
    name: "Somewhere That's Green",
    patches: [
      { id: "s6.1", number: 1, name: "Audrey verse — Wurli" },
      { id: "s6.2", number: 2, name: "Bridge strings", compound: true },
      { id: "s6.3", number: 3, name: "Outro reprise" },
    ],
  },
  {
    id: "s7",
    number: 7,
    name: "Closed For Renovations",
    patches: [
      { id: "s7.1", number: 1, name: "Setup vamp" },
      { id: "s7.2", number: 2, name: "Trio entrance" },
    ],
  },
  {
    id: "s8",
    number: 8,
    name: "Dentist!",
    patches: [
      { id: "s8.1", number: 1, name: "Intro organ stab" },
      { id: "s8.2", number: 2, name: "Orin verse", compound: true },
      { id: "s8.3", number: 3, name: "Bridge — sax synth" },
      { id: "s8.4", number: 4, name: "Outro vamp" },
    ],
  },
  {
    id: "s9",
    number: 9,
    name: "Mushnik and Son",
    patches: [
      { id: "s9.1", number: 1, name: "Klezmer accordion" },
      { id: "s9.2", number: 2, name: "Mushnik verse" },
    ],
  },
  {
    id: "s10",
    number: 10,
    name: "Sudden Changes",
    patches: [
      { id: "s10.1", number: 1, name: "Underscore pad" },
      { id: "s10.2", number: 2, name: "Bell motif" },
    ],
  },
  {
    id: "s11",
    number: 11,
    name: "Feed Me (Git It)",
    patches: [
      { id: "s11.1", number: 1, name: "Audrey II groove", compound: true },
      { id: "s11.2", number: 2, name: "Seymour reply" },
      { id: "s11.3", number: 3, name: "Tutti chorus", compound: true },
      { id: "s11.4", number: 4, name: "Outro stab" },
    ],
  },
]

export const LSOH_ACT_TWO = [
  {
    id: "s12",
    number: 12,
    name: "Suppertime",
    patches: [
      { id: "s12.1", number: 1, name: "Audrey II vamp" },
      { id: "s12.2", number: 2, name: "Bridge brass" },
    ],
  },
  {
    id: "s13",
    number: 13,
    name: "The Meek Shall Inherit",
    patches: [
      { id: "s13.1", number: 1, name: "Salesmen verse" },
      { id: "s13.2", number: 2, name: "Seymour decision", compound: true },
      { id: "s13.3", number: 3, name: "Outro stab" },
    ],
  },
  {
    id: "s14",
    number: 14,
    name: "Suddenly, Seymour",
    patches: [
      { id: "s14.1", number: 1, name: "Verse — Wurli soft" },
      { id: "s14.2", number: 2, name: "Chorus — strings layer", compound: true },
      { id: "s14.3", number: 3, name: "Outro pad" },
    ],
  },
  {
    id: "s15",
    number: 15,
    name: "Sominex / Suppertime (reprise)",
    patches: [
      { id: "s15.1", number: 1, name: "Tense pad" },
      { id: "s15.2", number: 2, name: "Plant reprise" },
    ],
  },
  {
    id: "s16",
    number: 16,
    name: "Don't Feed the Plants",
    patches: [
      { id: "s16.1", number: 1, name: "Finale tutti", compound: true },
      { id: "s16.2", number: 2, name: "Plant takeover" },
      { id: "s16.3", number: 3, name: "Curtain chord" },
    ],
  },
]

export const LSOH_FULL = [...LSOH_ACT_ONE, ...LSOH_ACT_TWO]
