/** Remembers which of the candidate detail page's four tabs was last open, per case — mirrors the
 * prototype's `planPageSelectedTab` global (module-level, not React state, so it survives navigating
 * away and back without needing to persist to localStorage). */
export const planPageSelectedTab: Record<string, "plan" | "submission" | "evaluation" | "result"> = {};
