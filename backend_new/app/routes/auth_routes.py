"""
Authentication routes for the Survey Bot API.

Provides endpoints for user registration, login, and retrieving the
current user's information. Uses JWT for stateless authentication.
"""

from __future__ import annotations

from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
)

from uuid import uuid4

from ..extensions import db
from ..models import User, AuditLog


auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
def register() -> tuple:
    """Register a new user.

    Expected JSON payload:
    {
        "login": "username",
        "password": "plainpassword",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com"
    }
    The registration process now requires an email address and will
    generate a verification code. The returned response includes the
    verification code for testing purposes. In a production setting,
    this code should be sent via email to the user.
    """
    data = request.get_json() or {}
    login = data.get("login")
    password = data.get("password")
    # Role is assigned by the system. Only an admin can promote others.
    role = "viewer"
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    email = data.get("email")

    # Basic validation
    if not login or not password or not email:
        return {"error": "login, password and email are required"}, 400

    # Ensure login and email are unique
    if User.query.filter_by(login=login).first():
        return {"error": "User already exists with this login"}, 409
    if User.query.filter_by(email=email).first():
        return {"error": "User already exists with this email"}, 409

    password_hash = generate_password_hash(password)
    # Bootstrap: if there is no admin yet (fresh install), the first account becomes admin.
    if User.query.filter_by(role="admin").count() == 0 and User.query.count() == 0:
        role = "admin"

    verification_code = uuid4().hex[:6]  # Short code for email verification
    user = User(
        login=login,
        password_hash=password_hash,
        role=role,
        first_name=first_name,
        last_name=last_name,
        email=email,
        email_verified=False,
        verification_code=verification_code,
    )
    db.session.add(user)
    db.session.commit()

    # Audit log entry
    log = AuditLog(user_id=user.id, action="register", details=f"Role: {role}")
    db.session.add(log)
    db.session.commit()

    return {
        "message": "User created. A verification code has been generated.",
        "user_id": user.id,
        "verification_code": verification_code,
    }, 201


@auth_bp.route("/login", methods=["POST"])
def login() -> tuple:
    """Authenticate a user and return access and refresh tokens."""
    data = request.get_json() or {}
    login = data.get("login")
    password = data.get("password")

    if not login or not password:
        return {"error": "login and password are required"}, 400

    user = User.query.filter_by(login=login).first()
    # Validate credentials
    if not user or not check_password_hash(user.password_hash, password):
        return {"error": "Invalid credentials"}, 401

    # Ensure the user's email is verified before allowing login
    if user.email and not user.email_verified:
        return {"error": "Email not verified"}, 403

    access_token = create_access_token(identity=str(user.id), additional_claims={"role": user.role})
    refresh_token = create_refresh_token(identity=str(user.id), additional_claims={"role": user.role})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": user.id,
            "login": user.login,
            "role": user.role,
        },
    }, 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user() -> tuple:
    """Return the current user's information based on the JWT."""
    user_id = get_jwt_identity()
    user = User.query.get_or_404(user_id)
    return {
        "id": user.id,
        "login": user.login,
        "role": user.role,
    }, 200


# ---------------------------------------------------------------------------
# Additional endpoints for email verification and password reset
# ---------------------------------------------------------------------------


@auth_bp.route("/verify", methods=["POST"])
def verify_email() -> tuple:
    """Verify a user's email address using a verification code."""
    data = request.get_json() or {}
    email = data.get("email")
    code = data.get("verification_code")
    if not email or not code:
        return {"error": "email and verification_code are required"}, 400
    user = User.query.filter_by(email=email).first()
    if not user or user.verification_code != code:
        return {"error": "Invalid email or verification code"}, 400
    user.email_verified = True
    user.verification_code = None
    db.session.commit()
    return {"message": "Email verified"}, 200


@auth_bp.route("/reset_password/request", methods=["POST"])
def request_reset_password() -> tuple:
    """Generate a password reset token for a user identified by email."""
    data = request.get_json() or {}
    email = data.get("email")
    if not email:
        return {"error": "email is required"}, 400
    user = User.query.filter_by(email=email).first()
    if not user:
        # Do not reveal whether the email exists to avoid account enumeration
        return {"message": "If an account with that email exists, a reset token has been generated."}, 200
    token = uuid4().hex
    user.reset_password_token = token
    db.session.commit()
    # In a real application, you would send this token via email. For testing
    # purposes, we return it in the response.
    return {"message": "Reset token generated", "token": token}, 200


@auth_bp.route("/reset_password", methods=["POST"])
def reset_password() -> tuple:
    """Reset a user's password using the reset token."""
    data = request.get_json() or {}
    email = data.get("email")
    token = data.get("token")
    new_password = data.get("new_password")
    if not email or not token or not new_password:
        return {"error": "email, token and new_password are required"}, 400
    user = User.query.filter_by(email=email).first()
    if not user or user.reset_password_token != token:
        return {"error": "Invalid email or reset token"}, 400
    user.password_hash = generate_password_hash(new_password)
    user.reset_password_token = None
    db.session.commit()
    return {"message": "Password reset successful"}, 200