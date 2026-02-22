"""
Database models for the Survey Bot backend.

These classes define the structure of the database tables using
SQLAlchemy's declarative API. Each model includes simple convenience
methods for converting to dictionaries when needed.
"""

from __future__ import annotations

from datetime import datetime
from uuid import uuid4
from typing import Optional, List

from .extensions import db


def generate_uuid() -> str:
    """Generate a random UUID string without dashes."""
    return uuid4().hex


class BaseModel(db.Model):
    """Mixin with common columns and helper methods."""

    __abstract__ = True

    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> dict:
        """Return a dictionary representation of the model."""
        return {c.name: getattr(self, c.name) for c in self.__table__.columns}


class User(BaseModel):
    """
    Authenticated user of the system. Users can have different roles,
    for example admin, campaign_manager, or viewer.
    """
    __tablename__ = "users"

    login = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(30), nullable=False, default="viewer")

    # New fields for user identity and account management
    first_name = db.Column(db.String(80))
    last_name = db.Column(db.String(80))
    # Unique email address used for login and verification
    email = db.Column(db.String(120), unique=True, nullable=True)
    # Flag indicating whether the email has been verified
    email_verified = db.Column(db.Boolean, nullable=False, default=False)
    # Verification code for email confirmation. When a user registers,
    # a code is generated and stored here until the user verifies it.
    verification_code = db.Column(db.String(100))
    # Token for password reset. When a password reset is requested,
    # a token is stored here and the user must supply it when resetting
    # their password.
    reset_password_token = db.Column(db.String(100))

    responses = db.relationship("Response", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User {self.login}>"


class Campaign(BaseModel):
    """
    A campaign groups a set of questions to form an enquiry. Each campaign can
    have multiple sessions (links) which participants use to complete the
    survey.
    """
    __tablename__ = "campaigns"

    title = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    status = db.Column(db.String(20), nullable=False, default="Draft")

    # ID of the user who created this campaign. Used for "my campaigns"
    # filtering and permission checks.
    creator_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    creator = db.relationship("User", backref="created_campaigns", foreign_keys=[creator_id])

    # Whether responses should be anonymous. If true, the application
    # should avoid collecting personally identifiable information from
    # participants (e.g. names). Zone and age can still be collected.
    is_anonymous = db.Column(db.Boolean, nullable=False, default=False)

    # Whether this campaign is private. Private campaigns are only
    # accessible to users explicitly allowed by the creator. The allowed
    # users are specified via the campaign_allowed_users association table.
    is_private = db.Column(db.Boolean, nullable=False, default=False)

    # Optional screening logic. If provided, this field contains the ID
    # of a question used to screen participants. Only participants whose
    # answers match the allowed option IDs (stored in
    # screening_allowed_option_ids) are eligible to continue the survey.
    #
    # NOTE: We intentionally do not declare this as a foreign key because
    # it creates a circular dependency between campaigns and questions.
    # Instead, this column stores the question ID as an integer. The
    # application logic should validate that the question belongs to this
    # campaign.
    screening_question_id = db.Column(db.Integer, nullable=True)

    # Comma-separated list of option IDs that are allowed in the screening
    # question. Only relevant if screening_question_id is set.
    screening_allowed_option_ids = db.Column(db.String(255))

    # Specify the foreign key used for the relationship to avoid ambiguity with
    # screening_question_id. Without this, SQLAlchemy may not know which
    # foreign key to use between campaigns and questions.
    questions = db.relationship(
        "Question",
        back_populates="campaign",
        cascade="all, delete-orphan",
        foreign_keys="Question.campaign_id",
    )
    sessions = db.relationship("SurveySession", back_populates="campaign", cascade="all, delete-orphan")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Campaign {self.title}>"


# Association table linking campaigns to users who are allowed to access
# private campaigns. For a private campaign, only users with an entry
# here (or the creator) can view or participate in the campaign.
campaign_allowed_users = db.Table(
    "campaign_allowed_users",
    db.Column("campaign_id", db.Integer, db.ForeignKey("campaigns.id"), primary_key=True),
    db.Column("user_id", db.Integer, db.ForeignKey("users.id"), primary_key=True),
)


class Question(BaseModel):
    """
    A question belongs to a campaign and may have one or more options. The
    ``question_type`` field defines how the question should be presented to
    participants (e.g. single_choice, multiple_choice, text, rating).
    """
    __tablename__ = "questions"

    campaign_id = db.Column(db.Integer, db.ForeignKey("campaigns.id"), nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    question_type = db.Column(db.String(30), nullable=False)
    is_required = db.Column(db.Boolean, nullable=False, default=True)
    ordering = db.Column(db.Integer, default=0)

    # Preferred chart type for analytics visualisation (bar/pie). Optional.
    preferred_chart_type = db.Column(db.String(20), default=None)

    # Explicitly state that this relationship uses the campaign_id foreign key.
    # This resolves the ambiguous foreign key error when joining Campaign and Question.
    campaign = db.relationship(
        "Campaign",
        back_populates="questions",
        foreign_keys=[campaign_id],
    )
    options = db.relationship("Option", back_populates="question", cascade="all, delete-orphan")
    responses = db.relationship("Response", back_populates="question", cascade="all, delete-orphan")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Question {self.id} ({self.question_type})>"


class Option(BaseModel):
    """
    An option is a possible answer for a multiple-choice question. Options are
    ordered implicitly by their ID or by a dedicated label if provided.
    """
    __tablename__ = "options"

    question_id = db.Column(db.Integer, db.ForeignKey("questions.id"), nullable=False)
    text = db.Column(db.Text, nullable=False)
    label = db.Column(db.String(10))

    question = db.relationship("Question", back_populates="options")
    responses = db.relationship("Response", back_populates="option", cascade="all, delete-orphan")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Option {self.id} for Question {self.question_id}>"


class SurveySession(BaseModel):
    """
    Each session represents a unique invitation link for a participant. A
    session tracks its status and holds a unique token used to access the
    survey. When the participant starts the survey, ``started_at`` is set;
    when finished, ``completed_at`` is set.
    """
    __tablename__ = "sessions"

    campaign_id = db.Column(db.Integer, db.ForeignKey("campaigns.id"), nullable=False)
    token = db.Column(db.String(64), unique=True, nullable=False, default=generate_uuid)
    status = db.Column(db.String(20), nullable=False, default="Pending")
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)

    # Maximum number of answers allowed for this session. When set, the
    # server will reject additional responses after this limit is reached.
    max_answers = db.Column(db.Integer)
    # Optional expiration timestamp. If set and the current time is past
    # ``expires_at``, the session is considered expired and will not accept
    # further responses.
    expires_at = db.Column(db.DateTime)

    campaign = db.relationship("Campaign", back_populates="sessions")
    responses = db.relationship("Response", back_populates="session", cascade="all, delete-orphan")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<SurveySession {self.token[:6]}… for Campaign {self.campaign_id}>"


class Response(BaseModel):
    """
    A response records the answer provided by a user (identified via session
    token) to a specific question. Depending on the question type, either
    ``option_id`` or ``answer_text`` is populated. The ``zone_id`` can be
    used to track the participant's region or branch.
    """
    __tablename__ = "responses"

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    session_id = db.Column(db.Integer, db.ForeignKey("sessions.id"), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey("questions.id"), nullable=False)
    option_id = db.Column(db.Integer, db.ForeignKey("options.id"), nullable=True)
    answer_text = db.Column(db.Text)
    zone_id = db.Column(db.String(50), nullable=True)

    # Ensure that each question can be answered only once per session. This
    # constraint prevents multiple submissions to the same question within
    # a session (anti-fraud for contests).
    __table_args__ = (
        db.UniqueConstraint('session_id', 'question_id', name='uq_response_session_question'),
    )

    user = db.relationship("User", back_populates="responses")
    session = db.relationship("SurveySession", back_populates="responses")
    question = db.relationship("Question", back_populates="responses")
    option = db.relationship("Option", back_populates="responses")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Response to Q{self.question_id} in Session {self.session_id}>"


class AuditLog(BaseModel):
    """
    The audit log records significant actions performed by users. This can be
    used to build the "Historique & Logs" page described in the
    specifications. For example: campaign creation, update, deletion, user
    management actions, exports, etc.
    """
    __tablename__ = "audit_logs"

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    action = db.Column(db.String(255), nullable=False)
    details = db.Column(db.Text)

    user = db.relationship("User")

    def __repr__(self) -> str:  # pragma: no cover
        return f"<AuditLog {self.action} by User {self.user_id}>"