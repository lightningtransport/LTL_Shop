# Dependency security status

## Verified 2026-09-04

`npm audit` reports zero critical findings after upgrading Next.js, NestJS,
Supabase JS, Vitest, and Prisma. It still reports six high findings and one
moderate finding:

- Five high findings are bundled through Prisma 7's CLI and Studio dependency
  graph (`@prisma/config`, `deepmerge-ts`, `mysql2`, and `lodash`). The API uses
  the PostgreSQL driver adapter only; it does not expose Prisma Studio, MySQL,
  or Prisma CLI to application users.
- The remaining high finding is `picomatch` in build/test tooling. It is absent
  from the `npm audit --omit=dev` result.

The registry's offered fix downgrades Prisma to 6.19.3, which would undo the
Prisma 7 migration and does not represent a safe remediation. No override is
applied because Prisma pins the affected dependency versions and compatibility
with newer majors is unconfirmed.

## Mitigation and release gate

- Run Prisma only in controlled build, migration, and seed environments; never
  expose Studio or Prisma CLI through the deployed API.
- Keep runtime database access on the PostgreSQL adapter and do not configure a
  MySQL datasource.
- Re-run both `npm audit` and `npm audit --omit=dev` for every dependency
  update. Upgrade Prisma as soon as an upstream stable release removes these
  advisories, then run the full verification gate and Preview smoke test.
- Do not use `npm audit fix --force` or a transitive override merely to make the
  audit count disappear.
