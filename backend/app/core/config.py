from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    redis_url: str
    groq_api_key: str
    jwt_secret: str
    jwt_expire_minutes: int = 60

    class Config:
        env_file = ".env"


settings = Settings()
