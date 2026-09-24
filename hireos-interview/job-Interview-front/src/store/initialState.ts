import type { AppState } from "./types";

export const R1_SCORES: Record<string, number> = {
  dsd: 4,
  bed: 4,
  tc: 4,
};

export const initialState: AppState = {
  theme: "light",
  accent: "teal",
  textSize: "medium",
  lang: "en",
  roleIdx: 0,
  systemDark: false,

  screen: "home",
  currentTaskId: null,
  liveJoinRound: null,

  moreOpen: false,
  overviewStatsOpen: true,
  showAppearance: false,

  searchQuery: "",
  homeFilter: "All projects",
  homeViewMode: "tasks",

  showCreateModal: false,
  showEvidenceRequest: false,
  drawer: null,
  sourceAnswer: null,
  toast: "",

  jdText:
    "Senior Backend Engineer — Platform Engineering\nRemote (APAC / EU overlap)\n\nWe're looking for a Senior Backend Engineer to own the reliability and evolution of our order and payments platform...",
  jdFileName: null,
  attachedMaterials: [],

  jdOnlyDraft: false,
  draftCreated: false,
  rubricExtracted: true,
  rubricConfirmed: true,
  rubricVersion: 1,
  rubricEditing: false,
  candidateLinked: true,
  planMode: "all",
  planApproved: true,
  planEditing: false,

  r1Scheduled: true,
  r2Scheduled: true,
  r1Done: true,
  r2Done: true,
  roundView: "r1",

  rec: "on",
  transcriptState: "ok",
  liveTab: "notes",
  liveNotes:
    "Strong region-failover example — owned end to end. Quantified P99 improvement. Confident on trade-offs.",
  notesSavedAt: "Saved",
  aiSuggestionState: "idle",
  qIdx: 0,

  r2Scores: { poir: 3, sca: null, cm: 3 },
  humanScoreOverrides: {},
  humanNotes: {},
  roundRecommendations: {},

  followUpRounds: [],
  evidenceOwner: "hm",
  evidenceFormat: "panel",
  evidenceDue: "Sep 12, 2026",

  decision: "Recommend for offer",
  decHr: true,
  decHm: false,
  decRecorded: false,

  offerState: "none",

  inviteFailed: false,

  dupResolved: false,
  triResolved: false,

  filesTab: "files",
  uploadVisible: false,
  uploadBatch: [],
  uploadedFiles: [],
  emailStatus: "connected",
  emailLastReadAt: "7 Sep 2026, 09:14",
  folderStatus: "watching",
  folderLastScanAt: "7 Sep 2026, 09:00",
  activityFilter: "All",
  activityRetried: {},
  activityExpanded: {},
};