# LLMC

Asistente de cocina que sugiere recetas a partir de los ingredientes disponibles del usuario, combinando una base de recetas local con modelos de lenguaje opcionales (Anthropic, OpenAI, Groq).

### [📥 Descargar APK Android (recomendado)](https://github.com/AaronMon3/LLMC/releases/latest) · [🌐 Probar online](https://aaronmon3.github.io/LLMC/)

> Para uso real se recomienda la APK porque vive en el dispositivo, no depende de cada visita al servidor y aprovecha el aislamiento por aplicación de Android. La versión web es más práctica para una prueba rápida sin instalar nada. Ver detalles en la sección [Seguridad y privacidad](#seguridad-y-privacidad).

---

## Sobre este proyecto

LLMC es un **proyecto personal de experimentación con modelos de lenguaje**. No es un producto comercial, no busca usuarios masivos, no tiene roadmap de monetización y no pretende competir con apps establecidas del mercado.

La motivación fue construir algo concreto y útil con LLMs siguiendo principios claros: cero costos de servidor, autonomía total del usuario sobre sus credenciales, lógica de búsqueda local, y uso del LLM solo donde aporta valor diferencial.

Si a alguien le resulta útil en su día a día, mejor. Si no, sirvió como ejercicio práctico de diseño, arquitectura, integración con APIs externas (Spotify, proveedores LLM) y desarrollo cross-plataforma (web + APK).

## Descripción general

LLMC resuelve un problema cotidiano: tener ingredientes en casa y no saber qué cocinar. La aplicación permite buscar recetas, escalar cantidades según porciones, gestionar una despensa fija, mantener una lista de compras y solicitar sugerencias a un LLM cuando la base local resulta insuficiente.

El proyecto fue diseñado bajo dos restricciones explícitas:

1. **Cero costos de operación.** El usuario provee su propia API key, que se almacena exclusivamente en el navegador. El backend no realiza llamadas a proveedores externos.
2. **Uso eficiente del LLM.** La búsqueda, normalización y ranking son operaciones locales. El modelo de lenguaje solo se invoca para tareas donde aporta valor diferencial: estructurar texto libre, generar variedad y responder consultas contextuales.

## Funcionalidades

### Búsqueda y descubrimiento
- Búsqueda por ingredientes con normalización regional (`jitomate` → `tomate`, `patata` → `papa`, etc.)
- Input por chips con autocompletado desde la base de ingredientes conocidos
- Filtros por tipo de comida, tiempo máximo, dificultad y modo estricto (match completo)
- Ranking dual: por porcentaje de match o por aprovechamiento de ingredientes del usuario
- Catálogo navegable agrupado por tipo de comida

### Detalle y preparación
- Vista paso a paso con tiempo, fuego y temperatura indicados por instrucción
- Selector de porciones que escala cantidades en tiempo real
- Chat contextual con el modelo de lenguaje (sustituciones, técnicas, dudas durante la cocción)
- Botón para agregar ingredientes faltantes a la lista de compras, descontando los que el usuario ya tiene en su despensa

### Gestión personal
- Despensa fija (ingredientes asumidos como siempre disponibles)
- Restricciones dietéticas (excluye recetas que las contengan)
- Búsquedas recientes y guardadas con nombre
- Favoritos e historial de recetas vistas
- Lista de compras con acumulación automática de cantidades y persistencia local

### Integración con LLM
- Carga de recetas externas: el usuario pega texto libre y un agente lo estructura al esquema interno
- Generación de variedad: cuando la base resulta corta, el agente sugiere recetas adicionales que pueden guardarse permanentemente
- Validación server-side anti-recetas-triviales (mínimo de ingredientes y pasos verificados antes de devolver al cliente)
- Soporte multi-proveedor con interfaz unificada

## Arquitectura

```
┌───────────────────────────────────────────────────────────────┐
│  Cliente (Svelte 5 + Vite)                                    │
│  ┌────────────────────────┐    ┌─────────────────────────┐    │
│  │ UI + estado local      │    │ API keys en localStorage│    │
│  │ Router hash propio     │    │ (nunca al backend)      │    │
│  └────────────┬───────────┘    └───────────┬─────────────┘    │
└───────────────┼─────────────────────────────┼─────────────────┘
                │                             │
                │ /api/*                      │ HTTPS directo
                ▼                             ▼
┌─────────────────────────────┐   ┌────────────────────────────┐
│  Backend (FastAPI + SQLite) │   │  Proveedores LLM           │
│  • Búsqueda y ranking       │   │  • Anthropic (Claude)      │
│  • Normalización            │   │  • OpenAI                  │
│  • Agentes LLM como proxy   │◄──┤  • Groq                    │
└─────────────────────────────┘   └────────────────────────────┘
```

El cliente realiza dos tipos de llamadas:

- **Al backend propio**, para operaciones sobre la base de datos local (búsqueda, listado, creación, eliminación). Estas no consumen tokens.
- **Directamente al proveedor LLM**, para el chat contextual de cada receta. Esto evita que el servidor maneje credenciales del usuario.

Las operaciones que requieren prompt complejo y validación (parser y suggester) sí pasan por el backend, que actúa como proxy autenticado con la key del usuario en el cuerpo del request.

## Stack tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| Backend | Python 3.10+, FastAPI | Tipado opcional vía Pydantic, validación automática, ergonomía similar a Express |
| Base de datos | SQLite | Cero infraestructura, suficiente para el dominio, archivo único en deploy |
| LLM SDK | `anthropic`, `openai` | El SDK de OpenAI cubre también Groq vía `base_url` configurable |
| Frontend | Svelte 5 (runes mode), Vite | Bundle ~33 KB gzip, sin virtual DOM, compilación a JS nativo |
| Routing | Hash router propio (~30 líneas) | Las librerías existentes presentaban incompatibilidades parciales con Svelte 5; rolled-own evita dependencia adicional |
| PWA | Service Worker + Web App Manifest | Instalación en móvil sin App Store, cacheo de assets estáticos |
| Estado | Stores nativos de Svelte + localStorage | Persistencia client-side sin necesidad de sesión |

## Decisiones de diseño

**Base curada local en lugar de generación on-demand.** Generar cada receta con LLM tiene tres problemas: costo, latencia y reproducibilidad. La base local resuelve el ~95% de las consultas en milisegundos sin consumo de tokens. El LLM interviene solo cuando agrega valor real.

**API key gestionada por el cliente.** Evita la dependencia de un único proveedor y elimina el costo de infraestructura LLM para el operador del proyecto. El trade-off es mayor fricción inicial para el usuario, mitigado ofreciendo Groq (tier gratuito) como opción por defecto.

**Multi-proveedor con interfaz uniforme.** Los tres proveedores soportados utilizan el SDK de OpenAI (vía `base_url` para Groq) o el SDK propio de Anthropic. La capa de abstracción es mínima y se concentra en el formato de mensajes.

**Ranking dual configurable.** Dos métricas opuestas (porcentaje de match vs. porcentaje de aprovechamiento) cubren intenciones distintas del usuario: "qué puedo cocinar rápido" vs. "qué ingredientes voy a desperdiciar si no uso pronto".

**Prompts con validación estructural.** Tanto el parser como el sugeridor incluyen reglas explícitas sobre fuego, temperatura, tiempos por paso y cantidad mínima de ingredientes. El backend valida la respuesta antes de devolverla al cliente, descartando salidas degeneradas.

**Service worker registrado solo en producción.** Evita interferir con el hot module reload durante desarrollo, mientras provee experiencia offline en deploy.

## Deployment

Las dos partes del sistema se hostean por separado y son **gratuitas** con sus tiers free.

### Frontend en Vercel

```bash
# Conectar repo de GitHub desde dashboard.vercel.com
# Settings → Root Directory: frontend
# Build Command: npm run build
# Output Directory: dist
```

Vercel detecta Vite automáticamente. Cada push a `main` redeploya. El frontend queda en una URL pública con HTTPS, lo que habilita la instalación como PWA en móvil.

### Backend en Render

```bash
# Crear servicio web en render.com
# Build Command: pip install -r backend/requirements.txt && python scripts/seed_recipes.py
# Start Command: cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT
```

Render free duerme tras 15 minutos sin tráfico (cold start ~30s al despertar). El disco no es persistente: las recetas cargadas por usuarios se reinician en cada deploy, por eso la versión web es apta como demo o para producción con plan pago.

### Variable de entorno en Vercel

Configurar `VITE_API_URL` apuntando a la URL del servicio de Render para que el frontend desplegado sepa dónde queda el backend.

### Acceso del usuario final

Una vez deployado, cualquiera puede usar la aplicación desde el navegador o instalarla como PWA en su móvil. La API key del proveedor LLM la carga cada usuario en su navegador (Settings) y nunca se transmite al backend del proyecto.

---

## Instalación local

Requisitos: Python 3.10+, Node.js 18+.

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate  # o .venv\Scripts\activate en Windows
pip install -r requirements.txt
python ../scripts/seed_recipes.py
uvicorn main:app --reload
```

```bash
# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

El frontend queda disponible en `http://localhost:5173` y proxea `/api/*` al backend en `http://localhost:8000`.

Para probar la versión PWA con service worker activo:

```bash
cd frontend
npm run build
npm run preview
```

## Estructura del proyecto

```
.
├── backend/
│   ├── main.py                 Endpoints FastAPI
│   ├── db.py                   Conexión SQLite y operaciones CRUD
│   ├── models.py               Schemas Pydantic
│   ├── search.py               Algoritmo de búsqueda y ranking
│   ├── normalizer.py           Normalización con diccionario de sinónimos
│   ├── recipe_parser.py        Agente: estructurar texto libre a receta
│   ├── recipe_suggester.py     Agente: generar recetas adicionales
│   ├── requirements.txt
│   └── data/
│       ├── recetas.db
│       └── sinonimos.json
├── frontend/
│   ├── src/
│   │   ├── App.svelte
│   │   ├── router.js
│   │   ├── stores.js           Estado persistente
│   │   ├── components/
│   │   │   └── ChipsInput.svelte
│   │   ├── lib/
│   │   │   ├── api.js          Cliente del backend
│   │   │   ├── llm.js          Cliente directo a proveedores LLM
│   │   │   └── format.js       Formato y escalado de cantidades
│   │   └── routes/
│   ├── public/
│   │   ├── manifest.webmanifest
│   │   ├── sw.js
│   │   └── icon-*.png
│   └── vite.config.js
└── scripts/
    └── seed_recipes.py         Población inicial de la base
```

## Estado del proyecto

- 62 recetas iniciales con cantidades, unidades y tiempos por paso
- 42 ingredientes canónicos con ~50 sinónimos regionales
- Bundle frontend: 33 KB gzipped
- 5 dependencias Python, 3 dependencias npm

## Versión Android (APK)

La aplicación se empaqueta como APK Android usando Capacitor. Toda la lógica vive en el dispositivo (búsqueda local, IndexedDB, llamadas LLM directas), sin dependencia de servidor.

### Compilación local

Requiere Android SDK + Java 21.

```bash
cd frontend
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
# APK queda en android/app/build/outputs/apk/debug/app-debug.apk
```

### Compilación automatizada en CI

El repositorio incluye un workflow de GitHub Actions (`.github/workflows/build-android.yml`) que compila la APK en cada push a `main`. El artefacto queda disponible para descarga desde la pestaña Actions del repositorio durante 30 días, sin requerir instalación local de Android SDK.

### Instalación en dispositivo

Habilitar "fuentes desconocidas" en el Android, transferir el APK y abrirlo. No requiere Play Store para distribución directa.

## Seguridad y privacidad

Por la naturaleza del proyecto (cliente sin servidor, API keys del usuario, integración con Spotify y proveedores LLM), se aplicaron medidas concretas de hardening y se documentan honestamente las limitaciones.

### Datos del usuario y dónde viven

- **API keys de LLM** (Groq / Claude / OpenAI) y **tokens de Spotify** se almacenan exclusivamente en el navegador del usuario o en el storage aislado de la APK. Nunca se transmiten a ningún backend propio del proyecto, porque no hay backend.
- Por defecto se utilizan en `sessionStorage` (se eliminan al cerrar la pestaña). El usuario puede opt-in explícitamente a `localStorage` activando el toggle *"Recordar mi key"* en Ajustes.
- Existe un botón *"Borrar todos mis datos"* que limpia localStorage, sessionStorage e IndexedDB de la aplicación.

### Hardening aplicado

- **Content Security Policy** estricta en `index.html` con `script-src 'self'`, `connect-src` whitelisteado a endpoints específicos (Spotify, Anthropic, OpenAI, Groq, Google Fonts), `frame-ancestors 'none'`, `object-src 'none'`.
- **OAuth con PKCE** y validación de parámetro `state` en el callback de Spotify (mitiga CSRF en el flow de autorización).
- **Sin secretos hardcodeados** ni en el código ni en el historial de Git. El Client ID de Spotify es público por diseño del estándar OAuth.
- **Headers de seguridad** adicionales: `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` deshabilitando cámara, micrófono, geolocalización, pagos y USB.
- **`allowBackup=false`** en el manifest Android para evitar que los datos de la aplicación se incluyan en backups automáticos de Google Drive.
- **Renderizado seguro** por defecto: Svelte 5 escapa todo contenido dinámico, no se utiliza `{@html}` ni APIs equivalentes a `innerHTML` en ningún punto.

### Comparación web vs APK

Para uso continuo se recomienda la APK por estas razones:

| Aspecto | APK Android | GitHub Pages |
|---|---|---|
| Determinismo | El código instalado es estable hasta que el usuario actualiza manualmente | Cada visita carga la versión actual del servidor |
| Aislamiento de storage | Sandbox de la aplicación Android | Perfil del navegador, expuesto a otras pestañas y extensiones del mismo origen |
| Extensiones del navegador | No aplica | Pueden leer contenido de la página y storage |
| Compromiso del repositorio | Requiere build + publicación + instalación manual del usuario | Auto-deploy inmediato a todos los usuarios activos |

La APK distribuida en Releases está **firmada con la debug keystore** estándar de Android. Esto es aceptable para un proyecto personal pero implica que el WebView puede inspeccionarse vía Chrome DevTools si alguien tiene acceso físico al dispositivo con USB debug. Para distribución a terceros se recomienda compilar localmente con una keystore propia (ver [Release signing](#release-signing-opcional)).

### Limitaciones conocidas

Las siguientes limitaciones son inherentes al modelo de SPA cliente y se documentan explícitamente:

- **Extensiones maliciosas del navegador** pueden leer contenido de la página y storage. Esto afecta a cualquier aplicación web.
- **Malware local** con acceso al perfil del navegador puede leer credenciales almacenadas.
- **Browser sync** (Chrome / Edge) puede replicar localStorage a la nube del proveedor, dependiendo de la configuración del usuario.
- **Confianza en el mantenedor**: el usuario que abre la versión web confía implícitamente en que el código deployado no es malicioso. El repositorio público y los workflows de CI permiten verificar que el deploy coincide con el código fuente.
- **APK debug-signed**: distribución segura entre conocidos pero no es apta para canales públicos masivos.

### Recomendaciones para el usuario

- En computadoras compartidas o públicas: dejar el toggle *"Recordar mi key"* en OFF (default) y usar el botón *"Borrar todos mis datos"* antes de cerrar el navegador.
- Para uso personal regular: instalar la APK en lugar de usar la versión web.
- Revisar periódicamente las extensiones del navegador instaladas y sus permisos.

### Release signing (opcional)

Si alguien quisiera redistribuir la aplicación oficialmente, los pasos serían:

1. Generar keystore propia: `keytool -genkey -v -keystore llmc-release.keystore -alias llmc -keyalg RSA -keysize 2048 -validity 10000`
2. Almacenar keystore como GitHub Secret base64 (`KEYSTORE_BASE64`) + credenciales como secrets adicionales.
3. Modificar el workflow `build-android.yml` para decodificar el keystore en cada run y ejecutar `./gradlew assembleRelease` en lugar de `assembleDebug`.

No se implementa en este repositorio porque está fuera del alcance del proyecto (uso personal / portfolio, no distribución pública).

## Licencia

MIT
