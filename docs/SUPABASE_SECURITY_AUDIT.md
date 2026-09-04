# Supabase security audit

The application accesses domain tables only through NestJS and Prisma. Browser
code uses Supabase Auth only; it does not query `public` tables directly.

## Required live audit

Run these read-only checks against the linked Supabase project before applying
any privilege or RLS migration:

1. Run `supabase db advisors` with an authenticated CLI session.
2. Inventory table privileges for `anon` and `authenticated` in `public`.
3. Verify RLS is enabled for every domain table and that no permissive policy
   exposes rows through the Data API.

Do not grant `anon` or `authenticated` access to domain tables. The API's
database role remains the server-side access path. Record advisor findings and
the privilege inventory in the pull request; do not copy credentials or
connection strings into this repository.

## Current repository evidence

The PM catalog migration enables RLS on its six PM-specific tables. The earlier
domain schema predates that migration, so its live grants and RLS state must be
confirmed from the project rather than inferred from local files. The existing
`supabase/migrations` directory is historical only; Prisma migrations under
`apps/api/prisma/migrations` remain the schema authority.
