"""Application settings, loaded from environment (.env — never committed)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Google Cloud
    gcp_project_id: str = "gemini-enterprise-475109"
    gcp_region: str = "asia-south1"

    # Vertex AI / Gemini
    vertex_location: str = "asia-south1"
    gemini_model: str = "gemini-2.5-flash"
    gemini_api_key: str = ""

    # Data stores
    bq_dataset: str = "constituency"
    firestore_collection: str = "submissions"

    # Demo constituency
    constituency: str = "Coimbatore"

    # External keys (optional at boot; features degrade if absent)
    maps_api_key: str = ""
    telegram_bot_token: str = ""
    data_gov_in_api_key: str = ""


settings = Settings()
