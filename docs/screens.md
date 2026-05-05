# Household Shopping List — Screen Spec

A reference for the screens needed in the app. Intended as a prompt guide for generating initial designs in Google Stitch.

---

## 1. Sign-In Screen

**Purpose:** The only entry point for unauthenticated users.

**Key requirements:**
- Single "Sign in with Google" button — no other auth methods
- On success, redirect to the Shopping List screen
- First-time users are automatically provisioned (no separate sign-up step)

---

## 2. Shopping List Screen *(main/home screen)*

**Purpose:** The primary daily-use screen. Shows the household's current shopping list and supports the full review-and-shop workflow.

**Key requirements:**
- Single unified list — `needs_review` and `confirmed` items are not split into separate sections
- `needs_review` items are visually distinct (e.g. muted outline card vs. solid card) but not alarming — they're pending attention, not errors
- Items are as compact as possible, ideally one line each
- Real-time updates via SSE — changes from other household members appear without refreshing
- Mobile-first: all interactions must work comfortably on a 375px viewport
- "Add item" button that opens the add one-off item modal (see below)

**Item row interactions:**

| Interaction | `needs_review` item | `confirmed` / one-off item |
|---|---|---|
| Tap row | Confirm → status becomes `confirmed` | No effect |
| Checkbox (right edge) | Mark as purchased (skips confirm step) | Mark as purchased |
| Swipe left | Remove for this cycle | Remove for this cycle |

- Swipe-left reveals a remove affordance (consistent for both item types)
- The checkbox is the only persistent visible control on each row — no other action buttons in the default state
- Touch target sizing for the checkbox should be generous given it sits near the confirm tap zone; consider a visual confirmation animation on state change to reduce accidental mis-taps
- Swipe-to-remove should have a fallback for discoverability (e.g. a first-use hint or long-press context menu)

### Add One-Off Item Modal

**Purpose:** Lightweight form for adding items that aren't staples. Triggered by the "Add item" button on the Shopping List screen.

**Key requirements:**
- Name field (required)
- Quantity field (optional, free text — e.g. "2L", "1 pack")
- Submitted items go straight to `confirmed` status with no staple association

---

## 3. Staples Screen

**Purpose:** Lets members manage the household's recurring staples — the items that get auto-promoted to the shopping list each cycle.

**Key requirements:**
- Lists all staples with name, quantity, and interval displayed
- "Add staple" button that opens the add/edit modal (see below)
- Edit and delete actions per staple row; edit opens the same modal pre-populated
- Deleting a staple does not affect any item already on the shopping list

### Add / Edit Staple Modal

**Purpose:** Form for creating or editing a staple. Triggered by the "Add staple" button or an edit action on an existing row.

**Key requirements:**
- Name (required)
- Quantity (free text, optional)
- Interval in days (required)
- Validation: name and interval must be present before saving

---

## 4. Household Settings Screen

**Purpose:** Manages household membership. Accessed via a settings icon — low-frequency screen.

**Key requirements:**
- Shows current household members
- Invite-by-email form
- "Leave household" option with a clear warning: the user will be moved into a new personal household containing copies of the shared lists

---

## 6. Pending Invite Screen

**Purpose:** Shown immediately after sign-in when the authenticated user has an outstanding household invite. Blocks access to the main app until the user responds.

**Key requirements:**
- Shows who sent the invite (name / email)
- Accept button — merges the user's existing staples and shopping list items into the inviting household
- Decline / ignore option
- Accepting moves the user into the new household; their original household is removed
