"""
Endpoints for campaign statistics.

Provides aggregated statistics for a given campaign such as total number
of responses, total number of unique sessions, and counts per option.
"""

from __future__ import annotations

from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from ..extensions import db
from ..models import Campaign, Question, Option, Response, SurveySession
from ..utils.security import role_required


stats_bp = Blueprint("stats", __name__)


@stats_bp.route("/<int:campaign_id>/stats", methods=["GET"])
@jwt_required()
@role_required("admin", "campaign_manager", "viewer")
def campaign_stats(campaign_id: int) -> tuple:
    """Compute and return statistics for the given campaign."""
    campaign = Campaign.query.get_or_404(campaign_id)

    # Total responses
    total_responses = Response.query.join(Question).filter(Question.campaign_id == campaign_id).count()

    # Total unique sessions
    total_sessions = (
        db.session.query(Response.session_id)
        .join(Question)
        .filter(Question.campaign_id == campaign_id)
        .distinct()
        .count()
    )

    # Stats per question and option
    stats = []
    for question in campaign.questions:
        q_stats = {
            "question_id": question.id,
            "question_text": question.question_text,
            "question_type": question.question_type,
            "options": [],
        }
        if question.options:
            for option in question.options:
                count = Response.query.filter_by(option_id=option.id).count()
                q_stats["options"].append({
                    "option_id": option.id,
                    "text": option.text,
                    "label": option.label,
                    "votes": count,
                })
        else:
            # For non-choice questions, we can return number of answers and maybe average rating
            count = Response.query.filter_by(question_id=question.id).count()
            q_stats["total_answers"] = count
        stats.append(q_stats)

    return {
        "campaign_id": campaign.id,
        "total_responses": total_responses,
        "total_sessions": total_sessions,
        "questions": stats,
    }, 200


# ---------------------------------------------------------------------------
# New endpoint: statistics overview for all campaigns
#
# Many dashboards and analytics pages need an aggregated view of statistics
# across multiple campaigns. This endpoint computes summary data (totals per
# campaign) that can be consumed by the front‑end to build bar charts or
# pie charts. It is protected by JWT and role checks just like the other
# statistics endpoints.
# ---------------------------------------------------------------------------


@stats_bp.route("/overview", methods=["GET"])
@jwt_required()
@role_required("admin", "campaign_manager", "viewer")
def stats_overview() -> tuple:
    """Return aggregated statistics for all campaigns.

    The response contains, for each campaign, the number of responses
    submitted and the number of unique sessions (participants). This data
    allows the front‑end to render comparative charts (e.g., bar charts of
    total responses per campaign) and to compute percentages for pie charts.
    """
    # Query all campaigns with their id and title
    campaigns = Campaign.query.order_by(Campaign.id).all()
    overview = []
    for campaign in campaigns:
        # Total responses for this campaign
        total_responses = (
            Response.query.join(Question)
            .filter(Question.campaign_id == campaign.id)
            .count()
        )
        # Total unique sessions (participants) for this campaign
        total_sessions = (
            db.session.query(Response.session_id)
            .join(Question)
            .filter(Question.campaign_id == campaign.id)
            .distinct()
            .count()
        )
        overview.append({
            "campaign_id": campaign.id,
            "title": campaign.title,
            "total_responses": total_responses,
            "total_sessions": total_sessions,
        })
    return {"campaigns": overview}, 200