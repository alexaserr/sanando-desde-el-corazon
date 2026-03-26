"""
Schema Pydantic para registro público de pacientes.

Endpoint público (sin auth) — el frontend en /registro envía estos datos.
NO crea un usuario (tabla users), solo un client + sub-recursos.
Acepta estado civil en español o inglés; normaliza a español para la BD.
"""
from datetime import date

from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Mapeos bidireccionales ────────────────────────────────────

# Inglés → Español (para normalizar valores que llegan del frontend)
_MARITAL_EN_TO_ES: dict[str, str] = {
    "single": "soltero",
    "married": "casado",
    "divorced": "divorciado",
    "widowed": "viudo",
    "common_law": "union_libre",
}

# Español → enum BD (MaritalStatus usa los valores en inglés internamente)
_MARITAL_ES_TO_DB: dict[str, str] = {
    "soltero": "single",
    "casado": "married",
    "divorciado": "divorced",
    "viudo": "widowed",
    "union_libre": "common_law",
}

_ALL_MARITAL_VALUES = set(_MARITAL_ES_TO_DB.keys()) | set(_MARITAL_EN_TO_ES.keys())

_SLEEP_QUALITY_MAP: dict[str, str] = {
    "buena": "good",
    "regular": "regular",
    "mala": "bad",
}


# ── Request ──────────────────────────────────────────────────

class PublicRegisterRequest(BaseModel):
    """Formulario público de registro — todas las secciones."""

    # Sección 1: Datos personales
    full_name: str = Field(..., min_length=1, max_length=300)
    email: EmailStr
    phone: str = Field(..., min_length=10, max_length=20)
    birth_date: date | None = None
    marital_status: str | None = None
    profession: str | None = Field(None, max_length=120)

    # Sección 2: Emociones y motivación
    predominant_emotions: list[str] | None = None
    motivation_visit: list[str] | None = None
    motivation_general: str | None = None

    # Sección 3: Condiciones médicas
    medical_conditions: list[str] | None = None
    recurring_diseases: list[str] | None = None

    # Sección 4: Ubicación
    birth_place: str | None = Field(None, max_length=120)
    residence_place: str | None = Field(None, max_length=120)

    # Sección 5: Familia nuclear
    family_nuclear: str | None = None
    family_nuclear_dynamics: str | None = None
    num_siblings: int | None = Field(None, ge=0, le=30)
    birth_order: int | None = Field(None, ge=1, le=30)
    family_abortions: int | None = Field(None, ge=0)
    family_abortions_detail: str | None = None
    deaths_before_41: str | None = None

    # Sección 6: Familia actual
    family_current: str | None = None
    family_current_dynamics: str | None = None
    num_children: int | None = Field(None, ge=0, le=30)
    num_children_detail: str | None = None

    # Sección 7: Salud y sueño
    sleep_hours: int | None = Field(None, ge=0, le=24)
    sleep_quality: str | None = Field(None, pattern=r"^(buena|regular|mala)$")
    medications: list[str] | None = None
    body_pains: list[str] | None = None

    # Sección 8: Notas
    important_notes: str | None = None

    # ── Validators ───────────────────────────────────────────

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: str) -> str:
        digits = "".join(c for c in v if c.isdigit())
        if len(digits) == 10:
            return f"+52{digits}"
        return v

    @field_validator("birth_date")
    @classmethod
    def birth_date_not_future(cls, v: date | None) -> date | None:
        if v is not None and v > date.today():
            msg = "La fecha de nacimiento no puede ser futura"
            raise ValueError(msg)
        return v

    @field_validator("marital_status")
    @classmethod
    def normalize_marital_status(cls, v: str | None) -> str | None:
        """Acepta español o inglés, normaliza a español."""
        if v is None:
            return None
        v_lower = v.strip().lower()
        if v_lower not in _ALL_MARITAL_VALUES:
            msg = f"Estado civil inválido: {v}"
            raise ValueError(msg)
        # Si viene en inglés, convertir a español
        return _MARITAL_EN_TO_ES.get(v_lower, v_lower)

    # ── Helpers for router ───────────────────────────────────

    @property
    def marital_status_db(self) -> str | None:
        """Convierte estado civil español → enum de BD (inglés)."""
        if self.marital_status is None:
            return None
        return _MARITAL_ES_TO_DB.get(self.marital_status)

    @property
    def sleep_quality_db(self) -> str | None:
        """Convierte calidad de sueño español → enum de BD."""
        if self.sleep_quality is None:
            return None
        return _SLEEP_QUALITY_MAP.get(self.sleep_quality)


# ── Response ─────────────────────────────────────────────────

class PublicRegisterResponse(BaseModel):
    """Respuesta exitosa de registro público."""

    data: "PublicRegisterData"
    message: str = "Registro exitoso"


class PublicRegisterData(BaseModel):
    id: str
    full_name: str
    created_at: str
