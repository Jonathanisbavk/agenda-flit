# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Interactive, mobile-first agenda selector for **FLIT Arequipa 2026**. Each attendee builds a
personal schedule by picking talks (one-by-one or a whole track) and exports it as a **PDF**,
an **`.ics` file**, or pushes it straight into their **Google Calendar**. No backend: the app
is fully static and all state lives in the browser.

The repo has two halves:
- `tools/` — a **Python data pipeline** (stdlib only) that turns the official WordPress/Elementor
  HTML into structured JSON.
- `app/` — the **React product** that consumes that JSON.

## Commands

The React app lives in the `app/` subdirectory — run npm commands from there (this matters for
deploys too: Vercel Root Directory must be `app`).

```bash
cd app
npm install
npm run dev        # Vite dev server → http://localhost:5173
npm run build      # tsc -b && vite build → app/dist (static)
npm run preview    # serve the production build
```

There is no test suite, linter, or CI config in this repo — `npm run build` (which runs `tsc -b`
first) is the type-check/verification gate.

### Data pipeline (Python 3, no dependencies)

```bash
python tools/parse_agenda.py            # regenerate agenda.json from the local .html snapshot
python tools/scrape_agenda.py           # download live site, diff, rewrite agenda.json if changed
python tools/scrape_agenda.py --check   # report changes only, don't write
python tools/scrape_agenda.py --force   # rewrite even if unchanged
python tools/scrape_agenda.py --offline # use cached HTML in tools/.cache, no network
python tools/admin_server.py            # secret-slug web panel to run the scraper (prints URL + token)
```

`scrape_agenda.py` reuses `parse_agenda.build_payload` — the scraper is just a download+diff layer
over the same parser. Exit codes (for cron/CI): `0` no change · `2` updated · `1` error.

## Architecture

### Data flow (build-time, one-way)

```
Agenda FLIT ... .html  ──parse_agenda.py──▶  app/src/data/agenda.json  ──import──▶  React app
        (or live site) ──scrape_agenda.py──▶  (regenerated, not hand-edited)
```

`agenda.json` is **generated output** — never edit it by hand; change the parser and re-run.
It is imported directly (`import rawData from "../data/agenda.json"` in `app/src/lib/agenda.ts`),
so it is bundled into the JS at build time. The data model is defined in `app/src/types/agenda.ts`:
`Agenda → Day[] → Track[] → AgendaEvent[]`, with `Speaker[]` on events. Events flagged
`isBreak: true` (lunch/coffee) are non-selectable.

### Selection state — the core of the app

`app/src/store/SelectionContext.tsx` holds the single source of truth: a `Set<string>` of
selected **event ids**, managed by a reducer and mirrored to `localStorage`
(key `flit-agenda-2026.selection`). Everything downstream is derived from this id set — nothing
duplicates event data into the selection. Access it only via the `useSelection()` hook.

`app/src/lib/agenda.ts` contains the pure derivation helpers used everywhere:
- `buildItinerary(selected)` → enriches selected ids with day/track context (`SelectedEvent`) and
  sorts chronologically. This is the shared input to **all three exporters**.
- `groupByDay`, `selectableEvents`, `toMinutes`, `shortDate`/`longDate`, `trackTitleByEvent`.

### Export layers (all lazy-loaded via dynamic `import()`)

Each exporter is a React-free module in `app/src/lib/`, code-split so it never weighs down initial
load (mirror the same pattern for any new heavy feature):
- `pdf.ts` — jsPDF + jspdf-autotable schedule.
- `ics.ts` — universal `.ics` download; the always-available fallback.
- `gcal.ts` — direct push to Google Calendar (see below).

`ItineraryModal.tsx` orchestrates the UI and chooses gcal-vs-ics based on whether OAuth is
configured.

### Google Calendar integration

- **No backend / no client secret.** Uses Google Identity Services (GIS) token flow, loaded from a
  `<script>` at runtime; the REST Calendar v3 API is called with a bearer token via `fetch`.
- **Gated by env:** `VITE_GOOGLE_CLIENT_ID` (in `app/.env`, copied from `.env.example`). When empty,
  `GCAL_ENABLED`/`isGoogleCalendarEnabled()` is false and the button falls back to `.ics`. Vite
  inlines this at **build time** — restart dev / redeploy after changing it.
- **Scope:** `calendar.app.created` (minimal — create secondary calendars, manage only app-created
  events). Creates/reuses a dedicated calendar named "FLIT Arequipa 2026" (its id cached in
  `localStorage` under `flit-agenda-2026.gcalId`).
- **Idempotent:** each event gets a deterministic id (`eventId()`), so re-running skips (HTTP 409)
  instead of duplicating. It only ever adds — deselecting in the app never deletes from the calendar.
- The GIS `window.google` types are hand-declared in `app/src/vite-env.d.ts`.

### Conventions

- **Time zone is fixed America/Lima (UTC-5, no DST).** `gcal.ts` emits RFC3339 with `-05:00`;
  `ics.ts` emits UTC (`Z`). Do not introduce DST logic.
- **Everything keys off the event `id`** — selection, itinerary, calendar idempotency, the
  `id → track title` map. Preserve id stability when touching the parser.
- **Styling:** Tailwind CSS v4 with FLIT brand tokens (coral→magenta→violet gradient
  `#fe4a24 → #fe0152 → #6f25ee`). Icons are lucide-react SVGs — no emojis.
- **Accessibility / mobile-first:** touch targets ≥44px, visible focus, `prefers-reduced-motion`,
  and color is never the only state indicator (check + border + fill together).
