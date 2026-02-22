"""
Application configuration classes for different environments.

Configurations are loaded based on the ``FLASK_CONFIG`` environment
variable. Environment variables override default values where
appropriate. You can extend or modify these classes to suit your
deployment needs.
"""

from __future__ import annotations

import os
from datetime import timedelta


class BaseConfig:
    """Base configuration with sensible defaults.

    Configuration values are read from environment variables when available.
    This allows external configuration via a `.env` file or Docker secrets.
    """

    # Flask settings
    SECRET_KEY = os.getenv("SECRET_KEY", "change-this-in-production")
    JSON_SORT_KEYS = False
    PROPAGATE_EXCEPTIONS = True

    # SQLAlchemy settings
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URI",
        # Default to SQLite for local development if no DATABASE_URI provided
        "sqlite:///survey_bot.db",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT settings
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "super-secret-key-change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.getenv("JWT_ACCESS_TOKEN_HOURS", 1)))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.getenv("JWT_REFRESH_TOKEN_DAYS", 30)))

    # CORS settings: comma-separated list of allowed origins. Use '*' for any.
    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
    # Comma separated headers to allow (default to Content-Type and Authorization)
    CORS_ALLOW_HEADERS = [h.strip() for h in os.getenv("CORS_ALLOW_HEADERS", "Content-Type,Authorization").split(",")]
    # Whether to set Access-Control-Allow-Credentials: true
    CORS_SUPPORTS_CREDENTIALS = os.getenv("CORS_SUPPORTS_CREDENTIALS", "true").lower() in {"1", "true", "yes"}

    # Public frontend URL: if set, used to build survey links and QR codes
    PUBLIC_FRONTEND_URL = os.getenv("PUBLIC_FRONTEND_URL")


class DevelopmentConfig(BaseConfig):
    DEBUG = True


class ProductionConfig(BaseConfig):
    DEBUG = False
    # In production, you should override DATABASE_URI and SECRET_KEY via
    # environment variables or a secrets manager.


class TestingConfig(BaseConfig):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=5)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(minutes=15)


# Mapping of configuration names to configuration classes. This dictionary is
# intentionally defined at module scope so that it can be imported and used
# directly without calling a function. Valid keys include "default",
# "development", "production" and "testing".
config_by_name: dict[str, type[BaseConfig]] = {
    "default": DevelopmentConfig,
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}