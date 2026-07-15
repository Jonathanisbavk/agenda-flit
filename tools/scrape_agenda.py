#!/usr/bin/env python3
"""
scrape_agenda.py
Web scraper de la agenda oficial de FLIT Arequipa 2026.

Descarga el HTML en vivo desde flit.com.pe, lo transforma con el parser ya
existente (parse_agenda.build_payload) y mantiene actualizado
app/src/data/agenda.json. Detecta cambios y solo reescribe el JSON cuando el
contenido realmente cambió.

Uso:
    python tools/scrape_agenda.py            # descarga, compara y actualiza si cambió
    python tools/scrape_agenda.py --force    # reescribe aunque no haya cambios
    python tools/scrape_agenda.py --check    # solo informa si hay cambios (no escribe)
    python tools/scrape_agenda.py --offline  # usa el HTML cacheado, sin red

Códigos de salida (útiles para cron/CI):
    0 = sin cambios          1 = error          2 = agenda actualizada (hubo cambios)

Sin dependencias externas: solo librería estándar de Python.
"""
from __future__ import annotations

import argparse
import json
import ssl
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# Reutiliza toda la lógica de parseo del HTML.
import parse_agenda as parser

URL = "https://flit.com.pe/agenda-flit-arequipa-2026/"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "app" / "src" / "data" / "agenda.json"
CACHE_HTML = ROOT / "tools" / ".cache" / "agenda.html"
META_FILE = ROOT / "tools" / ".cache" / "scrape_meta.json"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# Marcadores de Elementor que el parser necesita para encontrar contenido.
REQUIRED_MARKERS = [
    "elementor-icon-list-text",
    "elementor-widget-text-editor",
    "Mainstage",
]


def fetch_html(url: str = URL, retries: int = 3, timeout: int = 30) -> str:
    """Descarga el HTML de la página con reintentos y User-Agent de navegador."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    ctx = ssl.create_default_context()
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
                charset = resp.headers.get_content_charset() or "utf-8"
                return resp.read().decode(charset, errors="ignore")
        except (urllib.error.URLError, TimeoutError) as exc:
            last_err = exc
            print(f"  intento {attempt}/{retries} falló: {exc}", file=sys.stderr)
    raise RuntimeError(f"No se pudo descargar {url}: {last_err}")


def validate(doc: str) -> None:
    """Verifica que el HTML descargado tenga la estructura esperada."""
    if len(doc) < 50_000:
        raise RuntimeError(f"HTML sospechosamente corto ({len(doc)} bytes); ¿bloqueo o error?")
    missing = [m for m in REQUIRED_MARKERS if m not in doc]
    if missing:
        raise RuntimeError(
            "La estructura de la página cambió: faltan marcadores "
            f"{missing}. Revisa el parser antes de confiar en el JSON."
        )


def load_json(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def diff_summary(old: dict | None, new: dict) -> list[str]:
    """Describe en lenguaje humano qué cambió entre dos payloads."""
    if old is None:
        return ["agenda.json no existía: primera generación"]
    changes: list[str] = []
    os_, ns = old.get("stats", {}), new.get("stats", {})
    for key, label in (("days", "días"), ("tracks", "tracks"), ("events", "eventos")):
        if os_.get(key) != ns.get(key):
            changes.append(f"{label}: {os_.get(key)} -> {ns.get(key)}")

    # Comparar títulos de eventos por día/track para señalar altas y bajas.
    def event_titles(payload: dict) -> set[str]:
        out = set()
        for d in payload.get("days", []):
            for t in d.get("tracks", []):
                for ev in t.get("events", []):
                    out.add(f"{d.get('date')}|{ev.get('time')}|{ev.get('title')}")
        return out

    old_t, new_t = event_titles(old), event_titles(new)
    added, removed = new_t - old_t, old_t - new_t
    for item in sorted(added):
        changes.append(f"+ {item}")
    for item in sorted(removed):
        changes.append(f"- {item}")
    return changes


def write_meta(changed: bool, source: str) -> None:
    META_FILE.parent.mkdir(parents=True, exist_ok=True)
    META_FILE.write_text(
        json.dumps(
            {
                "lastRun": datetime.now(timezone.utc).isoformat(),
                "url": URL,
                "source": source,
                "changed": changed,
            },
            indent=2,
        ),
        encoding="utf-8",
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Scraper de la agenda FLIT 2026.")
    ap.add_argument("--force", action="store_true", help="reescribe aunque no haya cambios")
    ap.add_argument("--check", action="store_true", help="solo informa, no escribe nada")
    ap.add_argument("--offline", action="store_true", help="usa el HTML cacheado, sin red")
    args = ap.parse_args()

    # 1) Obtener el HTML (red o caché).
    if args.offline:
        if not CACHE_HTML.exists():
            print("ERROR: no hay HTML cacheado para modo --offline", file=sys.stderr)
            return 1
        print(f"Leyendo HTML cacheado: {CACHE_HTML}")
        doc = CACHE_HTML.read_text(encoding="utf-8", errors="ignore")
        source = "cache"
    else:
        print(f"Descargando {URL} ...")
        try:
            doc = fetch_html()
        except RuntimeError as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 1
        source = "live"

    # 2) Validar y parsear.
    try:
        validate(doc)
        payload = parser.build_payload(doc)
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    if not payload["days"]:
        print("ERROR: el parser no encontró ningún día/evento", file=sys.stderr)
        return 1

    # Guardar copia cruda del HTML descargado (snapshot / fallback offline).
    if source == "live":
        CACHE_HTML.parent.mkdir(parents=True, exist_ok=True)
        CACHE_HTML.write_text(doc, encoding="utf-8")

    # 3) Comparar con el JSON actual.
    old = load_json(OUT)
    new_norm = json.loads(json.dumps(payload, ensure_ascii=False))
    changed = old != new_norm

    parser.summarize(payload)

    if not changed and not args.force:
        print("Sin cambios: agenda.json ya está actualizado.")
        if not args.check:
            write_meta(False, source)
        return 0

    changes = diff_summary(old, payload)
    print("\nCambios detectados:")
    for line in changes[:40]:
        print(f"  {line}")
    if len(changes) > 40:
        print(f"  ... y {len(changes) - 40} cambios más")

    if args.check:
        print("\n(modo --check: no se escribió nada)")
        return 2

    parser.write_payload(payload, OUT)
    write_meta(True, source)
    print(f"\nOK -> agenda actualizada en {OUT}")
    return 2


if __name__ == "__main__":
    sys.exit(main())
