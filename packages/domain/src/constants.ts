export const runStatuses = ["passed", "failed", "blocked", "skipped"] as const;

export const parseHealthValues = ["ok", "warning", "error"] as const;

export const priorityValues = ["low", "medium", "high"] as const;

export const evidenceKinds = ["file", "url"] as const;
