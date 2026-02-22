"""
Public endpoints for the conversation bot.

Participants access these endpoints via a unique session token without
authentication. The bot returns questions sequentially and records
responses.
"""

from __future__ import annotations

from datetime import datetime
from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import SurveySession, Response, Question, Option, AuditLog


bot_bp = Blueprint("bot", __name__)


def _get_session_by_token(token: str) -> SurveySession:
    """Helper to fetch a session by token or abort with 404."""
    session = SurveySession.query.filter_by(token=token).first()
    if not session:
        from flask import abort

        abort(404, description="Session not found")
    return session


@bot_bp.route("/<string:token>", methods=["GET"])
def get_next_question(token: str) -> tuple:
    """Return the next question for the given session token.

    If all questions have been answered, return a completion message.
    """
    session = _get_session_by_token(token)
    campaign = session.campaign

    # Determine index of next question based on number of responses
    answered_question_ids = {r.question_id for r in session.responses}
    all_questions = sorted(campaign.questions, key=lambda q: q.ordering)

    # Find the first unanswered question
    next_question = None
    for q in all_questions:
        if q.id not in answered_question_ids:
            next_question = q
            break

    # If no next question, mark session complete and respond
    if not next_question:
        if session.status != "Completed":
            session.status = "Completed"
            session.completed_at = datetime.utcnow()
            db.session.commit()
            # Audit log for completion (no user_id for external participants)
            log = AuditLog(user_id=None, action="complete_session", details=f"session_id={session.id}")
            db.session.add(log)
            db.session.commit()
        return {"message": "Survey completed"}, 200

    # Mark session as started if this is the first question
    if session.status == "Pending" or not session.started_at:
        session.status = "InProgress"
        session.started_at = datetime.utcnow()
        db.session.commit()

    # Prepare question payload
    options = [
        {
            "id": o.id,
            "text": o.text,
            "label": o.label,
        }
        for o in next_question.options
    ]
    return {
        "session_id": session.id,
        "question_id": next_question.id,
        "question_text": next_question.question_text,
        "question_type": next_question.question_type,
        "is_required": next_question.is_required,
        "options": options,
    }, 200


@bot_bp.route("/<string:token>/answer", methods=["POST"])
def submit_answer(token: str) -> tuple:
    """Submit an answer for the current question in a session."""
    session = _get_session_by_token(token)
    data = request.get_json() or {}
    question_id = data.get("question_id")
    option_id = data.get("option_id")
    answer_text = data.get("answer_text")
    zone_id = data.get("zone_id")

    if not question_id:
        return {"error": "question_id is required"}, 400

    # Validate question belongs to the campaign
    question = Question.query.get(question_id)
    if not question or question.campaign_id != session.campaign_id:
        return {"error": "Invalid question_id"}, 400

    # Validate answer: either option_id or answer_text
    if question.question_type in {"single_choice", "multiple_choice"}:
        if not option_id:
            return {"error": "option_id is required for choice questions"}, 400
        option = Option.query.get(option_id)
        if not option or option.question_id != question_id:
            return {"error": "Invalid option_id"}, 400
    else:
        # For text or rating questions, answer_text is required
        if not answer_text:
            return {"error": "answer_text is required"}, 400

    # Anti-fraud: Do not allow answering if the session is completed or expired
    if session.status == "Completed":
        return {"error": "This session has already been completed"}, 409
    # Check if the session has an expiration and is expired
    if session.expires_at and session.expires_at < datetime.utcnow():
        return {"error": "This session has expired"}, 410
    # Prevent duplicate responses to the same question in the same session
    existing = Response.query.filter_by(session_id=session.id, question_id=question_id).first()
    if existing:
        return {"error": "This question has already been answered in this session"}, 409
    # Save the response
    response = Response(
        session=session,
        question=question,
        option_id=option_id,
        answer_text=answer_text,
        zone_id=zone_id,
    )
    db.session.add(response)
    db.session.commit()

    # Screening logic: if this question is the screening question, ensure
    # the participant selected an allowed option. If not, terminate the
    # session immediately and return a message.
    campaign = session.campaign
    if campaign.screening_question_id and question.id == campaign.screening_question_id:
        # Parse allowed option IDs from the campaign setting
        allowed_option_ids: list[int] = []
        if campaign.screening_allowed_option_ids:
            try:
                allowed_option_ids = [int(x) for x in campaign.screening_allowed_option_ids.split(",") if x]
            except ValueError:
                allowed_option_ids = []
        if option_id not in allowed_option_ids:
            session.status = "Completed"
            session.completed_at = datetime.utcnow()
            db.session.commit()
            return {
                "message": "You do not meet the criteria for this survey."
            }, 200

    # Return next question
    return get_next_question(token)