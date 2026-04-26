# Shopping List Frontend

Next.js frontend for the Phase 3 shopping list and staples UI.

## Setup

Install dependencies from this directory:

```sh
npm install
```

Run the development server:

```sh
npm run dev
```

The app runs on `http://localhost:3000`.

## API Configuration

By default, browser requests use `NEXT_PUBLIC_API_BASE_URL=/api`. `next.config.ts` proxies `/api/*` to the FastAPI backend at `http://localhost:8000`, which keeps the backend session cookie on the same browser origin during local development.

To point the proxy at a different backend URL, set:

```sh
API_PROXY_TARGET=http://localhost:8000
```

To bypass the proxy and call an API base URL directly from the browser, set:

```sh
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Direct cross-origin browser calls require the backend to allow CORS credentials.

## Development Auth

Phase 3 uses the backend development login endpoint instead of Google OAuth. When `/me` returns unauthenticated, the app shows an email form that calls:

```txt
GET /dev/login?email=person@example.com
```

The backend creates or reuses the user, attaches a household membership, and sets the session cookie. All frontend API calls include `credentials: "include"` so the session is sent on later `/me` and shopping-list requests.

## Tests

Run lightweight UI tests:

```sh
npm test
```

The tests cover the development login form, one-off item form, staples management form, review-all staples action, and the grouped shopping-list actions for confirm, skip, and purchase.

## Staples Management

Signed-in users can manage recurring household staples from the main page:

- Add a staple with a name, free-text quantity, and interval in days.
- Edit or delete existing staples.
- See the next automatic review date derived from the staple interval.
- Click **Review all staples now** to add every staple without an active shopping-list item to the `Needs review` section immediately.

The review-all action is a normal user workflow. It skips the usual `eligible_at` timing check, but still avoids duplicates for staples that already have active `needs_review` or `confirmed` shopping-list items.

## Phase 3 Manual Verification

From the project root, start Postgres:

```sh
docker compose up -d postgres
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

Open `http://localhost:3000`, sign in with the dev auth form, and verify:

- Unauthenticated users see the development login form.
- A staple can be added, edited, and deleted from the staples section.
- Review all staples now adds inactive staples to the `Needs review` section without waiting for the interval.
- A one-off item can be added and appears in the confirmed section.
- Promoted `needs_review` items appear separately from confirmed items.
- Confirm moves a promoted item into the confirmed section after refresh.
- Skip removes a promoted item from the active list.
- Purchased removes a confirmed item from the active list.
- The layout remains usable at a narrow mobile width.

To test scheduled promotion separately, seed staples through the backend API and run:

```sh
poetry run python -m app.jobs.promote_staples
```
