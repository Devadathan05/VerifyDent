"""Re-export the declarative Base for SQLAlchemy models."""

from app.db.session import Base

__all__ = ["Base"]