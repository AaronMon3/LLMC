# 🍳 LLMC

Asistente de cocina que te sugiere recetas a partir de los ingredientes que tenés en casa.

**Open source · Cero costos de servidor · La búsqueda no consume tokens del LLM.**

## ¿Por qué existe?

El problema clásico: abrís la heladera, tenés un par de cosas, no sabés qué cocinar.
Las apps de recetas suelen tener UI saturada, suscripciones, ingredientes raros o están atadas a un proveedor de IA caro.

**LLMC** es un cuaderno de recetas digital con:
- Búsqueda local instantánea (sin tokens)
- IA opcional para casos donde la base se queda corta — y vos ponés tu propia API key
- Diseño tipo cuaderno casero, no parece un wrapper de ChatGPT

## Filosofía

| | |
|---|---|
| Base de recetas | Local (SQLite), curada |
| Búsqueda y ranking | SQL puro + algoritmo en Python — **0 tokens** |
| Sinónimos regionales | Diccionario local (~50 entradas) |
| Estructurar recetas externas | LLM — 1 sola llamada, queda guardada |
| Chat de dudas en una receta | LLM — pocos tokens por pregunta |
| Generar variedad con IA | LLM — 1 llamada, sugiere 3 recetas |

**~95% de las interacciones no tocan el LLM.**

## Funcionalidades

### Core
- 🔍 Buscar recetas por ingredientes (con sinónimos: jitomate = tomate)
- 📋 Ver paso a paso, con tiempo estimado por paso
- 🍽️ Selector de porciones que **escala cantidades** en vivo
- 💡 Botón "Generar más opciones" — IA sugiere recetas distintas a las de la base

### Personal
- ⭐ Favoritos + historial local
- 🧾 Despensa fija (ingredientes que siempre tenés)
- 🚫 Restricciones (alergias, lo que no comés)
- 💾 Búsquedas guardadas y recientes

### Carga de recetas
- ➕ Pegar una receta de texto libre → la IA la estructura
- ✂️ Editás antes de guardarla
- 🗑️ Borrar cualquier receta de tu cuaderno

### Chat
- 💬 Botón flotante en cada receta para preguntar dudas al chef IA
- "¿Puedo cambiar X por Y?" / "¿Cómo sé si está listo?" / "¿Sin horno?"

## Multi-proveedor LLM

Vos elegís qué proveedor usar — y ponés tu propia API key (se guarda solo en tu navegador):

- **Groq** (gratis, sin tarjeta) — recomendado para empezar
- **Claude** (Anthropic)
- **OpenAI** (gpt-4o-mini)

## Stack

- **Backend**: Python 3.10+ · FastAPI · SQLite
- **Frontend**: Svelte 5 (runes mode) · Vite · Router hash propio
- **PWA**: instalable en móvil, funciona offline para recetas vistas

## Cómo correrlo

```bash
# Backend
cd backend
pip install -r requirements.txt
python ../scripts/seed_recipes.py    # primera vez
uvicorn main:app --reload

# Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

Frontend en `http://localhost:5173`, backend en `http://localhost:8000`.

Para probar PWA y service worker:
```bash
cd frontend && npm run build && npm run preview
```

## Estructura del proyecto

```
cocina-app/
├── backend/
│   ├── main.py              FastAPI endpoints
│   ├── db.py                SQLite (schema + CRUD)
│   ├── models.py            Pydantic
│   ├── search.py            Algoritmo de búsqueda + ranking
│   ├── normalizer.py        Sinónimos de ingredientes
│   ├── recipe_parser.py     Agente: parsear receta libre
│   ├── recipe_suggester.py  Agente: sugerir recetas nuevas
│   └── data/
│       ├── recetas.db
│       └── sinonimos.json
├── frontend/
│   └── src/
│       ├── App.svelte
│       ├── router.js        Router hash propio
│       ├── stores.js        Estado persistente (localStorage)
│       ├── components/
│       │   └── ChipsInput.svelte
│       ├── lib/
│       │   ├── api.js
│       │   ├── llm.js       Llamadas directas a Claude/OpenAI/Groq
│       │   └── format.js
│       └── routes/
│           ├── Home.svelte
│           ├── Results.svelte
│           ├── Recipe.svelte
│           ├── Upload.svelte
│           ├── Settings.svelte
│           ├── Favorites.svelte
│           └── All.svelte
└── scripts/
    └── seed_recipes.py
```

## Estado actual

- **62 recetas** en la base (almuerzos, cenas, postres, desayunos, guarniciones)
- **42 ingredientes** únicos con **~50 sinónimos**
- Bundle frontend: ~33 KB gzip
- Backend: 5 dependencias Python
- Costo mensual para el dueño: **$0**

## Cómo contribuir

Ideas para sumar (PRs bienvenidos):
- Más recetas (editar `scripts/seed_recipes.py`)
- Más sinónimos (editar `backend/data/sinonimos.json`)
- Lista de compras automática
- Modo "usá todo lo que tengo" (ranking alternativo)
- Foto de ingredientes (visión)
- Compartir recetas por link
- Multi-idioma
- Importar receta desde URL

## Licencia

MIT. Hacé lo que quieras con el código.
