"""
Endpoints for managing survey sessions (invitation links) associated with campaigns.

Sessions represent unique tokens that participants use to access a survey. Each
session can optionally include a QR code representation of the survey link.
"""

from __future__ import annotations

import base64
from io import BytesIO
from typing import List

from flask import Blueprint, request, current_app, send_file, make_response
from flask_jwt_extended import jwt_required, get_jwt_identity

from ..extensions import db
from ..models import Campaign, SurveySession, AuditLog
from ..utils.security import role_required
from ..utils.qr_utils import generate_qr_png_bytes, generate_qr_sheet_pdf


sessions_bp = Blueprint("sessions", __name__)


def _preferred_frontend_base_url() -> str:
    """Pick the best base URL to build public survey links.

    Priority:
    1) PUBLIC_FRONTEND_URL config/env (explicit)
    2) Origin header (when admin UI is accessed from another device/IP)
    3) request.host_url (fallback)

    This helps QR codes work on phones/tablets when the admin UI is not opened
    via localhost.
    """
    explicit = (current_app.config.get("PUBLIC_FRONTEND_URL") or "").strip()
    if explicit:
        return explicit.rstrip("/")

    origin = (request.headers.get("Origin") or "").strip()
    if origin:
        return origin.rstrip("/")

    return request.host_url.rstrip("/")


@sessions_bp.route("/<int:campaign_id>/sessions", methods=["POST"])
@jwt_required()
@role_required("admin", "campaign_manager")
def create_sessions(campaign_id: int) -> tuple:
    """Generate one or more survey sessions (invitation links) for a campaign.

    Expected JSON body:
    {
        "count": 5  # optional, defaults to 1
    }

    Returns a list of objects containing the session ID, token, survey link and
    a base64-encoded PNG of the QR code.
    """
    data = request.get_json() or {}
    count = int(data.get("count", 1))
    if count < 1 or count > 100:
        return {"error": "count must be between 1 and 100"}, 400

    campaign = Campaign.query.get_or_404(campaign_id)
    created_sessions = []

    for _ in range(count):
        session = SurveySession(campaign=campaign)
        db.session.add(session)
        db.session.flush()  # flush to generate session.id and token

        # Compose the survey link.
        base_url = _preferred_frontend_base_url()
        survey_url = f"{base_url}/survey/{session.token}"

        # Generate QR code as base64
        qr_bytes = generate_qr_png_bytes(survey_url)
        qr_base64 = base64.b64encode(qr_bytes).decode("ascii")

        created_sessions.append({
            "session_id": session.id,
            "token": session.token,
            "survey_url": survey_url,
            "qr_base64": qr_base64,
        })

    db.session.commit()

    user_id = int(get_jwt_identity())
    log = AuditLog(user_id=user_id, action="create_sessions", details=f"campaign_id={campaign_id}, count={count}")
    db.session.add(log)
    db.session.commit()

    return {"sessions": created_sessions}, 201


@sessions_bp.route("/<int:campaign_id>/sessions", methods=["GET"])
@jwt_required()
@role_required("admin", "campaign_manager", "viewer")
def list_sessions(campaign_id: int) -> tuple:
    """List all sessions for a given campaign."""
    campaign = Campaign.query.get_or_404(campaign_id)

    sessions = [
        {
            "id": s.id,
            "token": s.token,
            "status": s.status,
            "started_at": s.started_at.isoformat() if s.started_at else None,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        }
        for s in campaign.sessions
    ]
    return {"sessions": sessions}, 200


# -----------------------------------------------------------------------------
# QR code download endpoints

@sessions_bp.route("/<int:campaign_id>/sessions/<int:session_id>/qr.png", methods=["GET"])
@jwt_required(optional=True)
def download_qr_png(campaign_id: int, session_id: int):
    """Return the raw PNG image of a QR code for a given session.

    Publicly accessible (authentication optional).
    If ?download=1 is provided, it forces download.
    Otherwise, it renders inline (usable with <img src="...">).
    """
    session = SurveySession.query.get_or_404(session_id)
    if session.campaign_id != campaign_id:
        return {"error": "Session does not belong to the campaign"}, 400

    base_url = _preferred_frontend_base_url()
    survey_url = f"{base_url}/survey/{session.token}"

    png_data = generate_qr_png_bytes(survey_url)

    download = str(request.args.get("download", "")).lower() in ("1", "true", "yes")

    return send_file(
        BytesIO(png_data),
        mimetype="image/png",
        download_name=f"session_{session.id}_qr.png",
        as_attachment=download,
    )


@sessions_bp.route("/<int:campaign_id>/sessions/<int:session_id>/qr.pdf", methods=["GET"])
@jwt_required(optional=True)
def download_qr_pdf(campaign_id: int, session_id: int):
    """Return a single-page PDF containing the QR code for a given session.

    Publicly accessible (authentication optional).
    """
    session = SurveySession.query.get_or_404(session_id)
    if session.campaign_id != campaign_id:
        return {"error": "Session does not belong to the campaign"}, 400

    base_url = _preferred_frontend_base_url()
    survey_url = f"{base_url}/survey/{session.token}"

    # Use existing generator from qr_utils
    pdf_bytes = generate_qr_sheet_pdf(
        [survey_url],
        title="Survey QR Code",
        subtitle="Scannez pour participer",
        cta=survey_url,
        per_page=1,
        page_format="A4",
    )

    resp = make_response(pdf_bytes)
    resp.headers["Content-Type"] = "application/pdf"
    resp.headers["Content-Disposition"] = f'attachment; filename="session_{session.id}_qr.pdf"'
    return resp


@sessions_bp.route("/<int:campaign_id>/qr-sheet.pdf", methods=["GET"])
@jwt_required()
@role_required("admin", "campaign_manager")
def download_qr_sheet(campaign_id: int):
    """Generate and return a PDF sheet of QR codes for a campaign.

    Query parameters:
        count: Number of sessions/QR codes to generate (default 30, max 200)
        per_page: Number of codes per page (default 30)
        title: Title text for the sheet (optional)
        subtitle: Subtitle text (optional)
        cta: Call-to-action printed under each QR (optional)
        page_format: "A4" or "letter" (default A4)

    This endpoint creates ``count`` new sessions and returns a PDF with the
    generated QR codes. It records an audit log entry on success.
    """
    count = int(request.args.get("count", 30))
    per_page = int(request.args.get("per_page", 30))
    title = request.args.get("title", "QR Codes")
    subtitle = request.args.get("subtitle", "Scannez pour participer")
    cta = request.args.get("cta", "")
    page_format = request.args.get("page_format", "A4")

    count = min(max(count, 1), 200)
    per_page = max(1, per_page)

    campaign = Campaign.query.get_or_404(campaign_id)

    survey_urls: List[str] = []

    for _ in range(count):
        session = SurveySession(campaign=campaign)
        db.session.add(session)
        db.session.flush()

        base_url = _preferred_frontend_base_url()
        survey_url = f"{base_url}/survey/{session.token}"
        survey_urls.append(survey_url)

    db.session.commit()

    if get_jwt_identity():
        user_id = int(get_jwt_identity())
        log = AuditLog(user_id=user_id, action="generate_qr_sheet", details=f"campaign_id={campaign_id}, count={count}")
        db.session.add(log)
        db.session.commit()

    pdf_bytes = generate_qr_sheet_pdf(
        survey_urls,
        title=title,
        subtitle=subtitle,
        cta=cta,
        per_page=per_page,
        page_format=page_format,
    )

    return send_file(
        BytesIO(pdf_bytes),
        mimetype="application/pdf",
        download_name=f"campaign_{campaign_id}_qr_sheet.pdf",
        as_attachment=True,
    )
