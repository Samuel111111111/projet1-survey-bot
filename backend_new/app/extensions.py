"""
Flask extensions initialised once and imported by the application factory.

Using a central module to instantiate extensions helps to avoid circular
import issues and makes it easy to manage extensions across the app.
"""

from __future__ import annotations

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from flask_cors import CORS


db: SQLAlchemy = SQLAlchemy()
migrate: Migrate = Migrate()
jwt: JWTManager = JWTManager()
cors: CORS = CORS()