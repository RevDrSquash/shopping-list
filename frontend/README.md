# Shopping List Frontend

Next.js frontend for the shopping list and staples UI.

## Setup

Install dependencies from this directory:

```sh
npm install
```

Run the development server:

```sh
npm run dev
```

The Next.js dev server runs on `http://localhost:3000`, but local browser traffic should go through the Nginx edge proxy at `http://localhost:8080`.

## API Configuration

By default, browser requests use `NEXT_PUBLIC_API_BASE_URL=/api`. The local Nginx edge proxy forwards `/api/*` to the FastAPI backend at `http://localhost:8000`, which keeps the backend session cookie on the same browser origin during local development.

To bypass the proxy and call an API base URL directly from the browser, set:

```sh
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Direct cross-origin browser calls require the backend to allow CORS credentials.

## Real-Time Sync

Signed-in browser sessions open a Server-Sent Events connection to:

```txt
GET /events
```

With the default local setup, the browser connects through `NEXT_PUBLIC_API_BASE_URL=/api`, so the effective frontend URL is `/api/events` and Nginx forwards it to the FastAPI backend. The EventSource is opened with credentials so the backend receives the same session cookie used by `/me`, `/shopping-list`, and `/staples`.

When the backend sends an SSE message with `{ "type": "household_changed" }`, the frontend refetches the authoritative shopping list and staples data. Local mutations still refresh immediately after their API call succeeds, so the originating tab may perform one extra refetch after receiving its own SSE broadcast.

Current limitations:

- Real-time broadcasts are in-process on the API service. Multiple API replicas or separate cron processes need a shared broker before they can broadcast across processes.
- The frontend refetches full household state instead of applying event patches.
- Browser EventSource reconnection is used as-is; there is no custom backoff or offline banner yet.

## Authentication

When `/me` returns unauthenticated, the app fetches `GET /config` and renders the sign-in card based on the result:

- If `google_oauth_enabled` is true, a "Sign in with Google" link points the browser at `GET /api/auth/google/login`. The backend handles the OIDC redirect dance and sets a session cookie before redirecting back to `/`.
- If `dev_login_enabled` is true, a "Development bypass" form posts an email to `GET /dev/login?email=...` so local development and tests can skip the OAuth round-trip.

All frontend API calls include `credentials: "include"` so the session cookie is sent on later `/me`, shopping-list, and SSE requests regardless of how the session was started. A "Sign out" button in the header calls `POST /auth/logout` and reloads the session.

For Google OAuth setup (Cloud Console steps and env vars), see [../docs/google-oauth.md](../docs/google-oauth.md).

## Tests

Run lightweight UI tests:

```sh
npm test
```

The tests cover the sign-in card (Google button plus optional development bypass form), one-off item form, staples management form, review-all staples action, grouped shopping-list actions for confirm, skip, and purchase, and the EventSource subscription behavior.

## Staples Management

Signed-in users can manage recurring household staples from the main page:

- Add a staple with a name, free-text quantity, and interval in days.
- Edit or delete existing staples.
- See the next automatic review date derived from the staple interval.
- Click **Review all staples now** to add every staple without an active shopping-list item to the `Needs review` section immediately.

The review-all action is a normal user workflow. It skips the usual `eligible_at` timing check, but still avoids duplicates for staples that already have active `needs_review` or `confirmed` shopping-list items.

## Manual Verification

From the project root, start Postgres and the Nginx edge proxy:

```sh
docker compose up -d postgres edge
```

From `backend/`, install dependencies, migrate, and start the API:

```sh
poetry install
poetry run alembic upgrade head
poetry run uvicorn app.main:app --reload
```

From `frontend/`, install dependencies and start the frontend:

```sh
npm install
npm run dev
```

Open `http://localhost:8080`, sign in (Google when configured, otherwise the development bypass form), and verify:

- Unauthenticated users see the sign-in card with the Google button and/or the development bypass form, depending on `/config`.
- A staple can be added, edited, and deleted from the staples section.
- Review all staples now adds inactive staples to the `Needs review` section without waiting for the interval.
- A one-off item can be added and appears in the confirmed section.
- Promoted `needs_review` items appear separately from confirmed items.
- Confirm moves a promoted item into the confirmed section after refresh.
- Skip removes a promoted item from the active list.
- Purchased removes a confirmed item from the active list.
- The layout remains usable at a narrow mobile width.

For real-time sync, open two browser tabs signed in as the same development user, or as users that belong to the same household. Add a one-off item, create or edit a staple, confirm, skip, or purchase an item in one tab and verify the other tab updates within about one second without pressing **Refresh**. Then reload or close one tab and reopen it to confirm the EventSource reconnects cleanly.

To test scheduled promotion separately, seed staples through the backend API and run:

```sh
poetry run python -m app.jobs.promote_staples
```

## Railway Edge Service

Railway should run three services:

- `frontend`: the Next.js app.
- `backend`: the FastAPI API.
- `edge`: Nginx, using `nginx/default.conf.template`, attached to the public domain.

Set these variables on the Railway `edge` service:

- `PORT=$PORT`
- `BACKEND_HOST=backend.railway.internal:8000`
- `FRONTEND_HOST=frontend.railway.internal:3000`

The same template is used locally and on Railway. Only the upstream hostnames and listen port change by environment.
