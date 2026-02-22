<!--
API documentation for the Survey Bot backend.

This document provides an overview of the REST endpoints available in the
Survey Bot API, including their purpose, parameters and responses. The
endpoints are grouped by functionality (authentication, campaigns,
questions, sessions, bot, statistics and export). Wherever a JWT token is
required, the caller must send an `Authorization: Bearer <token>` header.
To obtain a token, log in using `/api/auth/login` (see below).
-->

# Survey Bot API Documentation

## Base URL

All endpoints are prefixed with `/api`. For example, the login endpoint is
`/api/auth/login`. Unless specified otherwise, the API returns JSON
responses.

## Authentication

### POST `/api/auth/login`

Authenticate a user and obtain a JWT access token and refresh token.

- **Request body:**
  ```json
  {
    "login": "username",
    "password": "password"
  }
  ```

- **Response:**
  - `200 OK` with JSON containing `access_token`, `refresh_token` and user
    information.
  - `401 Unauthorized` if credentials are invalid.

### POST `/api/auth/register`

Create a new user account. Only available in development mode or with
appropriate role. Not intended for public sign‑up in production.

- **Request body:**
  ```json
  {
    "login": "username",
    "password": "password",
    "role": "admin|campaign_manager|viewer"
  }
  ```

- **Response:** `201 Created` with the new user’s details.

### POST `/api/auth/refresh`

Obtain a new access token given a valid refresh token.

- **Request header:** `Authorization: Bearer <refresh_token>`
- **Response:** `200 OK` with a new `access_token`.

## Campaigns

### GET `/api/campaigns/`

List all campaigns. Returns an array of campaigns.

**Requires:** JWT with role `admin`, `campaign_manager` or `viewer`.

### POST `/api/campaigns/`

Create a new campaign.

- **Request body:**
  ```json
  {
    "title": "Campaign title",
    "description": "Optional description",
    "start_date": "2026-02-13",   // optional
    "end_date": "2026-03-01",     // optional
    "status": "Draft|Active|Closed"
  }
  ```

- **Response:** `201 Created` with the new campaign details.

### GET `/api/campaigns/<id>`

Retrieve a specific campaign by its ID.

### PUT `/api/campaigns/<id>`

Update a campaign. The body can include any of the fields accepted when
creating a campaign.

### DELETE `/api/campaigns/<id>`

Delete a campaign.

## Questions

### POST `/api/campaigns/<id>/questions`

Add a question to a campaign.

- **Request body:**
  ```json
  {
    "question_text": "What is your favourite colour?",
    "question_type": "single_choice|multiple_choice|text|rating",
    "is_required": true,
    "options": [
      { "label": "A", "text": "Red" },
      { "label": "B", "text": "Blue" },
      { "label": "C", "text": "Green" }
    ]
  }
  ```

- **Response:** `201 Created` with the question details.

### GET `/api/campaigns/<id>/questions`

List all questions for a campaign.

### PUT `/api/questions/<question_id>`

Update an existing question. Accepts the same fields as when creating a
question.

### DELETE `/api/questions/<question_id>`

Remove a question and its associated options and responses.

## Sessions

### POST `/api/campaigns/<id>/sessions`

Generate survey sessions (unique participation tokens) for a campaign.

- **Request body:**
  ```json
  { "count": 10 }
  ```

  Creates 10 survey sessions. Each session has a unique `token` that
  participants use to take the survey.

- **Response:** `201 Created` with an array of sessions, each containing
  `session_id`, `token`, `survey_url` and a base64‑encoded QR code image.

## Bot / Survey

### GET `/api/bot/<token>`

Retrieve the next question for a participant. Does not require
authentication; the participant is identified by the session token in the URL.

- **Response:**
  - If there are remaining questions: JSON with `question_id`,
    `question_text`, `question_type` and, for choice questions, an array of
    options with their ids, labels and texts.
  - If the survey is completed: `{ "message": "Survey completed" }`.

### POST `/api/bot/<token>/answer`

Submit an answer to the current question.

- **Request body (choice questions):**
  ```json
  {
    "question_id": 5,
    "option_id": 12,
    "zone_id": "Lome"
  }
  ```

- **Request body (text questions):**
  ```json
  {
    "question_id": 6,
    "answer_text": "My answer",
    "zone_id": "Lome"
  }
  ```

- **Response:**
  - `200 OK` when the answer is recorded and the next question will be
    available via the GET endpoint.
  - `409 Conflict` if the question was already answered in this session.

## Statistics

### GET `/api/campaigns/<id>/stats`

Return detailed statistics for a campaign. The response includes:

- `campaign_id`: the campaign ID.
- `total_responses`: number of responses submitted.
- `total_sessions`: number of unique participants.
- `questions`: an array of questions. Each question includes its text,
  type and, for choice questions, an array of options with vote counts. For
  open questions, the total number of answers is returned.

Requires a JWT with role `admin`, `campaign_manager` or `viewer`.

### GET `/api/stats/overview`

Return an overview of statistics across all campaigns. The response is a
list of campaigns with their ID, title, total responses and total
participants. This endpoint is useful for dashboards and comparative
charts.

## Export

### GET `/api/campaigns/<id>/export`

Export all responses for a campaign. Use the `format` query parameter to
choose the file type. Supported formats:

- `csv` — comma‑separated values.
- `xlsx` — Excel workbook (responses sheet).
- `pdf` — PDF table of responses.
- `powerbi` — Excel workbook with an additional “Stats” sheet. This file
  can be imported directly into Power BI.

- **Example:** `/api/campaigns/2/export?format=xlsx`

- **Response:** JSON with three fields:
  - `file_name`: suggested filename.
  - `content_type`: MIME type.
  - `data_base64`: the file encoded as a base64 string. The client must
    decode this value to obtain the binary file.

## QR Codes

### GET `/api/campaigns/<id>/sessions/<session_id>/qr.png`

Download the QR code image (PNG) for a specific session. The QR code
contains the public survey URL.

- **Headers:** `Authorization: Bearer <access_token>`
- **Response:** Binary PNG image.

### GET `/api/campaigns/<id>/qr-sheet.pdf`

Generate a PDF sheet of QR codes for the given campaign. Each QR code
represents a unique session. Query parameters:

- `count`: number of sessions to generate (default: 10).
- `per_page`: how many QR codes per page (default: 30). Adjust for
  layouts such as labels or stickers.
- `title`, `subtitle`, `cta`: optional strings displayed on the sheet.

- **Headers:** `Authorization: Bearer <access_token>`
- **Response:** PDF file.

## Health Check

The Docker configuration includes a healthcheck for the MySQL service. The
backend service does not start until the database is ready. See
`docker-compose.yml` for details.

## Notes

- All routes starting with `/api` return JSON unless noted otherwise. Bot
  endpoints (`/api/bot/...`) are public; all other endpoints require a
  valid JWT obtained via the login endpoint.
- Roles control access to administrative endpoints. Admins can do
  everything; campaign managers can create and manage campaigns; viewers
  can view statistics and exports.
- Dates should be formatted as `YYYY-MM-DD` strings.
