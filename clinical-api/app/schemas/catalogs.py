"""
Schemas Pydantic para catálogos estáticos:
tipos de terapia, posiciones de chakra, dimensiones energéticas.
"""
from uuid import UUID

from pydantic import BaseModel


class TherapyTypeResponse(BaseModel):
    id: UUID
    name: str
    description: str | None = None

    model_config = {"from_attributes": True}


class ChakraResponse(BaseModel):
    id: UUID
    position: int
    name: str
    color: str | None = None

    model_config = {"from_attributes": True}


class DimensionResponse(BaseModel):
    id: UUID
    name: str
    display_order: int
    is_active: bool

    model_config = {"from_attributes": True}
