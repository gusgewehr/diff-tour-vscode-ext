// Fixed UI text shared by the three webviews. No vscode or DOM access: the host fills it via t() and embeds it in the HTML.
export const EN = {
  // writing
  writingTour: 'Writing tour',
  stageExport: 'Export',
  stageWrite: 'Write',
  stageCheck: 'Check',
  stageShow: 'Show',
  stageExportDesc: 'git archive, git diff and git log into a cache directory. Only files git tracks.',
  stageWriteDesc: 'The LLM reads with Read, Grep and Glob, then writes the tour as JSON.',
  stageCheckDesc: 'Every file and line the tour points to must exist. Mistakes go back to the LLM, at most twice.',
  stageShowDesc: 'Code on screen is read from git at the right commit, never copied from the reply.',
  repairCount: 'Repair {0} of 2',
  readingNow: 'READING NOW',
  waitingForLlm: 'Waiting for the LLM to read…',
  exportDirectory: 'EXPORT DIRECTORY',
  exportNote: 'Deleted once the tour is written. Read, Grep and Glob only; no writes, no network.',
  cancel: 'Cancel',
  skipToTour: 'Skip to the tour',
  // flow bar
  flow: 'FLOW',
  // tour chrome
  stepOf: 'Step {0} / {1}',
  yourGuess: 'Your guess',
  guessPlaceholder: 'Write what you expect before reading the answer',
  showAnswer: 'Show the answer',
  stopAndPredictLabel: 'STOP AND PREDICT',
  stopAndPredictTitle: 'Stop and predict before you go on',
  yourGuessLabel: 'YOUR GUESS',
  noGuess: 'You did not write a guess.',
  myNote: 'My note',
  myNoteLabel: 'MY NOTE',
  noteHint: 'Private. Kept in VS Code, never in the repository.',
  prev: '← Prev',
  next: 'Next →',
  gotoStep: 'Go to step {0} ({1})',
  understood: 'Understood ✓ (U)',
  markUnderstood: 'Mark as understood (U)',
  note: 'Note (N)',
  openFile: 'Open file',
  // blocks
  newFile: 'new file',
  deleted: 'deleted',
  noChange: 'no change in these lines',
  addedRemoved: '+{0} −{1} here',
  approximate: 'approximate',
  annotation: 'NOTE',
  annotationTitle: 'Note from the tour, not part of the code',
  approximateTitle: 'The tour referenced lines that do not exist at this commit; shown clamped',
  open: 'open ↗',
  openDiff: 'Open read-only diff',
  beforeAt: '↶ BEFORE · {0}',
  afterAt: 'AFTER · {0}',
  fileDidNotExist: ' · this file did not exist',
  fileWasDeleted: ' · this file was deleted',
  codeNotLoaded: 'Code not loaded',
  codeInStep: 'code in step {0}',
  openFileLower: 'open file',
  basisFact: 'Verified',
  basisInferred: 'From the code',
  basisOpinion: 'Senior view',
  noCommitList: 'No commit list (no toured commits)',
  aiCoAuthor: 'AI CO-AUTHOR',
  binary: 'binary',
  notInRepo: 'Not in this repository',
  example: 'EXAMPLE',
  copy: 'Copy',
  copied: 'Copied',
  exampleTag: 'example',
  exampleTagTitle: 'Made-up data for the explanation',
  schema: 'SCHEMA',
  migrations: 'migrations: {0}',
  noTables: 'No tables named',
  blockNotShown: ' block: not shown in this version',
} as const;

export type Strings = { -readonly [K in keyof typeof EN]: string };

export const S: Strings = { ...EN };

export function applyStrings(json: string | undefined): void {
  if (!json) return;
  let o: unknown;
  try { o = JSON.parse(json); } catch { return; }
  if (!o || typeof o !== 'object') return;
  for (const k of Object.keys(EN) as Array<keyof Strings>) {
    const v = (o as Record<string, unknown>)[k];
    if (typeof v === 'string') S[k] = v;
  }
}

export function localized(tr: (m: string) => string): Strings {
  const out = {} as Strings;
  for (const k of Object.keys(EN) as Array<keyof Strings>) out[k] = tr(EN[k]);
  return out;
}
