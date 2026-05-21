from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    APP_NAME: str = "OA System"
    DEBUG: bool = True

    DATABASE_URL: str = "postgresql+asyncpg://oa:oa_secret@localhost:5432/oa_db"
    REDIS_URL: str = "redis://localhost:6379/0"

    SECRET_KEY: str = "super-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    STORAGE_BACKEND: str = "local"
    UPLOAD_DIR: str = "./uploads"


settings = Settings()
