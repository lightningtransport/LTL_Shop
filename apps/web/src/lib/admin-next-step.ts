/**
 * LTR-159: the Work Order's own "next step" rule (LTR-105) is gone; every Admin
 * surface words the API's one `nextStep` with `truckNextStepText`
 * (`lib/truck-next-step.ts`). This file keeps the placeholder helper they share.
 */
/**
 * `{key}` takes the value; `{key:one|many}` picks the word for that number ("{count} {count:Job|Jobs} left" →
 * "1 Job left", "2 Jobs left"), so a count never reads "1 Jobs" (mobile UI review, 2026-10-19). A branch may hold `{key}`
 * ("{count:The Job is done|All {count} Jobs are done}").
 */
export function fillPlaceholders(template: string, values: Record<string, string>) {
  return template
    .replace(/\{(\w+):((?:[^|{}]|\{\w+\})*)\|((?:[^{}]|\{\w+\})*)\}/g, (match, key: string, one: string, many: string) => (values[key] === undefined ? match : Number(values[key]) === 1 ? one : many))
    .replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}
