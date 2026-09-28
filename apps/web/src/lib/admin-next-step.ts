/**
 * LTR-159: the Work Order's own "next step" rule (LTR-105) is gone; every Admin
 * surface words the API's one `nextStep` with `truckNextStepText`
 * (`lib/truck-next-step.ts`). This file keeps the placeholder helper they share.
 */
export function fillPlaceholders(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
