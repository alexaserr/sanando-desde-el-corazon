"""
Schemas Pydantic v2 para los endpoints de autenticación.
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    requires_2fa: bool = False


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TwoFactorRequest(BaseModel):
    code: str


class TwoFactorSetupResponse(BaseModel):
    secret: str
    qr_uri: str


class MeData(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    has_2fa: bool
    created_at: datetime


class MeResponse(BaseModel):
    data: MeData
