export const VIEW_IDS = ["overview", "workspace", "records", "factor-settings", "methodology"] as const;
export type AppView = typeof VIEW_IDS[number];
export const RECORD_STEPS = [1, 2, 3, 4] as const;
export type RecordStep = typeof RECORD_STEPS[number];

export function viewFromHash(hash: string, current: AppView = "overview"): AppView | null {
  if (hash === "#main") return current;
  const value = hash.replace(/^#/, "") || "overview";
  return VIEW_IDS.find((view) => view === value) ?? null;
}

export function isRecordStep(value: unknown): value is RecordStep {
  return RECORD_STEPS.some((step) => step === value);
}

export function nextRecordStep(step: RecordStep): RecordStep {
  return step === 1 ? 2 : step === 2 ? 3 : 4;
}

export function previousRecordStep(step: RecordStep): RecordStep {
  return step === 4 ? 3 : step === 3 ? 2 : 1;
}
