// Field-length standard (BA DR-28, 2026-10-24), same values as the POS FE
// (FE-POS-App src/constants/fieldLimits.js). The BE refuses anything longer.
export const FIELD_LIMITS = {
  PERSON_NAME: 100,
  SHORT_NOTE: 140,
  DESCRIPTION: 255,
} as const;

export const isAtLimit = (value: string, max: number) => value.length >= max;

// Border classes of a limited field: the field's own, or red at the limit.
export const limitBorder = (value: string, max: number, normal: string) =>
  isAtLimit(value, max)
    ? "border-red-500 dark:border-red-500 focus:border-red-500 focus:ring-red-500/30"
    : normal;
