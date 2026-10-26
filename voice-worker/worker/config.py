from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openrouter_api_key: str = ""
    sarvam_api_key: str = ""
    elevenlabs_api_key: str = ""
    voicelink_api_token: str = ""

    supabase_url: str = "http://localhost:8001"
    supabase_service_role_key: str = ""

    ws_token: str = ""


settings = Settings()
