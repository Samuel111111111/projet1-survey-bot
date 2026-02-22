from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from sqlalchemy import or_

from ..extensions import db
from ..models import AuditLog, Campaign, User, campaign_allowed_users
from ..utils.security import role_required

admin_bp = Blueprint("admin", __name__)


_CAMPAIGN_ID_RE = re.compile(r"campaign_id=(\d+)")


def _extract_campaign_id(details: Optional[str]) -> Optional[int]:
    if not details:
        return None
    m = _CAMPAIGN_ID_RE.search(details)
    if not m:
        return None
    try:
        return int(m.group(1))
    except Exception:
        return None


def _log(user_id: Optional[int], action: str, details: str = "") -> None:
    try:
        db.session.add(AuditLog(user_id=user_id, action=action, details=details))
        db.session.commit()
    except Exception:
        db.session.rollback()


# -------------------------
# Logs (global + per campaign)
# -------------------------

@admin_bp.get("/logs")
@jwt_required()
@role_required("admin")
def list_logs():
    """List audit logs.

    Query params:
      - campaign_id: optional, filter to logs whose details include campaign_id=...
      - q: optional, text search on action/details
      - limit: default 50, max 200
      - offset: default 0
    """
    campaign_id = request.args.get("campaign_id", type=int)
    q = (request.args.get("q") or "").strip()
    limit = min(request.args.get("limit", 50, type=int) or 50, 200)
    offset = max(request.args.get("offset", 0, type=int) or 0, 0)

    query = AuditLog.query

    if q:
        like = f"%{q}%"
        query = query.filter(or_(AuditLog.action.ilike(like), AuditLog.details.ilike(like)))

    logs = query.order_by(AuditLog.created_at.desc()).all()

    # campaign filter is done in python because campaign_id is inside details text
    if campaign_id is not None:
        logs = [l for l in logs if _extract_campaign_id(l.details) == campaign_id]

    total = len(logs)
    logs = logs[offset: offset + limit]

    # Preload users
    user_ids = sorted({l.user_id for l in logs if l.user_id is not None})
    users_by_id = {}
    if user_ids:
        for u in User.query.filter(User.id.in_(user_ids)).all():
            users_by_id[u.id] = {"id": u.id, "email": u.email, "login": u.login, "role": u.role}

    def serialize(l: AuditLog) -> dict:
        return {
            "id": l.id,
            "created_at": l.created_at.isoformat() if l.created_at else None,
            "action": l.action,
            "details": l.details,
            "campaign_id": _extract_campaign_id(l.details),
            "user": users_by_id.get(l.user_id) if l.user_id is not None else None,
        }

    return jsonify({"items": [serialize(l) for l in logs], "total": total, "limit": limit, "offset": offset})


@admin_bp.get("/campaigns/<int:campaign_id>/logs")
@jwt_required()
@role_required("admin")
def campaign_logs(campaign_id: int):
    """List logs related to a specific campaign."""
    q = (request.args.get("q") or "").strip()
    limit = min(request.args.get("limit", 200, type=int) or 200, 200)
    offset = max(request.args.get("offset", 0, type=int) or 0, 0)

    query = AuditLog.query
    if q:
        like = f"%{q}%"
        query = query.filter(or_(AuditLog.action.ilike(like), AuditLog.details.ilike(like)))

    logs = query.order_by(AuditLog.created_at.desc()).all()
    logs = [l for l in logs if _extract_campaign_id(l.details) == campaign_id]

    total = len(logs)
    logs = logs[offset: offset + limit]

    user_ids = sorted({l.user_id for l in logs if l.user_id is not None})
    users_by_id = {}
    if user_ids:
        for u in User.query.filter(User.id.in_(user_ids)).all():
            users_by_id[u.id] = {"id": u.id, "email": u.email, "login": u.login, "role": u.role}

    def serialize(l: AuditLog) -> dict:
        return {
            "id": l.id,
            "created_at": l.created_at.isoformat() if l.created_at else None,
            "action": l.action,
            "details": l.details,
            "campaign_id": _extract_campaign_id(l.details),
            "user": users_by_id.get(l.user_id) if l.user_id is not None else None,
        }

    return jsonify({"items": [serialize(l) for l in logs], "total": total, "limit": limit, "offset": offset})




# -------------------------
# Access control for private campaigns
# -------------------------

@admin_bp.get("/campaigns/<int:campaign_id>/allowed-users")
@jwt_required()
@role_required("admin")
def get_allowed_users(campaign_id: int):
    campaign = Campaign.query.get_or_404(campaign_id)

    # creator
    creator = None
    if campaign.creator_id:
        u = User.query.get(campaign.creator_id)
        if u:
            creator = {"id": u.id, "email": u.email, "login": u.login, "role": u.role}

    # allowed users from association table
    allowed = (
        db.session.query(User)
        .join(campaign_allowed_users, campaign_allowed_users.c.user_id == User.id)
        .filter(campaign_allowed_users.c.campaign_id == campaign_id)
        .order_by(User.email.asc())
        .all()
    )
    allowed_payload = [{"id": u.id, "email": u.email, "login": u.login, "role": u.role} for u in allowed]

    return jsonify({
        "campaign_id": campaign_id,
        "is_private": bool(campaign.is_private),
        "creator": creator,
        "allowed": allowed_payload,
    })


@admin_bp.put("/campaigns/<int:campaign_id>/allowed-users")
@jwt_required()
@role_required("admin", "campaign_manager")
def set_allowed_users(campaign_id: int):
    """Replace the allowed users list for a campaign.

    Body:
      { "emails": ["a@x.com", "b@x.com"] }
    """
    campaign = Campaign.query.get_or_404(campaign_id)
    data = request.get_json(silent=True) or {}
    emails = data.get("emails", [])
    if emails is None:
        emails = []
    if not isinstance(emails, list):
        return jsonify({"error": "emails must be a list"}), 400

    # Normalize
    emails = sorted({(e or "").strip().lower() for e in emails if (e or "").strip()})
    # Remove creator from allowed list if present
    if campaign.creator and campaign.creator.email:
        creator_email = campaign.creator.email.strip().lower()
        emails = [e for e in emails if e != creator_email]

    # If campaign isn't private, we still allow saving list but it doesn't affect visibility
    try:
        # Clear existing
        db.session.execute(
            campaign_allowed_users.delete().where(campaign_allowed_users.c.campaign_id == campaign_id)
        )
        # Add
        for email in emails:
            user = User.query.filter(User.email.ilike(email)).first()
            if not user:
                # Skip unknown emails (front can show warning)
                continue
            db.session.execute(
                campaign_allowed_users.insert().values(campaign_id=campaign_id, user_id=user.id)
            )
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "failed_to_update_allowed_users"}), 500

    user_id = int(get_jwt_identity())
    _log(user_id, "update_allowed_users", details=f"campaign_id={campaign_id}; count={len(emails)}")

    return get_allowed_users(campaign_id), 200


# -------------------------
# User management (admin only)
# -------------------------

@admin_bp.get("/admin/users")
@jwt_required()
@role_required("admin")
def list_users():
    """List users for admin management.

    Query params:
      - q: optional search by login/email/name
      - limit: default 50, max 200
      - offset: default 0
    """
    q = (request.args.get("q") or "").strip()
    limit = min(request.args.get("limit", 50, type=int) or 50, 200)
    offset = max(request.args.get("offset", 0, type=int) or 0, 0)

    query = User.query
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                User.login.ilike(like),
                User.email.ilike(like),
                User.first_name.ilike(like),
                User.last_name.ilike(like),
            )
        )

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()

    def serialize(u: User) -> dict:
        return {
            "id": u.id,
            "login": u.login,
            "email": u.email,
            "role": u.role,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "email_verified": bool(u.email_verified),
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }

    return jsonify({"items": [serialize(u) for u in users], "total": total, "limit": limit, "offset": offset})


@admin_bp.patch("/admin/users/<int:user_id>")
@jwt_required()
@role_required("admin")
def update_user_role(user_id: int):
    """Update a user's role. Only admins can promote someone to admin.

    Payload:
      { "role": "admin" | "campaign_manager" | "viewer" }
    """
    data = request.get_json() or {}
    new_role = (data.get("role") or "").strip()

    if new_role not in ("admin", "campaign_manager", "viewer"):
        return jsonify({"error": "Invalid role"}), 400

    current_user_id = get_jwt_identity()
    try:
        current_user_id_int = int(current_user_id)
    except Exception:
        current_user_id_int = None

    # Prevent changing your own role to avoid locking yourself out
    if current_user_id_int == user_id:
        return jsonify({"error": "You cannot change your own role."}), 400

    user = User.query.get_or_404(user_id)
    old_role = user.role

    # Prevent removing the last admin
    if old_role == "admin" and new_role != "admin":
        admins_count = User.query.filter_by(role="admin").count()
        if admins_count <= 1:
            return jsonify({"error": "Cannot remove the last admin."}), 400

    user.role = new_role
    db.session.commit()

    _log(current_user_id_int, "UPDATE_USER_ROLE", f"user_id={user.id} old_role={old_role} new_role={new_role}")
    return jsonify({"message": "Role updated", "user": {"id": user.id, "login": user.login, "email": user.email, "role": user.role}}), 200
