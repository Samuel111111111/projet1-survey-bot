"""
Routes for managing questions and options within campaigns.
"""

from __future__ import annotations

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db
from ..models import Campaign, Question, Option, AuditLog
from ..utils.security import role_required


questions_bp = Blueprint("questions", __name__)


@questions_bp.route("/<int:campaign_id>/questions", methods=["GET"])
@jwt_required()
@role_required("admin", "campaign_manager", "viewer")
def list_questions(campaign_id: int) -> tuple:
    """List all questions for a given campaign."""
    campaign = Campaign.query.get_or_404(campaign_id)
    data = [
        {
            **q.to_dict(),
            "options": [o.to_dict() for o in q.options],
        }
        for q in campaign.questions
    ]
    return {"questions": data}, 200


@questions_bp.route("/<int:campaign_id>/questions", methods=["POST"])
@jwt_required()
@role_required("admin", "campaign_manager")
def create_question(campaign_id: int) -> tuple:
    """Create a new question for a campaign."""
    campaign = Campaign.query.get_or_404(campaign_id)
    data = request.get_json() or {}
    text = data.get("question_text") or data.get("text")
    q_type = data.get("question_type")
    is_required = bool(data.get("is_required", True))
    ordering = data.get("ordering", len(campaign.questions))
    preferred_chart_type = data.get("preferred_chart_type")

    if not text or not q_type:
        return {"error": "question_text and question_type are required"}, 400

    question = Question(
        campaign=campaign,
        question_text=text,
        question_type=q_type,
        is_required=is_required,
        ordering=ordering,
        preferred_chart_type=preferred_chart_type,
    )
    db.session.add(question)
    db.session.commit()

    # Add options if provided
    options_data = data.get("options", [])
    for opt in options_data:
        o = Option(question=question, text=opt.get("text"), label=opt.get("label"))
        db.session.add(o)
    db.session.commit()

    user_id = int(get_jwt_identity())
    log = AuditLog(user_id=user_id, action="create_question", details=f"question_id={question.id}")
    db.session.add(log)
    db.session.commit()

    return {"message": "Question created", "question_id": question.id}, 201


@questions_bp.route("/<int:campaign_id>/questions/<int:question_id>", methods=["PUT"])
@jwt_required()
@role_required("admin", "campaign_manager")
def update_question(campaign_id: int, question_id: int) -> tuple:
    """Update a specific question."""
    question = Question.query.filter_by(id=question_id, campaign_id=campaign_id).first_or_404()
    data = request.get_json() or {}

    if "question_text" in data:
        question.question_text = data["question_text"]
    if "question_type" in data:
        question.question_type = data["question_type"]
    if "is_required" in data:
        question.is_required = bool(data["is_required"])
    if "ordering" in data:
        question.ordering = data["ordering"]
    db.session.commit()

    user_id = int(get_jwt_identity())
    log = AuditLog(user_id=user_id, action="update_question", details=f"question_id={question.id}")
    db.session.add(log)
    db.session.commit()

    return {"message": "Question updated"}, 200


@questions_bp.route("/<int:campaign_id>/questions/<int:question_id>", methods=["DELETE"])
@jwt_required()
@role_required("admin", "campaign_manager")
def delete_question(campaign_id: int, question_id: int) -> tuple:
    """Delete a question and its options."""
    question = Question.query.filter_by(id=question_id, campaign_id=campaign_id).first_or_404()
    db.session.delete(question)
    db.session.commit()

    user_id = int(get_jwt_identity())
    log = AuditLog(user_id=user_id, action="delete_question", details=f"question_id={question_id}")
    db.session.add(log)
    db.session.commit()

    return {"message": "Question deleted"}, 200


# Option endpoints
@questions_bp.route("/<int:campaign_id>/questions/<int:question_id>/options", methods=["GET"])
@jwt_required()
@role_required("admin", "campaign_manager", "viewer")
def list_options(campaign_id: int, question_id: int) -> tuple:
    """List options for a question."""
    question = Question.query.filter_by(id=question_id, campaign_id=campaign_id).first_or_404()
    return {"options": [o.to_dict() for o in question.options]}, 200


@questions_bp.route("/<int:campaign_id>/questions/<int:question_id>/options", methods=["POST"])
@jwt_required()
@role_required("admin", "campaign_manager")
def create_option(campaign_id: int, question_id: int) -> tuple:
    """Add an option to a question."""
    question = Question.query.filter_by(id=question_id, campaign_id=campaign_id).first_or_404()
    data = request.get_json() or {}
    text = data.get("text")
    label = data.get("label")
    if not text:
        return {"error": "Option text is required"}, 400
    option = Option(question=question, text=text, label=label)
    db.session.add(option)
    db.session.commit()

    user_id = int(get_jwt_identity())
    log = AuditLog(user_id=user_id, action="create_option", details=f"option_id={option.id}")
    db.session.add(log)
    db.session.commit()
    return {"message": "Option created", "option_id": option.id}, 201


@questions_bp.route("/options/<int:option_id>", methods=["PUT"])
@jwt_required()
@role_required("admin", "campaign_manager")
def update_option(option_id: int) -> tuple:
    """Update a single option."""
    option = Option.query.get_or_404(option_id)
    data = request.get_json() or {}
    if "text" in data:
        option.text = data["text"]
    if "label" in data:
        option.label = data["label"]
    db.session.commit()

    user_id = int(get_jwt_identity())
    log = AuditLog(user_id=user_id, action="update_option", details=f"option_id={option.id}")
    db.session.add(log)
    db.session.commit()
    return {"message": "Option updated"}, 200


@questions_bp.route("/options/<int:option_id>", methods=["DELETE"])
@jwt_required()
@role_required("admin", "campaign_manager")
def delete_option(option_id: int) -> tuple:
    """Delete an option."""
    option = Option.query.get_or_404(option_id)
    db.session.delete(option)
    db.session.commit()
    user_id = int(get_jwt_identity())
    log = AuditLog(user_id=user_id, action="delete_option", details=f"option_id={option_id}")
    db.session.add(log)
    db.session.commit()
    return {"message": "Option deleted"}, 200