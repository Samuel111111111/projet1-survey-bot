"""
Blueprint registration for Survey Bot API endpoints.

This module collects and registers all Flask blueprints. New routes
should be added in their own modules within ``app.routes`` and imported
here for registration. Keeping blueprints separate promotes modularity
and maintainability.
"""

from __future__ import annotations

from flask import Flask

from .auth_routes import auth_bp
from .campaign_routes import campaigns_bp
from .question_routes import questions_bp
from .session_routes import sessions_bp
from .bot_routes import bot_bp
from .stats_routes import stats_bp
from .export_routes import export_bp
from .admin_routes import admin_bp


def register_blueprints(app: Flask) -> None:
    """Register all Flask blueprints with the application."""
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(campaigns_bp, url_prefix="/api/campaigns")
    app.register_blueprint(questions_bp, url_prefix="/api/campaigns")
    app.register_blueprint(sessions_bp, url_prefix="/api/campaigns")
    app.register_blueprint(bot_bp, url_prefix="/api/bot")
    app.register_blueprint(stats_bp, url_prefix="/api/campaigns")
    app.register_blueprint(export_bp, url_prefix="/api/export")
    app.register_blueprint(admin_bp, url_prefix="/api")