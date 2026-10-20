import hmac
import hashlib
import json
import base64
import time
from fastapi import HTTPException, Header, Depends
from typing import Optional

try:
    from .database import get_db
except (ImportError, ValueError):
    from database import get_db

SECRET_KEY = "teacher_reviewer_secret_key_314159_maxim"

def create_token(user_id: int, role: str, username: str) -> str:
    payload = {
        "uid": user_id,
        "role": role,
        "username": username,
        "iat": int(time.time()),
        "exp": int(time.time()) + 30 * 86400 # 30 days
    }
    payload_bytes = json.dumps(payload).encode("utf-8")
    b64_payload = base64.urlsafe_b64encode(payload_bytes).decode("utf-8").rstrip("=")
    sig = hmac.new(SECRET_KEY.encode("utf-8"), b64_payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{b64_payload}.{sig}"

def verify_token(token: str) -> dict:
    try:
        parts = token.split(".")
        if len(parts) != 2:
            raise ValueError("Invalid format")
        b64_payload, sig = parts
        expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), b64_payload.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            raise ValueError("Signature mismatch")
        
        # Add back padding
        pad = len(b64_payload) % 4
        if pad:
            b64_payload += "=" * (4 - pad)
        payload = json.loads(base64.urlsafe_b64decode(b64_payload.encode("utf-8")).decode("utf-8"))
        
        if payload.get("exp", 0) < time.time():
            raise ValueError("Token expired")
        return payload
    except Exception as e:
        raise HTTPException(status_code=401, detail="Неверный или устаревший токен авторизации")

def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    
    token = authorization
    if token.startswith("Bearer "):
        token = token[7:].strip()
        
    payload = verify_token(token)
    user_id = payload.get("uid")
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.username, u.name, u.role, u.class_id, c.name as class_name
        FROM users u
        LEFT JOIN classes c ON u.class_id = c.id
        WHERE u.id = ?
    """, (user_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    
    return dict(row)

def require_teacher(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Доступ разрешен только учителю")
    return user

def require_student(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Доступ разрешен только ученикам")
    return user
