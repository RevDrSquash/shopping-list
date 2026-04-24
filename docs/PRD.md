# PRD: Household Shopping List App

**Status**: Draft  
**Author**: Tristan  
**Last Updated**: 2026-04-24  
**Project Type**: Learning project

---

## Problem Statement

Households that shop on a recurring schedule have no lightweight, shared tool that automates the tedious work of rebuilding a shopping list each week. Members either maintain lists in a general-purpose notes app that has no concept of recurring items, or they rely on memory and duplicate effort. The cost of not solving this is small but chronic: time wasted re-adding the same items, miscommunication between household members, and things getting forgotten. This project solves the problem as a focused learning exercise, deliberately trading breadth for simplicity.

---

## Goals

1. **Reduce manual list-building effort** — household members spend less than 2 minutes preparing a shopping list for a weekly order, down from 5–10 minutes of manually re-adding staples.
2. **Eliminate missed staples** — zero instances of a regularly-bought item being forgotten because it was not manually re-added.
3. **Enable real-time coordination** — two household members can review and modify the same list simultaneously without needing to refresh or merge conflicting changes.
4. **Working, deployable app** — the app is successfully deployed to Railway and usable end-to-end as a complete learning exercise covering Next.js, FastAPI, Postgres, SSE, and OAuth.
5. **Low cognitive overhead** — a first-time household member can understand and complete the full review-and-shop workflow without any instructions.

---

## Non-Goals

1. **Purchase history and analytics** — tracking what was bought and when is a meaningful feature but adds data retention complexity out of proportion to the learning goals of v1.
2. **Smart suggestions / auto-promotion** — automatically promoting frequently-purchased items to staples requires behavioural data that doesn't exist yet. Scope for a future version.
3. **Multiple households per user** — one household per user keeps the data model and UI simple. Most real households don't need this.
4. **Push notifications** — browser and mobile notifications add platform-specific complexity; SSE real-time updates are sufficient for coordinated shopping.
5. **Native mobile app** — the web app will be mobile-friendly (responsive design), but a dedicated iOS or Android app is out of scope for a learning project.

---

## User Stories

### Household Member

- As a household member, I want to see a shopping list pre-populated with my household's recurring staples so that I don't have to manually re-add items I buy every week.
- As a household member, I want to review each item on the list and mark it as confirmed or remove it for this cycle so that I only buy what we actually need.
- As a household member, I want to add one-off items to the shopping list so that I can include things we need this week that aren't regular staples.
- As a household member, I want to check off items as I shop so that I can track what I've already put in my cart.
- As a household member, I want to see list changes made by my housemate update in real time so that we don't accidentally duplicate or undo each other's actions.
- As a household member, I want to sign in with Google so that I don't need to manage a separate password.
- As a household member, I want to create and maintain the household's staples list (name, quantity, interval) so that the app knows what to add to the shopping list automatically.
- As a household member, I want to invite another person to my household by email so that we share a single list.
- As an invited member, I want to accept a household invite so that my account joins the inviting household, with my existing staples and shopping list items appended to theirs.
- As a household member, I want to leave a household so that I can start fresh or join a different one, taking a copy of the shared lists with me.

### Edge Cases

- As a household member, I want to see an item that was auto-promoted from a staple clearly linked to that staple so that I understand why it appeared.
- As a household member, I want items I skip (remove without purchasing) to still reset the staple's timer so that the list doesn't immediately re-add them next cycle.
- As a household member, I want the app to work correctly on my phone's browser so that I can check things off while walking around a shop.

---

## Requirements

### Must-Have (P0)

**Staples management**
- Members can create a staple with: name (text), quantity (free text, e.g. "2L", "1 pack"), and interval in days.
- Members can edit or delete a staple.
- Acceptance criteria:
  - [ ] Staple form validates that name and interval are present
  - [ ] Quantity field accepts any free text (no unit enforcement)
  - [ ] Deleting a staple does not remove any current shopping list item derived from it

**Automatic staple promotion**
- A cron job runs periodically and adds eligible staples to the household's shopping list.
- Promotion trigger: `last_purchased_at + (interval × 2/3)` has passed.
- The same rule applies whether the item was purchased or skipped last cycle.
- Staples are copied (not referenced) onto the shopping list; subsequent edits to the staple do not affect the current cycle's item.
- Acceptance criteria:
  - [ ] Items appear on the shopping list at the correct time relative to their interval
  - [ ] A staple that has never been purchased is promoted `interval × 2/3` days after it was created
  - [ ] Editing a staple after promotion does not change the already-promoted shopping list item

**Shopping list review**
- Auto-promoted items arrive with status `needs_review`.
- Members can confirm an item (status → `confirmed`) or remove it for this cycle.
- Members can add one-off items directly; these arrive as `confirmed` with no associated staple.
- Acceptance criteria:
  - [ ] `needs_review` items are visually distinguished from `confirmed` items
  - [ ] Removing an item for this cycle does not delete the underlying staple
  - [ ] Removing a staple-linked item resets the staple's `next_add_at` to `now + (interval × 2/3)`, the same rule as a purchase
  - [ ] One-off items have no interval or staple association

**Shopping (check-off)**
- Members can mark an item as purchased.
- On purchase, the staple's `next_add_at` resets based on the interval.
- Purchased items are cleared from the active list.
- Acceptance criteria:
  - [ ] Checking off a staple-linked item resets the staple timer
  - [ ] Checking off a one-off item simply removes it with no side effects
  - [ ] Purchased items do not reappear on the list until the interval elapses

**Real-time sync**
- An SSE connection is opened per household on page load.
- All writes (any member, any action) broadcast an event; all connected clients update without a manual refresh.
- Acceptance criteria:
  - [ ] Two browser tabs logged in as different household members both reflect a change within ~1 second
  - [ ] Reconnection is handled gracefully if the SSE connection drops

**Authentication**
- Google OAuth is the sole sign-in method (no passwords).
- Acceptance criteria:
  - [ ] Users can sign in and sign out via Google
  - [ ] A user without an account is automatically provisioned on first sign-in
  - [ ] Unauthenticated requests to protected routes are redirected to sign-in

**Household management**
- A new user is automatically placed in their own household on first sign-in.
- A member can invite another user by email.
- Invited users see a pending invite on sign-in and can accept it.
- Accepting merges the accepting user's existing list into the inviting household's list.
- A member can leave a household; leaving creates a new personal household with a copy of the shared lists.
- Acceptance criteria:
  - [ ] Inviting a user who is already a member of a different household sends a pending invite (does not auto-move them)
  - [ ] Accepting an invite moves the user into the new household
  - [ ] After leaving, the departing member's new household contains copies of both lists; the original household is unchanged

---

### Nice-to-Have (P1)

- **In-cart state + complete shopping button** — add an `in_cart` status between `confirmed` and `purchased`. Members tap items to move them to `in_cart` while walking the aisles, then tap "Complete shopping" to batch-transition all `in_cart` items to `purchased` and reset their staple timers. This gives a clearer "I'm done" moment and avoids the current model where items sit as `purchased` until the next cron run cleans them up.
- **Staple ordering** — members can reorder staples manually so the shopping list reflects the layout of their usual store.
- **Bulk confirm** — a "confirm all" button to approve all `needs_review` items at once for weeks when nothing has changed.
- **Item notes** — optional free-text note on a shopping list item (e.g. "check sell-by date", "get the large size").
- **Invite by link** — generate a shareable invite link as an alternative to email-based invites.

---

### Future Considerations (P2)

These are explicitly out of scope for v1 but should be kept in mind when making architectural decisions:

- **Purchase history** — the schema should not preclude storing historical `shopping_list_items` rows; avoid hard deletes if possible.
- **Smart suggestions** — auto-promoting items to staples based on one-off purchase frequency would require a history of one-off items.
- **Multiple households** — the memberships table already supports this pattern; the constraint is a product/UX decision, not a schema one.
- **Push notifications** — the SSE infrastructure could be extended or replaced with a push notification service later.

---

## Success Metrics

Since this is a learning project, success is defined primarily by completeness and correctness rather than user growth. However, the following metrics confirm the app works as intended:

**Leading indicators (verifiable immediately after launch)**

| Metric | Target |
|---|---|
| End-to-end workflow completable | All core workflows (add staple → promotion → review → shop) complete without errors |
| Real-time sync latency | Updates visible to a second connected client within 2 seconds |
| Cron promotion accuracy | Staples promoted within one cron interval of their calculated trigger time |
| Mobile usability | All workflows completable on a 375px-wide viewport without horizontal scroll |

**Lagging indicators (verifiable after a few weeks of real use)**

| Metric | Target |
|---|---|
| Weekly list prep time | Subjectively faster than manual list-building |
| Forgotten staples | Zero cases of a staple being missed due to a missing auto-promotion |
| App reliability | No data loss incidents; SSE reconnects cleanly after network interruption |

---

## Design Decisions (Resolved)

1. **Staple deletion does not affect shopping list items** — shopping list items reference a `staple_id` but are treated as independent copies. Deleting or editing a staple has no effect on any item already on the shopping list.

2. **Cron frequency** — hourly. Revisit if promotion lag feels noticeable in practice.

3. **Invite acceptance merges both lists** — when a user accepts an invite, their staples and shopping list items are appended to the household's lists with no deduplication. The invitee's original household is then deleted. This prevents data loss (e.g. someone who built a partial staples list before being invited by their spouse) while keeping the merge logic simple.

4. **Concurrent edits** — last-write-wins via SSE is acceptable. All CRUD operations use item IDs, so two members deleting the same item results in one success and one no-op, with no data corruption.

5. **Cron idempotency** — the cron job runs in two passes: first it deletes all items with status `purchased`, then it promotes eligible staples. Idempotency check for promotion: if an item with that `staple_id` already exists in `needs_review` or `confirmed` status, skip it. Because purchased items are cleared in the same job run before promotion is evaluated, there is no risk of a recently-purchased staple blocking its own re-promotion.

---

## Timeline Considerations

This is a personal learning project with no external deadlines or dependencies. Suggested phasing:

**Phase 1 — Core data model & auth scaffolding**  
Set up Postgres schema, FastAPI app, session handling, and household creation. Implement a dev-only login bypass (`/dev/login?email=...`, disabled outside `ENV=development`) so all endpoints can be tested without a browser. No real Google OAuth yet; verify with API tests using the bypass.

**Phase 2 — Staples & promotion**  
Implement staples CRUD and the cron job for promotion. Verify promotion timing logic with unit tests.

**Phase 3 — Shopping list UI & real auth**  
Build the Next.js frontend: list review, confirm/remove, add one-offs, check-off. Wire up real Google OAuth in this phase — the callback handler is straightforward to unit test, and the full browser redirect flow can be manually verified once there's a UI to land on.

**Phase 4 — Real-time sync**  
Add SSE endpoint and wire up the frontend to consume events and update state.

**Phase 5 — Household management**  
Invite flow, accept/merge logic, leave household.

**Phase 6 — Deploy & polish**  
Railway deployment, mobile responsiveness, error handling, empty states.
