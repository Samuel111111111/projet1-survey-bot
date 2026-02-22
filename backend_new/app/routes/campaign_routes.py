"""
Routes for managing campaigns in the Survey Bot API.

Campaigns represent a collection of questions and associated sessions. Only
users with appropriate roles can create, update or delete campaigns.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db
from ..models import Campaign, SurveySession, AuditLog, User, campaign_allowed_users
from ..utils.security import role_required


campaigns_bp = Blueprint("campaigns", __name__)


@campaigns_bp.route("/", methods=["GET"])
@jwt_required()
@role_required("admin", "campaign_manager", "viewer")
def list_campaigns() -> tuple:
    """Return a list of all campaigns."""
    campaigns = Campaign.query.order_by(Campaign.created_at.desc()).all()
    return {
        "campaigns": [c.to_dict() for c in campaigns]
    }, 200


@campaigns_bp.route("/", methods=["POST"])
@jwt_required()
@role_required("admin", "campaign_manager")
def create_campaign() -> tuple:
    """Create a new campaign."""
    data = request.get_json() or {}
    title = data.get("title")
    description = data.get("description")
    start_date_str = data.get("start_date")
    end_date_str = data.get("end_date")
    status = data.get("status", "Draft")

    if not title:
        return {"error": "Title is required"}, 400

    def parse_date(date_str: Optional[str]) -> Optional[datetime.date]:
        if not date_str:
            return None
        try:
            return datetime.fromisoformat(date_str).date()
        except ValueError:
            return None

    start_date = parse_date(start_date_str)
    end_date = parse_date(end_date_str)

    # Additional fields for new features
    is_anonymous = bool(data.get("is_anonymous", False))
    is_private = bool(data.get("is_private", False))
    screening_question_id = data.get("screening_question_id")
    screening_allowed_option_ids = data.get("screening_allowed_option_ids")
    allowed_user_emails = data.get("allowed_user_emails", [])

    # Convert screening_allowed_option_ids to comma-separated string if list is provided
    screening_allowed_str = None
    if screening_allowed_option_ids:
        if isinstance(screening_allowed_option_ids, list):
            screening_allowed_str = ",".join(str(i) for i in screening_allowed_option_ids)
        else:
            # Accept comma-separated string directly
            screening_allowed_str = str(screening_allowed_option_ids)

    # Set creator_id to current user
    creator_id = int(get_jwt_identity())

    campaign = Campaign(
        title=title,
        description=description,
        start_date=start_date,
        end_date=end_date,
        status=status,
        creator_id=creator_id,
        is_anonymous=is_anonymous,
        is_private=is_private,
        screening_question_id=screening_question_id,
        screening_allowed_option_ids=screening_allowed_str,
    )
    db.session.add(campaign)
    db.session.flush()  # generate campaign.id

    # Create a default session so every campaign immediately has a participant link + QR.
    default_session = SurveySession(campaign=campaign)
    db.session.add(default_session)
    db.session.flush()

    db.session.commit()

    # If campaign is private and allowed_user_emails provided, add associations
    if is_private and allowed_user_emails:
        # Filter out the creator's email (creator always has access)
        for email in allowed_user_emails:
            # Find user by email
            user = User.query.filter_by(email=email).first()
            if user:
                db.session.execute(
                    campaign_allowed_users.insert().values(campaign_id=campaign.id, user_id=user.id)
                )
        db.session.commit()

    # Audit log
    log = AuditLog(user_id=creator_id, action="create_campaign", details=f"campaign_id={campaign.id}")
    db.session.add(log)
    db.session.commit()

    return {"message": "Campaign created", "campaign_id": campaign.id}, 201


@campaigns_bp.route("/<int:campaign_id>", methods=["GET"])
@jwt_required()
@role_required("admin", "campaign_manager", "viewer")
def get_campaign(campaign_id: int) -> tuple:
    """Retrieve a single campaign by its ID."""
    campaign = Campaign.query.get_or_404(campaign_id)
    data = campaign.to_dict()
    # Include questions and options for convenience
    data["questions"] = [
        {
            **q.to_dict(),
            "options": [o.to_dict() for o in q.options],
        }
        for q in campaign.questions
    ]
    return data, 200


@campaigns_bp.route("/<int:campaign_id>", methods=["PUT"])
@jwt_required()
@role_required("admin", "campaign_manager")
def update_campaign(campaign_id: int) -> tuple:
    """Update an existing campaign."""
    campaign = Campaign.query.get_or_404(campaign_id)
    data = request.get_json() or {}

    # Update fields if provided
    if "title" in data:
        campaign.title = data["title"]
    if "description" in data:
        campaign.description = data["description"]
    if "start_date" in data:
        try:
            campaign.start_date = datetime.fromisoformat(data["start_date"]).date()
        except ValueError:
            return {"error": "Invalid start_date"}, 400
    if "end_date" in data:
        try:
            campaign.end_date = datetime.fromisoformat(data["end_date"]).date()
        except ValueError:
            return {"error": "Invalid end_date"}, 400
    if "status" in data:
        campaign.status = data["status"]

    # New fields: anonymous, private, screening and allowed users
    if "is_anonymous" in data:
        campaign.is_anonymous = bool(data["is_anonymous"])
    if "is_private" in data:
        new_private = bool(data["is_private"])
        # If switching from private to public, remove allowed users
        if campaign.is_private and not new_private:
            db.session.execute(
                campaign_allowed_users.delete().where(campaign_allowed_users.c.campaign_id == campaign.id)
            )
        campaign.is_private = new_private
    # Screening logic updates
    if "screening_question_id" in data:
        campaign.screening_question_id = data["screening_question_id"]
    if "screening_allowed_option_ids" in data:
        allowed = data["screening_allowed_option_ids"]
        if allowed is None:
            campaign.screening_allowed_option_ids = None
        elif isinstance(allowed, list):
            campaign.screening_allowed_option_ids = ",".join(str(i) for i in allowed)
        else:
            campaign.screening_allowed_option_ids = str(allowed)
    # Update allowed users for private campaigns
    if campaign.is_private:
        allowed_emails = data.get("allowed_user_emails")
        if allowed_emails is not None:
            # Remove existing associations (except creator)
            db.session.execute(
                campaign_allowed_users.delete().where(campaign_allowed_users.c.campaign_id == campaign.id)
            )
            # Re-add allowed users from provided list
            for email in allowed_emails:
                user = User.query.filter_by(email=email).first()
                # Only add if user exists and is not the creator
                if user and user.id != campaign.creator_id:
                    db.session.execute(
                        campaign_allowed_users.insert().values(campaign_id=campaign.id, user_id=user.id)
                    )

    db.session.commit()

    # Audit log
    user_id = int(get_jwt_identity())
    log = AuditLog(user_id=user_id, action="update_campaign", details=f"campaign_id={campaign.id}")
    db.session.add(log)
    db.session.commit()

    return {"message": "Campaign updated"}, 200


@campaigns_bp.route("/<int:campaign_id>", methods=["DELETE"])
@jwt_required()
@role_required("admin")
def delete_campaign(campaign_id: int) -> tuple:
    """Delete a campaign and all related questions, options and sessions."""
    campaign = Campaign.query.get_or_404(campaign_id)
    db.session.delete(campaign)
    db.session.commit()

    # Audit log
    user_id = int(get_jwt_identity())
    log = AuditLog(user_id=user_id, action="delete_campaign", details=f"campaign_id={campaign_id}")
    db.session.add(log)
    db.session.commit()

    return {"message": "Campaign deleted"}, 200


# ---------------------------------------------------------------------------
# Additional endpoints for multi‑user management of campaigns.
#
# - /campaigns/mine: list campaigns created by the current user. Useful
#   for the "Voir mes campagnes" page.
# - /campaigns/all: list campaigns accessible to the current user. Private
#   campaigns are included only if the user is in the allowed list or is
#   the creator. Public campaigns (is_private=False) are visible to all
#   authenticated users.
# ---------------------------------------------------------------------------


@campaigns_bp.route("/mine", methods=["GET"])
@jwt_required()
@role_required("admin", "campaign_manager", "viewer")
def list_my_campaigns() -> tuple:
    """Return campaigns created by the current user."""
    user_id = int(get_jwt_identity())
    campaigns = Campaign.query.filter_by(creator_id=user_id).order_by(Campaign.created_at.desc()).all()
    return {"campaigns": [c.to_dict() for c in campaigns]}, 200


@campaigns_bp.route("/all", methods=["GET"])
@jwt_required()
@role_required("admin", "campaign_manager", "viewer")
def list_all_campaigns() -> tuple:
    """Return campaigns accessible to the current user."""
    user_id = int(get_jwt_identity())
    # Subquery to find campaigns where the user is allowed
    allowed_campaign_ids = [
        row.campaign_id for row in db.session.query(campaign_allowed_users.c.campaign_id).filter(
            campaign_allowed_users.c.user_id == user_id
        ).all()
    ]
    campaigns = Campaign.query.filter(
        db.or_(
            Campaign.is_private == False,
            Campaign.creator_id == user_id,
            Campaign.id.in_(allowed_campaign_ids),
        )
    ).order_by(Campaign.created_at.desc()).all()
    return {"campaigns": [c.to_dict() for c in campaigns]}, 200