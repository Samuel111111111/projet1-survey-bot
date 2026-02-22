"""
Endpoints for exporting campaign data.

Supports exporting responses to CSV, Excel (xlsx) or PDF. The exported
content is returned as a base64-encoded string to simplify front-end
consumption. Clients can decode and download the data as a file.
"""

from __future__ import annotations

import base64
from io import BytesIO
from typing import List

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import pandas as pd

from ..extensions import db
from ..models import Campaign, Question, Response, Option
from ..utils.security import role_required

# PDF generation
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet


export_bp = Blueprint("export", __name__)


def _collect_campaign_data(campaign_id: int) -> pd.DataFrame:
    """Gather campaign response data into a pandas DataFrame."""
    # Query responses with joins to get question text and option text
    query = (
        db.session.query(
            Response.id.label("response_id"),
            Response.created_at.label("response_time"),
            Response.zone_id.label("zone_id"),
            Question.question_text.label("question"),
            Question.question_type.label("question_type"),
            Option.text.label("option_text"),
            Response.answer_text.label("answer_text"),
        )
        .join(Question, Response.question_id == Question.id)
        .outerjoin(Option, Response.option_id == Option.id)
        .filter(Question.campaign_id == campaign_id)
    )
    records = query.all()
    # Convert to list of dicts
    rows = []
    for r in records:
        rows.append({
            "response_id": r.response_id,
            "response_time": r.response_time,
            "zone_id": r.zone_id,
            "question": r.question,
            "question_type": r.question_type,
            "option_text": r.option_text,
            "answer_text": r.answer_text,
        })
    return pd.DataFrame(rows)


@export_bp.route("/<int:campaign_id>", methods=["GET"])
@jwt_required()
@role_required("admin", "campaign_manager", "viewer")
def export_campaign(campaign_id: int) -> tuple:
    """Export campaign responses in the requested format.

    Query parameter ``format`` can be ``csv``, ``xlsx``, or ``pdf``.
    Returns a JSON payload with the file encoded in base64 and a suggested
    filename.
    """
    fmt = request.args.get("format", "csv").lower()
    # Accept an additional "powerbi" format alias. The Power BI export
    # leverages the existing Excel export because the .xlsx format is
    # natively consumable by Power BI. The alias is provided to make the
    # API self‑documenting and to avoid confusion for clients expecting a
    # dedicated Power BI export.
    if fmt not in {"csv", "xlsx", "pdf", "powerbi"}:
        return {"error": "Invalid format"}, 400

    campaign = Campaign.query.get_or_404(campaign_id)
    df = _collect_campaign_data(campaign_id)

    file_name = f"campaign_{campaign_id}_responses.{fmt}"

    # Treat the powerbi alias as an Excel export. We generate an
    # additional sheet with basic statistics to facilitate reporting. The
    # primary sheet remains "Responses" to maintain compatibility with
    # existing consumers.
    if fmt == "csv":
        csv_data = df.to_csv(index=False)
        encoded = base64.b64encode(csv_data.encode("utf-8")).decode("ascii")
        content_type = "text/csv"
    elif fmt in {"xlsx", "powerbi"}:
        buffer = BytesIO()
        with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
            # Sheet with raw responses
            df.to_excel(writer, index=False, sheet_name="Responses")
            # For the powerbi format we embed additional aggregated stats
            if fmt == "powerbi":
                # Total responses per question and per option
                # Build a statistics DataFrame similar to what /stats returns
                stats_rows = []
                # Group by question and option to count votes
                for question in Question.query.filter_by(campaign_id=campaign.id).all():
                    if question.options:
                        for option in question.options:
                            count = Response.query.filter_by(option_id=option.id).count()
                            stats_rows.append({
                                "question_id": question.id,
                                "question_text": question.question_text,
                                "option_id": option.id,
                                "option_label": option.label,
                                "option_text": option.text,
                                "votes": count,
                            })
                    else:
                        count = Response.query.filter_by(question_id=question.id).count()
                        stats_rows.append({
                            "question_id": question.id,
                            "question_text": question.question_text,
                            "option_id": None,
                            "option_label": None,
                            "option_text": None,
                            "votes": count,
                        })
                stats_df = pd.DataFrame(stats_rows)
                stats_df.to_excel(writer, index=False, sheet_name="Stats")
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        content_type = "application/vnd.openxmlformats-officedocument-spreadsheetml.sheet"
        # Use .xlsx extension even for the powerbi alias
        if fmt == "powerbi":
            file_name = f"campaign_{campaign_id}_powerbi.xlsx"
    else:  # pdf
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements: List = []
        styles = getSampleStyleSheet()
        elements.append(Paragraph(f"Responses for Campaign {campaign.title}", styles['Title']))
        elements.append(Spacer(1, 12))
        # Prepare table data
        if df.empty:
            elements.append(Paragraph("No responses yet.", styles['Normal']))
        else:
            table_data = [df.columns.tolist()] + df.astype(str).values.tolist()
            table = Table(table_data, repeatRows=1)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('GRID', (0, 0), (-1, -1), 0.25, colors.grey),
            ]))
            elements.append(table)
        doc.build(elements)
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
        content_type = "application/pdf"

    return {
        "file_name": file_name,
        "content_type": content_type,
        "data_base64": encoded,
    }, 200