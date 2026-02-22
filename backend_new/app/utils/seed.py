"""
Utilities for seeding initial application data.

This module contains helper functions used during application startup to
initialise default data such as an administrator account. Seeding is
performed once at application startup from within the app factory.
"""

from __future__ import annotations

import os
from typing import Optional
from werkzeug.security import generate_password_hash

from ..extensions import db
from ..models import User
from sqlalchemy import inspect


def seed_admin() -> None:
    """Ensure that at least one administrator user exists.

    This function checks whether any user with a role of 'admin' exists in
    the database. If not, it creates an admin user using credentials
    defined in environment variables. The following environment variables
    control the seed user:

    - ``ADMIN_LOGIN``: username for the admin (default: "admin")
    - ``ADMIN_PASSWORD``: password for the admin (default: "admin123")
    - ``ADMIN_ROLE``: role name (default: "admin")

    If an admin already exists, the function does nothing. If the
    underlying database tables do not yet exist (e.g. before migrations
    have run), the function will silently return to avoid raising errors.
    """
    try:
        # If the users table does not exist yet (e.g. migrations have not
        # created it), skip seeding to avoid exceptions during app startup.
        inspector = inspect(db.engine)
        if "users" not in inspector.get_table_names():
            return
    except Exception:
        # In case the engine is not ready, just skip seeding.
        return

    # If there is already an admin user, do nothing
    existing_admin = User.query.filter_by(role="admin").first()
    if existing_admin:
        return

    login = os.getenv("ADMIN_LOGIN", "admin")
    password = os.getenv("ADMIN_PASSWORD", "admin123")
    role = os.getenv("ADMIN_ROLE", "admin")

    # Check again that no user with this login exists (in case of non-admin
    # roles). If a user with the login exists but is not admin, we leave
    # them unchanged because we don't know whether to override their role.
    user = User.query.filter_by(login=login).first()
    if user:
        return

    # Create the user
    password_hash = generate_password_hash(password)
    new_user = User(login=login, password_hash=password_hash, role=role)
    db.session.add(new_user)
    db.session.commit()