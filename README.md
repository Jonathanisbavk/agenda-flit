# Agenda FLIT Arequipa 2026 — Selector interactivo + Cronograma PDF

Reemplaza la agenda lineal original (un único HTML exportado de WordPress) por una
**app móvil-first** donde cada asistente arma su propio plan: elige actividades
—una por una o un track completo— y descarga un **cronograma personalizado en PDF**
con fechas, horas y detalles.

Mantiene la identidad de FLIT 2026 (gradiente oficial **coral → magenta → violeta**:
`#fe4a24 → #fe0152 → #6f25ee`).

---

## ¿Qué hay aquí?

```
agenda-flit/
├─ Agenda FLIT Arequipa 2026 - FLIT.html   # fuente original (WordPress/Elementor)
├─ tools/
│  ├─ parse_agenda.py                       # extrae HTML (local) → JSON estructurado
│  ├─ scrape_agenda.py                      # descarga la web en vivo y actualiza el JSON
│  └─ admin_server.py                       # panel web para operar el scraper (URL secreta)
└─ app/                                      # aplicación React (el producto)
   ├─ src/
   │  ├─ data/agenda.json                    # 4 días · 7 tracks · 108 actividades (generado)
   │  ├─ types/agenda.ts                     # modelo de datos tipado
   │  ├─ lib/
   │  │  ├─ agenda.ts                         # carga + helpers (orden, itinerario, fechas)
   │  │  └─ pdf.ts                            # generación del cronograma PDF (jsPDF)
   │  ├─ store/SelectionContext.tsx           # selección global + persistencia localStorage
   │  ├─ components/                           # Header, Hero, DayNav, TrackSection,
   │  │                                        # EventCard, BottomSheet, EventDetailSheet,
   │  │                                        # ItineraryModal, SelectionBar
   │  └─ App.tsx
   └─ ...config (Vite, TS, Tailwind v4)
```

## Stack

| Capa            | Tecnología                                   |
|-----------------|----------------------------------------------|
| UI              | **React 18** + **TypeScript** + **Vite 5**   |
| Estilos         | **Tailwind CSS v4** (tokens de marca FLIT)   |
| Iconos          | **lucide-react** (SVG, sin emojis)           |
| PDF             | **jsPDF** + **jspdf-autotable** (lazy-loaded)|
| Datos           | JSON generado desde el HTML con **Python**   |

Decisiones de arquitectura:
- **Separación datos / vista:** el HTML pesado se transforma una sola vez a `agenda.json`.
- **Estado de selección centralizado** en un Context con reducer y persistencia local.
- **PDF en chunk aparte** (`import()` dinámico): no penaliza la carga inicial.
- **Accesible y móvil-first:** targets táctiles ≥44px, foco visible, `prefers-reduced-motion`,
  el color nunca es el único indicador (check + borde + fondo).

---

## Cómo correrlo

```bash
cd app
npm install
npm run dev        # http://localhost:5173
```

Build de producción:

```bash
npm run build      # genera app/dist (estático, desplegable en cualquier hosting)
npm run preview
```

## Mantener la agenda actualizada (web scraping)

La agenda oficial vive en WordPress y los organizadores la editan hasta el evento.
`scrape_agenda.py` **descarga la página en vivo**, la transforma con el mismo parser y
solo reescribe `agenda.json` cuando el contenido realmente cambió.

```bash
python tools/scrape_agenda.py            # descarga, compara y actualiza si cambió
python tools/scrape_agenda.py --check    # solo informa qué cambió (no escribe)
python tools/scrape_agenda.py --force    # reescribe aunque no haya cambios
python tools/scrape_agenda.py --offline  # usa el último HTML cacheado, sin red
```

- **Sin dependencias:** solo la librería estándar de Python (`urllib`), igual que el parser.
- **Detección de cambios:** imprime altas/bajas de eventos (`+`/`-`) y deltas de stats.
- **Validación:** aborta si la página devuelve algo demasiado corto o sin la estructura
  Elementor esperada, para no pisar el JSON con datos rotos.
- **Snapshot + metadata:** guarda el HTML descargado en `tools/.cache/agenda.html` (fallback
  para `--offline`) y la última corrida en `tools/.cache/scrape_meta.json` (ambos ignorados por git).
- **Códigos de salida** (útiles para cron/CI): `0` sin cambios · `2` agenda actualizada · `1` error.

Para mantenerlo siempre fresco, agéndalo (p. ej. cron diario):

```cron
0 7 * * *  cd /ruta/agenda-flit && python tools/scrape_agenda.py >> tools/.cache/scrape.log 2>&1
```

> En Windows usa el **Programador de tareas** ejecutando el mismo comando.

### Panel de administración

Para operar el scraper sin tocar la terminal, hay un **panel web** (servidor de la
librería estándar, sin dependencias) que muestra el estado de la agenda y permite
comprobar/lanzar actualizaciones con un botón.

```bash
python tools/admin_server.py
# imprime en consola la URL secreta y la clave de acceso; ábrela en el navegador
```

- **URL no obvia:** el panel se sirve bajo un *slug* secreto (def. `panel-flit-ops-9k27x`,
  nada de `/admin`). Cualquier otra ruta responde `404`, sin revelar que el panel existe.
- **Acceso con clave:** las acciones requieren un token. Si no defines `FLIT_ADMIN_TOKEN`,
  se genera uno y se guarda en `tools/.cache/admin_token.txt` (estable entre reinicios).
- **Desde el panel** puedes: ver días/tracks/eventos y la última corrida, **comprobar**
  cambios (sin escribir), **actualizar** `agenda.json` en vivo, y revisar el historial (log).

Configuración por variables de entorno (todas opcionales):

| Variable            | Por defecto            | Para qué                          |
|---------------------|------------------------|-----------------------------------|
| `FLIT_ADMIN_SLUG`   | `panel-flit-ops-9k27x` | ruta secreta del panel            |
| `FLIT_ADMIN_TOKEN`  | *(autogenerado)*       | clave de acceso                   |
| `FLIT_ADMIN_HOST`   | `127.0.0.1`            | interfaz de escucha               |
| `FLIT_ADMIN_PORT`   | `8765`                 | puerto                            |

```bash
# ejemplo con slug y clave propios
FLIT_ADMIN_SLUG="ops-7x9k2" FLIT_ADMIN_TOKEN="mi-clave-secreta" python tools/admin_server.py
```

> Pensado para uso local/interno. Para exponerlo en internet, ponlo detrás de HTTPS
> (un reverse proxy) y usa una clave fuerte; escucha en `127.0.0.1` por defecto.

### Regenerar desde el HTML local

Si prefieres partir del HTML exportado incluido en el repo:

```bash
python tools/parse_agenda.py      # reescribe app/src/data/agenda.json desde el .html local
```

Ambos scripts comparten la lógica: `scrape_agenda.py` solo añade la capa de descarga y
comparación. El parser detecta secciones, días, horarios, categorías (conferencia, panel,
pitch…), ponentes y país, y marca pausas (almuerzo/descanso) como no seleccionables.

---

## Cómo se usa la app

1. **Explora por día** con las pestañas superiores (Mié 15 · Jue 16 · Vie 17 · Sáb 18).
2. **Elige actividades** tocando el círculo de cada tarjeta, o **«Elegir todo»** para un
   track completo.
3. **Busca** charlas, temas o ponentes desde la barra superior.
4. Toca una tarjeta para ver el **detalle** (ponentes, país, horario).
5. Abre **«Mi plan»** para revisar tu cronograma y pulsa **«Descargar PDF»** o
   **«Añadir a Google Calendar»** (si está configurado, ver abajo).

Tu selección queda guardada en el dispositivo (localStorage).

---

## Conectar con Google Calendar

La app puede insertar **todas las charlas seleccionadas** en un calendario dedicado
**«FLIT Arequipa 2026»** del asistente (login con Google, sin backend). Si no se configura,
el botón simplemente no aparece y el PDF sigue funcionando.

### 1. Crear el OAuth Client ID (una sola vez)

1. En [Google Cloud Console](https://console.cloud.google.com/) crea un proyecto.
2. **APIs y servicios → Biblioteca →** habilita **Google Calendar API**.
3. **Pantalla de consentimiento de OAuth:** tipo *Externo*; añade el scope
   `https://www.googleapis.com/auth/calendar.app.created` (permite crear calendarios
   secundarios y gestionar solo los eventos de los que crea la app).
   Mientras esté en modo *Testing*, agrega los correos de prueba en **Test users**.
4. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web.**
   En **Orígenes de JavaScript autorizados** añade `http://localhost:5173` (desarrollo) y
   el dominio de producción (p. ej. `https://tu-dominio`).
5. Copia el **Client ID**.

### 2. Configurar la app

```bash
cd app
cp .env.example .env
# edita .env y pega tu Client ID en VITE_GOOGLE_CLIENT_ID
```

Reinicia `npm run dev` para que Vite tome la variable.

### Notas

- **Idempotente:** volver a pulsar el botón no duplica eventos (las charlas ya añadidas se omiten).
- **Solo añade:** quitar una charla en la app no la borra del calendario.
- **App no verificada:** fuera del modo *Testing*, Google exige verificar la app para este scope;
  hasta entonces los usuarios verán un aviso de «app no verificada».
#   a g e n d a - f l i t  
 