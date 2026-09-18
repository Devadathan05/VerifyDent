"""Vercel serverless entry point -- imports the FastAPI app from backend/app/main.py.

Vercel's Python runtime looks for a callable named `app` in this file.
We add the backend directory to sys.path so that `from app.xxx import ...`
resolves correctly without installing the package.
"""
import sys
from pathlib import Path

# Make `backend/` importable so `from app.xxx import ...` works.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Re-export the FastAPI app; Vercel picks it up as the ASGI handler.
from app.main import app  # noqa: E402, F401
