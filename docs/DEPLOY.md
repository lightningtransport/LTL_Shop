# Staging / Production deploy checklist (P0)

## Staging

- [ ] Supabase project created (separate from Production)
- [ ] `DATABASE_URL` + `DIRECT_URL` set (pooler + direct)
- [ ] Prisma migrate deploy applied
- [ ] Seed categories/catalog (or import from Shop)
- [ ] Mechanic users inserted in `users` with matching Supabase Auth emails
- [ ] `AUTH_DEV_BYPASS=false`
- [ ] `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` set on Vercel
- [ ] `SUPABASE_JWT_SECRET` or JWKS reachable from API
- [ ] API on Vercel Functions in `pdx1` with `CORS_ORIGIN` pointing to the Staging web URL
- [ ] Sentry DSN (web + api)
- [ ] PostHog key (optional)
- [ ] Smoke: login → create WO → Start Work → complete job → pause → resume → finish

## Production

- [ ] Branch protection + CI green
- [ ] No `AUTH_DEV_BYPASS`
- [ ] Secrets only in host env (never `NEXT_PUBLIC_` for service role)
- [ ] Staging acceptance signed off
- [ ] Rollback plan: previous Vercel web and API deployments
- [ ] For a multi-Category rollout, deploy additive readers/contracts before writers; rollback may disable new writes but must continue reading existing multi-Category Work Orders
