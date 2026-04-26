# Project Guidance

This is a personal learning project for a simple household shopping list app. Keep implementation choices boring, explicit, and easy to understand.

## Source Of Truth

- Product requirements live in `docs/PRD.md`.
- Architecture and behavioral summary lives in `docs/design.md`.
- When requirements are unclear, prefer the simpler v1 behavior described in those docs over adding broader product scope.

## Product Scope

- Build one shared household shopping experience: staples, an active shopping list, real-time coordination, Google OAuth, and household invites.
- Treat P0 requirements as the target for v1.
- Keep P1/P2 ideas out of the first implementation unless explicitly requested.
- Web only, but every core workflow should work on a narrow mobile viewport.

## Tech Stack

- Frontend: Next.js and React.
- Backend: FastAPI with Python dependency management through Poetry.
- Database: Postgres.
- Hosting target: Railway.
- Auth: Google OAuth only, with a development-only login bypass allowed for testing.
- Real-time updates: Server-Sent Events scoped per household.

## Core Invariants

- A user belongs to one household for v1.
- `quantity` is free text; do not introduce unit enums.
- Auto-promoted staples create independent shopping list item copies. Editing or deleting a staple must not mutate current-cycle list items.
- Promotion timing is based on `last_purchased_at + interval * 2/3`; skipped and purchased staple-linked items both reset the timer.
- One-off shopping list items are confirmed immediately and have no staple side effects.
- All writes should broadcast an SSE event so other household members update without refresh.
- Invite acceptance appends both lists into the inviting household with no deduplication.

## Implementation Style

- Favor small, testable phases matching the PRD timeline: data/auth, staples/promotion, shopping UI/auth, SSE, household management, deployment polish.
- Add tests around timing, merge, and side-effect behavior; these are the riskiest parts of the app.
- Avoid hard deletes where future purchase history would be blocked, but do not build analytics/history in v1.
