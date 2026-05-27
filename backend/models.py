from pydantic import BaseModel, Field
from typing import Optional, Literal


UNIDADES = Literal[
    "g", "kg", "ml", "l",
    "unidad", "unidades",
    "cda", "cdas",   # cucharadas
    "cdita", "cditas",  # cucharaditas
    "taza", "tazas",
    "diente", "dientes",
    "pizca", "al gusto",
]


class Ingrediente(BaseModel):
    nombre: str
    cantidad: float = 0
    unidad: str = "al gusto"
    esencial: bool = True


class Paso(BaseModel):
    texto: str
    tiempo_minutos: Optional[int] = None


class RecetaBase(BaseModel):
    nombre: str
    dificultad: Literal["facil", "media"] = "facil"
    tiempo_minutos: int = Field(gt=0, le=300)
    porciones: int = Field(default=2, gt=0, le=20)
    tipo: Optional[str] = None
    pasos: list[Paso]
    ingredientes_esenciales: list[Ingrediente]
    ingredientes_opcionales: list[Ingrediente] = []


class RecetaCreate(RecetaBase):
    origen: Literal["base", "usuario", "ia"] = "usuario"


class Receta(RecetaBase):
    id: int
    origen: str


class ResultadoBusqueda(BaseModel):
    receta: Receta
    ingredientes_match: list[str]
    ingredientes_faltantes: list[str]
    porcentaje_match: float


class BusquedaRequest(BaseModel):
    ingredientes: list[str]
    tiempo_max: Optional[int] = None
    dificultad: Optional[Literal["facil", "media"]] = None
    tipo: Optional[str] = None
    incluir_faltantes: bool = True
    excluir: list[str] = []
    min_match: float = 0.5


class ParseRecetaRequest(BaseModel):
    texto: str
    api_key: str
    provider: Literal["claude", "openai", "groq"] = "claude"


class SugerirRequest(BaseModel):
    ingredientes: list[str]
    excluir: list[str] = []
    api_key: str
    provider: Literal["claude", "openai", "groq"] = "claude"
