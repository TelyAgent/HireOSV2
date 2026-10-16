/**
 * Scoring-dimension wording (#180). Work authorization is not used in screening (F05 BR-3): the default
 * "Compensation & Location Fit" text names salary and work location only. A confirmed version keeps the words
 * it was confirmed with; a new draft starts from the current wording, and older text that mentions
 * authorization is shown with a note that it isn't used.
 */
export const LEGACY_COMPENSATION_LOCATION_RUBRIC = "Whether location and authorization fit the role.";
export const COMPENSATION_LOCATION_RUBRIC = "Whether the salary expectation and the work location (country + city) fit the role.";

/** The wording a new draft starts from: the old default becomes the current one; anything else is kept. */
export function currentRubric(rubric: string): string {
  return rubric.trim() === LEGACY_COMPENSATION_LOCATION_RUBRIC ? COMPENSATION_LOCATION_RUBRIC : rubric;
}

export function mentionsAuthorization(text: string): boolean {
  return /authori[sz]ation|visa|work permit|工作授权|签证|工作许可/i.test(text);
}
