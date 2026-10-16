/**
 * Where each draft field came from (#68, M1 FR-5): written by the user or suggested by AI, how many times its
 * value has changed (revision), and whether it still awaits the user's confirmation. AI suggestions stay
 * `pending` until the user confirms or edits them; confirming doesn't change the value, so not the revision.
 */
export type FieldSource = 'user' | 'ai';
export type FieldMeta = { source: FieldSource; revision: number; status: 'confirmed' | 'pending' };
export type FieldMetaMap = Record<string, FieldMeta>;

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Records the fields a turn changed: AI-written ones pending, user-written ones confirmed. */
export function recordChanges(
  meta: FieldMetaMap,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  sourceOf: (field: string) => FieldSource,
): FieldMetaMap {
  const next: FieldMetaMap = { ...meta };
  for (const [field, value] of Object.entries(after)) {
    if (value === undefined || same(value, before[field])) continue;
    const source = sourceOf(field);
    next[field] = { source, revision: (meta[field]?.revision ?? 0) + 1, status: source === 'user' ? 'confirmed' : 'pending' };
  }
  return next;
}

/** The user confirms fields as they are: status only, the value and its revision stay. */
export function confirmFields(meta: FieldMetaMap, fields: string[]): FieldMetaMap {
  const next: FieldMetaMap = { ...meta };
  for (const field of fields) if (next[field]) next[field] = { ...next[field], status: 'confirmed' };
  return next;
}

export function asFieldMeta(value: unknown): FieldMetaMap {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as FieldMetaMap) : {};
}
