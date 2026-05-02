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

Copy the example environment if you want a local `.env` file:

```sh
cp .env.example .env
```

The default local URLs are:

```sh
DATABASE_URL=postgresql+psycopg://shopping_list:CHANGE_ME@localhost:5432/shopping_list
TEST_DATABASE_URL=postgresql+psycopg://shopping_list:CHANGE_ME@localhost:5432/shopping_list_test
```

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

The tests reset and migrate the `shopping_list_test` database.
