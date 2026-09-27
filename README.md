# KuisPoin v0.5 — Production Core

KuisPoin adalah web quiz mobile-first dengan Google OAuth, Supabase/PostgreSQL, server-side quiz validation, point ledger, mission/streak, withdrawal manual, admin CMS, fraud review, user management, notifications, analytics awal, dan fondasi rewarded-ad **non-cash**.

## Upgrade database
Jika project lama sudah menjalankan `schema.sql`, `002_rewards_withdrawals.sql`, dan `003_hardening_cms.sql`, jalankan hanya:

```sql
-- Supabase SQL Editor
-- isi file database/004_production_core.sql
```

Untuk instalasi baru jalankan berurutan: `schema.sql` → `seed.sql` → `002_rewards_withdrawals.sql` → `003_hardening_cms.sql` → `004_production_core.sql`.

## Environment
Copy `.env.example` ke `.env.local` dan isi credential milikmu. Jangan commit service-role key / Google secret.

## Run
```bash
npm install
npm run build
npm run dev
```

## Security model
- Browser tidak pernah menentukan score/reward.
- Finalisasi quiz sekarang atomic di PostgreSQL (`finish_quiz_atomic`).
- Mission claim + ledger atomic (`claim_mission_atomic`).
- Withdrawal menggunakan advisory lock dan fraud gate.
- Rate limit tersimpan di database untuk endpoint bernilai ekonomi.
- Admin dicek ulang ke database, bukan hanya role JWT.
- Semua tindakan admin penting masuk audit log.
- Rewarded-ad wallet sengaja dipisah dari `point_transactions`: hint/ticket/XP tidak redeemable menjadi uang.

## Admin
- `/admin` overview + withdrawal
- `/admin/quizzes` CMS quiz
- `/admin/fraud` fraud review
- `/admin/users` user management
- `/admin/analytics` analytics 7 hari
- `/admin/settings` reward/economy settings

## Belum production-complete
Belum ada provider iklan, server-side verification provider iklan, automated payout provider/webhook/reconciliation, distributed bot/device intelligence, observability/error tracking, privacy/terms pages, automated test suite/CI, backup/restore drill, referral, dan advanced retention/experimentation.

## v0.7 Production Candidate additions
- Dedicated responsive Admin Console and `/admin/withdrawals` management.
- Fixed withdrawal overview/list consistency by joining users server-side.
- Random 10-question sessions and randomized answer order.
- `database/005_question_bank.sql` adds 80 idempotent general-knowledge questions.
- `/api/health` for deployment health checks.
- `vercel.json` baseline for Vercel serverless API routes.
- Rewarded-ad database architecture remains separated from redeemable points (`ad_reward_sessions` + `noncash_wallets`). No ad provider is hard-coded.

### Upgrade existing database
Run only the newest unapplied migration in Supabase SQL Editor:
`database/005_question_bank.sql`

### Vercel
Set these Environment Variables in Vercel Project Settings (Production + Preview as appropriate):
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
For production, set `NEXTAUTH_URL` to the canonical HTTPS deployment domain and add its OAuth callback to Google Cloud, e.g. `https://your-domain.example/api/auth/callback/google`.
Never expose `SUPABASE_SERVICE_ROLE_KEY` to client components or `NEXT_PUBLIC_*` variables.

### Ads
Do not connect Google rewarded-ad completion to redeemable `point_transactions`. Google-served rewarded ads require rewards to be non-transferable and not directly convertible to money. The prepared non-cash wallet is intended for HINT/TICKET/XP rewards. If a future provider explicitly permits cash-equivalent rewarded traffic, integrate it behind a provider adapter and server-verification flow rather than trusting a browser callback.

## v0.8 production hardening

After migrations through `005_question_bank.sql`, run `database/006_security_hardening.sql`.

Before every Vercel deployment run:

```bash
npm run check
```

Production environment variables belong in Vercel Project Settings, never in source control. Use a separate Preview/Production value for `NEXTAUTH_URL` when needed. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.

Recommended release gate: health endpoint OK, Google login OK, quiz reward exactly once, mission claim exactly once, withdrawal hold/refund correct, non-admin rejected from `/admin`, suspended/banned users rejected by mutation APIs.

## v0.9 Automated Tests & Money Safety

Run migration `database/007_money_safety.sql` after `006_security_hardening.sql`.

Quality gate before staging:

```bash
npm install
npm run verify
```

`verify` requires TypeScript, unit/security tests, and the production build to all pass. The test suite covers payout normalization/validation, UUID validation, supported e-wallet allowlisting, integer/positive withdrawal amounts, malformed payload rejection, and overlong account-name rejection.

Database money-safety remains enforced in PostgreSQL: quiz rewards are unique per attempt, mission claims are unique per user/mission/day, withdrawal holds are atomic under a per-user advisory lock, rejected-withdrawal refunds are now uniquely constrained, and withdrawal points must be positive.

### Release gate still requiring a real staging database
Before public real-money launch, run concurrency/integration tests against an isolated Supabase staging project (never production): simultaneous quiz finish, simultaneous withdrawal, repeated reject/refund, and admin state-transition tests. Unit tests cannot prove PostgreSQL locking behavior by themselves.

## v0.10 Money-Safety Integration Tests

This release adds opt-in integration/concurrency tests against the configured Supabase database.
They create temporary users/quizzes/ledger rows, run 100 concurrent RPC calls, assert the money-safety invariants, then clean up their fixtures.

**Important:** run these only while the connected Supabase project is being used as DEV/TEST. Do not enable them against a production database with real users or payouts.

Add this only to your local `.env.local` while testing:

```env
ALLOW_MONEY_SAFETY_TESTS="true"
```

Then run:

```powershell
npm install
npm run verify
npm run test:integration
```

The integration gate proves:
- 100 concurrent `finish_quiz_atomic` calls for one attempt produce exactly one `QUIZ_REWARD` transaction.
- 100 concurrent `create_withdrawal_atomic` calls against a 1,000 point balance produce one 1,000-point hold, never a negative final balance, and never more than 1,000 points held.

Set `ALLOW_MONEY_SAFETY_TESTS` back to `false` or remove it after the test run.

## v0.11 Fraud Engine V2
Apply `database/008_fraud_engine_v2.sql` after migration 007. It adds structured fraud severity/evidence, a server-side withdrawal risk snapshot, high-risk payout blocking, and an upgraded admin fraud review screen. Risk signals do not automatically ban users.

## v0.12 Observability & Production Monitoring

Apply `database/009_observability.sql` after migration 008. It adds a server-only `operational_events` store with request correlation IDs, level/event/route/status/latency fields and a retention cleanup RPC. Sensitive metadata is redacted before logging.

Admin: `/admin/operations` shows DB health, 24h error/warning counts, recent latency snapshot, and the latest 100 operational events. Critical quiz-finish and withdrawal flows emit structured events without storing payout account numbers or secrets.

`/api/health` now returns service version, DB state, latency, timestamp and request ID, with `cache-control: no-store`.

## v0.13 Ads Foundation

Rewarded ads are isolated from redeemable points. `database/010_ads_foundation.sql` adds an atomic, idempotent non-cash reward flow using `ad_reward_sessions` and `noncash_wallets`.

For staging smoke tests only, set `REWARDED_AD_PROVIDER=DEMO`. The demo simulates a completed rewarded video and grants a non-cash ticket. It never writes to `point_transactions`. Keep `REWARDED_AD_PROVIDER=DISABLED` until migration 010 is applied. A real production provider must replace the demo completion endpoint with provider-backed verification/webhook logic before public launch.
