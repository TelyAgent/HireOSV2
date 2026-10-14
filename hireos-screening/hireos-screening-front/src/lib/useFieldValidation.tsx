import { useCallback, useId, useRef, useState } from "react";

/**
 * Field-level validation (#26): a field is checked when the user leaves it, its error sits right under
 * it (wired up with aria-invalid / aria-describedby), and a failed submit moves focus to the first
 * invalid field instead of raising a toast at the top of the page.
 *
 * `rules` returns an error message (already translated) or null. Rules read current state, so they
 * are re-evaluated on every render: once a shown error is fixed it disappears while typing.
 */
export function useFieldValidation<K extends string>(rules: Record<K, () => string | null>) {
  const baseId = useId();
  const [touched, setTouched] = useState<Partial<Record<K, boolean>>>({});
  const elements = useRef<Partial<Record<K, HTMLElement | null>>>({});

  const errorOf = (key: K) => (touched[key] ? rules[key]() : null);
  const errorId = (key: K) => `${baseId}-${key}-error`;

  /** Spread onto the input: id, ref, onBlur, and the aria attributes. */
  const field = (key: K, { required = true }: { required?: boolean } = {}) => {
    const error = errorOf(key);
    return {
      id: `${baseId}-${key}`,
      ref: (el: HTMLElement | null) => {
        elements.current[key] = el;
      },
      onBlur: () => setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true })),
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error ? errorId(key) : undefined,
      "aria-required": required || undefined,
    };
  };

  /** The `<label htmlFor>` target for a field. */
  const labelFor = (key: K) => `${baseId}-${key}`;

  /** The error message under a field, if any. */
  const error = (key: K) => {
    const message = errorOf(key);
    return message ? (
      <p id={errorId(key)} className="field-error" role="alert">
        {message}
      </p>
    ) : null;
  };

  /**
   * Marks every field touched and returns whether all pass. On failure focuses the first invalid field;
   * `reveal` runs first so a field inside a collapsed section can be expanded before it is focused.
   */
  const validateAll = useCallback(
    (reveal?: (key: K) => void) => {
      const keys = Object.keys(rules) as K[];
      setTouched(Object.fromEntries(keys.map((k) => [k, true])) as Partial<Record<K, boolean>>);
      const first = keys.find((k) => rules[k]());
      if (!first) return true;
      reveal?.(first);
      // After the re-render that shows the errors (and any expanded section).
      window.setTimeout(() => elements.current[first]?.focus(), 0);
      return false;
    },
    [rules],
  );

  const reset = useCallback(() => setTouched({}), []);

  return { field, labelFor, error, validateAll, reset };
}
