from typing import Optional

from fastapi import FastAPI
from starlette.middleware.sessions import SessionMiddleware

from app.api.routes import router
from app.core.config import Settings, get_settings
from app.services.google_oauth import register_google_oauth


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    app_settings = settings or get_settings()
    if app_settings.google_oauth_enabled:
        register_google_oauth(app_settings)

    app = FastAPI(title="Household Shopping List API")
    app.add_middleware(
        SessionMiddleware,
        secret_key=app_settings.session_secret,
        same_site="lax",
        https_only=app_settings.env == "production",
    )
    app.include_router(router)
    return app


app = create_app()
