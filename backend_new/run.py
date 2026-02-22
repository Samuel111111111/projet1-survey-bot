"""
Entry point for running the Survey Bot backend.

This file creates a Flask application using the factory pattern and runs it.
It reads configuration from environment variables and falls back to sensible
defaults suitable for development. In production you should configure a
proper WSGI/ASGI server (e.g. gunicorn or uvicorn) to serve the app.
"""

import os

from app import create_app


def main() -> None:
    """Create and run the Flask application."""
    # Create the application with the default configuration. The config
    # selection can be driven by the FLASK_CONFIG environment variable if
    # needed (e.g. "development", "production", "testing").
    config_name = os.getenv("FLASK_CONFIG", "default")
    app = create_app(config_name=config_name)

    # Bind host/port from environment or use defaults
    host = os.getenv("FLASK_RUN_HOST", "0.0.0.0")
    port = int(os.getenv("FLASK_RUN_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "true").lower() in {"1", "true", "yes"}

    # Run the app
    app.run(host=host, port=port, debug=debug)


if __name__ == "__main__":
    main()