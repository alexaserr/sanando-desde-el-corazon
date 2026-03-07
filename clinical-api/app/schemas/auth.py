"""
Schemas Pydantic v2 para los endpoints de autenticación.
"""
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
