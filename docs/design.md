# Household Shopping List — Design Summary

A simple shared shopping list app for households. Built as a learning project; simplicity is the primary constraint.

## What It Does

Two core lists per household:

**Staples** — a curated list of items the household buys regularly. Each staple has a name, quantity, and a purchase interval (e.g. every 7 days). Staples are automatically added to the shopping list 2/3 of the way through their interval, giving household members time to review before the next order.

**Shopping list** — the active list of things to buy. Populated mostly from staples, plus any one-off items added manually. Members can review items, confirm they're needed, or remove them for this cycle. When purchased, items are checked off and the staple's interval timer resets.

## Core Workflows

- **Review staples** — before placing a weekly order, household members go through the shopping list (pre-populated from staples) and remove anything they already have enough of. Unreviewed staples show as "needs review"; confirming marks them "confirmed."
- **Add one-offs** — any member can add ad-hoc items directly to the shopping list.
- **Shop** — check off items as purchased. The backend resets the staple timer and clears the item.
- **Household management** — one household per user (for now). Invite others by email. Accepting an invite merges your existing list into the inviting household's list. Leaving creates a new household with a copy of the shared lists.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js / React |
| Backend | FastAPI (Python) |
| Database | Postgres |
| ORM / migrations | SQLAlchemy ORM 2.x / Alembic |
| Hosting | Railway |
| Auth | Google OAuth (no password management) |
| Real-time | Server-Sent Events (SSE) — server pushes updates on any write |
| Staple promotion | Cron job — runs periodically, adds eligible staples to shopping list |
| Python dependencies | Poetry — handles virtual environments, dependency locking, and packaging |

## Data Model (high level)

- **users** — email, Google OAuth id
- **households** — the shared unit that owns both lists
- **memberships** — joins users to households; status is `pending` (invited) or `member`
- **staples** — belong to a household; store name, quantity (free text), interval in days, and when to next add to the shopping list
- **shopping_list_items** — belong to a household; optional `staple_id` (null for one-offs); status is `needs_review`, `confirmed`, or `purchased`

## Key Behaviours

- Staples are copied (not referenced) onto the shopping list when promoted. Edits to a staple don't affect the current cycle's item.
- Staple re-add timing: `last_purchased_at + (interval * 2/3)`. Same rule applies whether the item was purchased or skipped.
- SSE connection is opened per household on page load. All writes broadcast an event so both household members see updates without refreshing.
- Quantity is a free-text field (e.g. "2L", "1 pack"). No units enum for now.

## Explicitly Out of Scope (v1)

- Purchase history / analytics
- Smart suggestions (auto-promote frequently bought items to staples)
- Multiple households per user
- Push notifications
- Mobile app (web only, but mobile-friendly)
