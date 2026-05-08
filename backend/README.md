# Shopping List Backend

FastAPI backend for the household shopping list app.

## Local Setup

Start Postgres from the project root:

```sh
docker compose up -d postgres
```

Install dependencies from this directory:

```sh
poetry install
```

Copy the root example environment if you want a local `.env` file:

```sh
cp ../.env.example ../.env
```

The root `.env` is the single local environment file for Docker Compose and the backend. The example derives the backend database URLs from the Postgres components:

```sh
DATABASE_URL=postgresql+psycopg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}
TEST_DATABASE_URL=postgresql+psycopg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_TEST_DB}
```

If you already have values in `backend/.env`, migrate them into the root `.env` and delete the backend copy. Keep `POSTGRES_TEST_DB=shopping_list_test` unless you also update `docker/postgres/init-test-db.sql`, which creates the test database.

## Database

Run migrations:

```sh
poetry run alembic upgrade head
```

## Development Server

Run the API locally:

```sh
poetry run uvicorn app.main:app --reload
```

Useful endpoints:

- `GET /health`
- `GET /config`
- `GET /me`
- `GET /staples`
- `POST /staples`
- `PATCH /staples/{staple_id}`
- `DELETE /staples/{staple_id}`
- `GET /auth/google/login`
- `GET /auth/google/callback`
- `POST /auth/logout`
- `GET /dev/login?email=person@example.com`

`/dev/login` only works when `ENV` is `development` or `test`. Google sign-in is configured separately — see [docs/google-oauth.md](../docs/google-oauth.md) for Cloud Console setup, env vars, and a description of each `/auth/*` route.

## Staple Promotion

Run the short-lived promotion job locally:

```sh
poetry run python -m app.jobs.promote_staples
```

The command promotes due staples into `shopping_list_items`, prints a small summary, closes database connections, and exits. Railway can run the same command later as a cron service.

## Tests

With Docker Postgres running:

```sh
ENV=test poetry run pytest
```

The tests reset and migrate the `shopping_list_test` database. They require the root `.env`, or exported `DATABASE_URL` and `TEST_DATABASE_URL` environment variables, so the backend knows how to reach Postgres.
