/**
 * The language a round's interview is held in, kept apart from anyone's interface language (#230), and the
 * transcript settings it asks Zoom RTMS for. "auto" is for interviews that mix languages: Zoom's language
 * identification picks per utterance. Anything else is refused before a transcript connection is made, so a bad
 * value never opens a stream in the wrong language.
 *
 * Values are @zoom/rtms TranscriptLanguage ids (its default export's types omit the constants).
 */
export const INTERVIEW_LANGUAGES = ['zh', 'en', 'auto'] as const;
export type InterviewLanguage = (typeof INTERVIEW_LANGUAGES)[number];

const RTMS_LANGUAGE = { NONE: -1, CHINESE_SIMPLIFIED: 4, ENGLISH: 9 } as const;

export type TranscriptParams = { srcLanguage: number; enableLid: boolean };

export function transcriptParamsFor(language: string | null | undefined): TranscriptParams | null {
  switch (language ?? 'zh') {
    case 'zh': return { srcLanguage: RTMS_LANGUAGE.CHINESE_SIMPLIFIED, enableLid: false };
    case 'en': return { srcLanguage: RTMS_LANGUAGE.ENGLISH, enableLid: false };
    case 'auto': return { srcLanguage: RTMS_LANGUAGE.NONE, enableLid: true };
    default: return null;
  }
}
