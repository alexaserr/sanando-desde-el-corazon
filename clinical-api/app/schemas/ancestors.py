"""
Schemas Pydantic para ancestros sistémicos por sesión.

session_ancestors: miembros del árbol familiar, roles y vínculos energéticos.
session_ancestor_conciliation: frases de sanación y conciliación (1:1 por sesión).
"""
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

_LINEAGE_VALUES = frozenset({"materno", "paterno", "ambos"})
_BOND_ENERGY_VALUES = frozenset({
    "pertenencia", "jerarquia", "amor_interrumpido",
    "lealtad_ciega", "compensacion", "sanacion",
})
_ROLE_VALUES = frozenset({
    "el_que_da", "el_que_recibe", "el_que_carga", "el_excluido", "el_reemplazo",
    "el_identificado", "el_que_repite", "el_sanador", "sostiene_lealtad", "el_no_visto",
})


class AncestorItem(BaseModel):
    member: str | None = Field(None, max_length=200)
    lineage: str | None = Field(None, description="materno | paterno | ambos")
    bond_energy: list[str] | None = None
    ancestor_roles: list[str] | None = None
    consultant_roles: list[str] | None = None
    energy_expressions: list[dict[str, Any]] | None = None  # [{number, expression}]
    family_traumas: list[dict[str, Any]] | None = None       # [{number, trauma}]


class AncestorConciliationItem(BaseModel):
    healing_phrases: str | None = None
    conciliation_acts: str | None = None
    life_aspects_affected: str | None = None
    session_relationship: str | None = None


class AncestorsUpdate(BaseModel):
    ancestors: list[AncestorItem] = Field(default_factory=list)
    conciliation: AncestorConciliationItem | None = None


class AncestorResponse(BaseModel):
    id: UUID
    member: str | None = None
    lineage: str | None = None
    bond_energy: list[str] | None = None
    ancestor_roles: list[str] | None = None
    consultant_roles: list[str] | None = None
    energy_expressions: list[dict[str, Any]] | None = None
    family_traumas: list[dict[str, Any]] | None = None
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


class AncestorConciliationResponse(BaseModel):
    id: UUID
    healing_phrases: str | None = None
    conciliation_acts: str | None = None
    life_aspects_affected: str | None = None
    session_relationship: str | None = None
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


class AncestorsGetResponse(BaseModel):
    ancestors: list[AncestorResponse]
    conciliation: AncestorConciliationResponse | None = None
