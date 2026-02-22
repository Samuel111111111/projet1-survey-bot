"""
Survey Bot backend package.

This module defines the application factory and registers all extensions,
blueprints and other components. Using a factory pattern makes it easy
to create multiple instances of the application with different
configurations (e.g. for testing).
"""

from __future__ import annotations

import os
from flask import Flask

from .config import config_by_name
from .extensions import db, migrate, jwt, cors
from .routes import register_blueprints
from .utils.seed import seed_admin  # import seed helper


def create_app(config_name: str = "default") -> Flask:
    """Application factory used by flask command line and gunicorn.

    Args:
        config_name: The configuration profile to use. Must be a key in
            ``config_by_name``. Defaults to "default".

    Returns:
        A fully configured ``Flask`` application instance.
    """
    app = Flask(__name__)

    # Load configuration. If an unknown config name is provided, fall back to
    # "default" rather than raising an exception.
    configuration_class = config_by_name.get(config_name, config_by_name["default"])
    app.config.from_object(configuration_class())

    # Initialise extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    # Configure CORS based on configuration
    origins_config = app.config.get("CORS_ORIGINS", "*")
    if origins_config == "*":
        origins = "*"
    else:
        origins = [o.strip() for o in origins_config.split(",") if o.strip()]
    cors.init_app(
        app,
        resources={r"/*": {"origins": origins}},
        supports_credentials=app.config.get("CORS_SUPPORTS_CREDENTIALS", True),
        allow_headers=app.config.get("CORS_ALLOW_HEADERS", ["Content-Type", "Authorization"]),
    )

    # Register blueprints
    register_blueprints(app)

    # Create all tables automatically on startup.  This avoids the need to
    # manually run Alembic migrations when deploying a fresh environment.  If
    # the tables already exist, create_all() is a no-op.  After creating the
    # tables, seed an admin user if none exists.  This runs only once on
    # startup.  Note: running Alembic migrations is still supported, but
    # calling create_all() ensures the database schema is present even if
    # migration scripts are missing.
    with app.app_context():
        # Automatically create all database tables defined in models.py
        db.create_all()

        # Lightweight schema patching (development-friendly).
        # If the DB volume already exists, create_all() won't add new columns.
        # We add missing columns with safe ALTERs to avoid manual migrations.
        try:
            # MySQL: add preferred_chart_type to questions if missing
            db.session.execute(
                """
                ALTER TABLE questions
                ADD COLUMN preferred_chart_type VARCHAR(20) NULL
                """
            )
            db.session.commit()
        except Exception:
            # Ignore if the column already exists or if the dialect doesn't support this statement.
            db.session.rollback()

        seed_admin()

    @app.route("/")
    def health_check():
        """Simple health check endpoint for load balancers and uptime checks."""
        return {"status": "ok", "message": "Survey Bot API is running"}

    return app