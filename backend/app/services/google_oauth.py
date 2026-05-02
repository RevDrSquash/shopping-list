from authlib.integrations.starlette_client import OAuth

from app.core.config import Settings


oauth = OAuth()


def register_google_oauth(settings: Settings) -> None:
    if "google" in getattr(oauth, "_registry", {}):
        return

    oauth.register(
        name="google",
        client_id=settings.google_oauth_client_id,
        client_secret=settings.google_oauth_client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={
            "scope": "openid email profile",
            "code_challenge_method": "S256",
        },
    )
