"""
Security helpers including a decorator for role-based access control.

The ``role_required`` decorator ensures that the current JWT has one
of the allowed roles before executing the wrapped view function.
"""

from __future__ import annotations

from functools import wraps
from typing import Callable, Any
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt


def role_required(*allowed_roles: str) -> Callable:
    """Restrict access to users whose JWT includes an allowed role.

    Args:
        *allowed_roles: A list of roles that are permitted to access the
            decorated endpoint.

    Returns:
        A decorator that verifies the user's role before calling the
        wrapped function. If the role is not allowed, returns a 403
        response.
    """

    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            # Ensure a valid JWT is present
            verify_jwt_in_request()
            claims = get_jwt()
            user_role = claims.get("role")
            if user_role not in allowed_roles:
                return (
                    jsonify({
                        "error": "Access forbidden",
                        "allowed_roles": allowed_roles,
                        "your_role": user_role,
                    }),
                    403,
                )
            return fn(*args, **kwargs)

        return wrapper

    return decorator