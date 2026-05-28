import pytest
from unittest.mock import MagicMock
from app.services.auth_service import register, login
from app.core.security import hash_password


def make_db():
    return MagicMock()


def test_register_returns_token():
    db = make_db()
    db.query.return_value.filter.return_value.first.return_value = None
    fake_user = MagicMock()
    fake_user.email = "test@example.com"
    db.add = MagicMock()
    db.commit = MagicMock()
    db.refresh = MagicMock(side_effect=lambda u: setattr(u, "email", "test@example.com"))

    result = register(db, name="Test", email="test@example.com", password="secret123")
    assert "access_token" in result


def test_login_with_wrong_password_raises():
    from fastapi import HTTPException
    db = make_db()
    fake_user = MagicMock()
    fake_user.hashed_password = hash_password("correctpassword")
    db.query.return_value.filter.return_value.first.return_value = fake_user

    with pytest.raises(HTTPException):
        login(db, email="test@example.com", password="wrongpassword")


def test_login_with_nonexistent_user_raises():
    from fastapi import HTTPException
    db = make_db()
    db.query.return_value.filter.return_value.first.return_value = None

    with pytest.raises(HTTPException):
        login(db, email="nobody@example.com", password="anything")
