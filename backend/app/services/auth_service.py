from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password, create_access_token
from app.repositories import user_repo


def register(db: Session, name: str, email: str, password: str) -> dict:
    if user_repo.get_by_email(db, email):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    hashed = hash_password(password)
    user = user_repo.create(db, name=name, email=email, hashed_password=hashed)
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


def login(db: Session, email: str, password: str) -> dict:
    user = user_repo.get_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}
