#!/usr/bin/env python3
"""
admin_server.py
Panel de administración del web scraper de la agenda FLIT Arequipa 2026.

Sirve un pequeño dashboard web (solo librería estándar de Python) desde donde un
operador puede:
  - Ver el estado actual de la agenda (días, tracks, eventos) y la última corrida.
  - Comprobar si la web oficial tiene cambios sin tocar el JSON  (botón "Comprobar").
  - Lanzar la actualización de agenda.json en vivo            (botón "Actualizar").
  - Ver la salida/diff de la última ejecución y el historial (log).

Seguridad mínima:
  - La ruta NO es obvia: se sirve bajo un slug secreto configurable. Cualquier otra
    ruta responde 404 (no revela que el panel existe).
  - Las acciones requieren una clave de acceso (token) por cookie de sesión.

Configuración por variables de entorno (todas opcionales):
  FLIT_ADMIN_SLUG   ruta secreta del panel        (def: "panel-flit-ops-9k27x")
  FLIT_ADMIN_TOKEN  clave de acceso               (si falta, se genera y persiste)
  FLIT_ADMIN_HOST   interfaz de escucha           (def: "127.0.0.1")
  FLIT_ADMIN_PORT   puerto                        (def: 8765)

Uso:
    python tools/admin_server.py
    # luego abre la URL que imprime en consola (incluye slug + token)

Sin dependencias externas.
"""
from __future__ import annotations

import hmac
import html
import json
import os
import secrets
import subprocess
import sys
import urllib.parse
from datetime import datetime, timezone
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOOLS = ROOT / "tools"
SCRAPER = TOOLS / "scrape_agenda.py"
OUT = ROOT / "app" / "src" / "data" / "agenda.json"
META = TOOLS / ".cache" / "scrape_meta.json"
LOG = TOOLS / ".cache" / "admin.log"
TOKEN_FILE = TOOLS / ".cache" / "admin_token.txt"

SLUG = os.environ.get("FLIT_ADMIN_SLUG", "panel-flit-ops-9k27x").strip("/")
HOST = os.environ.get("FLIT_ADMIN_HOST", "127.0.0.1")
PORT = int(os.environ.get("FLIT_ADMIN_PORT", "8765"))
COOKIE_NAME = "flit_admin"


# ---------------------------------------------------------------- token / auth
def resolve_token() -> str:
    """Token desde env, o uno persistido/generado en .cache (estable entre reinicios)."""
    env = os.environ.get("FLIT_ADMIN_TOKEN")
    if env:
        return env
    if TOKEN_FILE.exists():
        saved = TOKEN_FILE.read_text(encoding="utf-8").strip()
        if saved:
            return saved
    token = secrets.token_urlsafe(9)
    TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_FILE.write_text(token, encoding="utf-8")
    return token


TOKEN = resolve_token()


def valid_token(candidate: str | None) -> bool:
    return bool(candidate) and hmac.compare_digest(candidate, TOKEN)


# ---------------------------------------------------------------- data helpers
def load_json(path: Path):
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def read_status() -> dict:
    agenda = load_json(OUT)
    meta = load_json(META)
    days = []
    if agenda:
        for d in agenda.get("days", []):
            days.append({
                "weekday": d.get("weekday"),
                "day": d.get("day"),
                "date": d.get("date"),
                "tracks": [
                    {"title": t.get("title"), "events": len(t.get("events", []))}
                    for t in d.get("tracks", [])
                ],
            })
    return {
        "event": agenda.get("event") if agenda else None,
        "stats": agenda.get("stats") if agenda else None,
        "days": days,
        "meta": meta,
        "jsonExists": OUT.exists(),
        "jsonMtime": (
            datetime.fromtimestamp(OUT.stat().st_mtime, timezone.utc).isoformat()
            if OUT.exists() else None
        ),
    }


def run_scraper(mode: str) -> dict:
    """Ejecuta scrape_agenda.py en subproceso y captura salida en UTF-8."""
    flag = {"check": "--check", "update": "", "force": "--force"}.get(mode, "--check")
    cmd = [sys.executable, str(SCRAPER)] + ([flag] if flag else [])
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUTF8": "1"}
    try:
        proc = subprocess.run(
            cmd, capture_output=True, cwd=str(ROOT), env=env, timeout=120
        )
        out = (proc.stdout + proc.stderr).decode("utf-8", "replace")
        code = proc.returncode
    except subprocess.TimeoutExpired:
        out, code = "La ejecución superó el tiempo límite (120s).", 1
    except Exception as exc:  # pragma: no cover - defensivo
        out, code = f"Error lanzando el scraper: {exc}", 1

    label = {0: "Sin cambios", 2: "Actualizado", 1: "Error"}.get(code, f"código {code}")
    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as fh:
            fh.write(f"\n===== {stamp} | modo={mode} | {label} =====\n{out}\n")
    except OSError:
        pass
    return {"exit": code, "label": label, "output": out, "mode": mode}


def tail_log(lines: int = 120) -> str:
    if not LOG.exists():
        return ""
    try:
        data = LOG.read_text(encoding="utf-8", errors="replace").splitlines()
        return "\n".join(data[-lines:])
    except OSError:
        return ""


# ---------------------------------------------------------------- HTML (panel)
PAGE = """<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>FLIT · Panel del scraper</title>
<style>
  :root {{ --coral:#fe4a24; --magenta:#fe0152; --violet:#6f25ee; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    background:#0e0b16; color:#f4f1fb; }}
  header {{ padding:22px 20px; background:linear-gradient(100deg,var(--coral),var(--magenta),var(--violet)); }}
  header h1 {{ margin:0; font-size:1.15rem; letter-spacing:.3px; }}
  header p {{ margin:4px 0 0; opacity:.9; font-size:.82rem; }}
  main {{ max-width:860px; margin:0 auto; padding:18px 16px 60px; }}
  .grid {{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:14px 0; }}
  .stat {{ background:#181226; border:1px solid #2a2140; border-radius:14px; padding:16px; text-align:center; }}
  .stat b {{ display:block; font-size:1.9rem; line-height:1; }}
  .stat span {{ font-size:.72rem; text-transform:uppercase; letter-spacing:.6px; opacity:.7; }}
  .card {{ background:#181226; border:1px solid #2a2140; border-radius:14px; padding:16px; margin:12px 0; }}
  .card h2 {{ margin:0 0 10px; font-size:.95rem; }}
  .row {{ display:flex; flex-wrap:wrap; gap:10px; align-items:center; }}
  button {{ border:0; border-radius:11px; padding:12px 18px; font-size:.92rem; font-weight:600;
    color:#fff; cursor:pointer; min-height:44px; }}
  .primary {{ background:linear-gradient(100deg,var(--coral),var(--magenta)); }}
  .ghost {{ background:#241b38; color:#d9d2ef; border:1px solid #3a2e58; }}
  button:disabled {{ opacity:.5; cursor:progress; }}
  .meta {{ font-size:.82rem; opacity:.85; line-height:1.7; }}
  .pill {{ display:inline-block; padding:2px 9px; border-radius:999px; font-size:.72rem; font-weight:700; }}
  .ok {{ background:#16361f; color:#7ee29b; }} .warn {{ background:#3a2c12; color:#f2c46b; }}
  .err {{ background:#3a1620; color:#f58aa3; }}
  pre {{ background:#0b0814; border:1px solid #2a2140; border-radius:11px; padding:12px;
    overflow:auto; font-size:.78rem; max-height:340px; white-space:pre-wrap; word-break:break-word; }}
  table {{ width:100%; border-collapse:collapse; font-size:.84rem; }}
  td {{ padding:6px 4px; border-bottom:1px solid #241b38; }}
  td.n {{ text-align:right; opacity:.85; }}
  a.logout {{ color:#fff; opacity:.85; font-size:.78rem; text-decoration:none; float:right; }}
</style></head>
<body>
<header>
  <a class="logout" href="{base}/logout">Cerrar sesión</a>
  <h1>Agenda FLIT 2026 · Panel del scraper</h1>
  <p id="evt">Cargando…</p>
</header>
<main>
  <div class="grid">
    <div class="stat"><b id="s-days">–</b><span>Días</span></div>
    <div class="stat"><b id="s-tracks">–</b><span>Tracks</span></div>
    <div class="stat"><b id="s-events">–</b><span>Eventos</span></div>
  </div>

  <div class="card">
    <h2>Acciones</h2>
    <div class="row">
      <button class="ghost" id="btn-check">Comprobar cambios</button>
      <button class="primary" id="btn-update">Actualizar agenda</button>
      <button class="ghost" id="btn-refresh">Refrescar estado</button>
    </div>
    <p class="meta" id="run-status"></p>
    <pre id="out" hidden></pre>
  </div>

  <div class="card">
    <h2>Última corrida</h2>
    <p class="meta" id="meta"></p>
  </div>

  <div class="card">
    <h2>Agenda actual</h2>
    <table><tbody id="days"></tbody></table>
  </div>

  <div class="card">
    <h2>Historial (log)</h2>
    <pre id="log">—</pre>
  </div>
</main>
<script>
const BASE = {base_js};
const $ = id => document.getElementById(id);
const esc = s => (s==null?'':String(s));

async function api(path, method='GET') {{
  const r = await fetch(BASE + path, {{ method, headers: {{'Accept':'application/json'}} }});
  if (r.status === 401) {{ location.href = BASE + '/'; return null; }}
  return r.json();
}}

function pill(meta) {{
  if (!meta) return '<span class="pill warn">sin datos</span>';
  return meta.changed ? '<span class="pill ok">cambió</span>'
                      : '<span class="pill warn">sin cambios</span>';
}}

function renderStatus(d) {{
  if (d.event) $('evt').textContent = d.event.name + ' · ' + (d.event.dates||'');
  $('s-days').textContent   = d.stats ? d.stats.days   : '–';
  $('s-tracks').textContent = d.stats ? d.stats.tracks : '–';
  $('s-events').textContent = d.stats ? d.stats.events : '–';

  const m = d.meta;
  $('meta').innerHTML = m
    ? `${{pill(m)}} &nbsp; <b>${{esc(m.source)}}</b> · ${{esc(m.lastRun)}}<br>`
      + `Fuente: <a style="color:#c9b8ff" href="${{esc(m.url)}}" target="_blank">${{esc(m.url)}}</a><br>`
      + `JSON: ${{d.jsonExists ? esc(d.jsonMtime) : 'no existe'}}`
    : 'Aún no se ha ejecutado el scraper.';

  const rows = (d.days||[]).map(day => {{
    const head = `<tr><td colspan="2"><b>${{esc(day.weekday)}} ${{esc(day.day)}}</b> · ${{esc(day.date)}}</td></tr>`;
    const tr = day.tracks.map(t => `<tr><td>&nbsp;&nbsp;${{esc(t.title)}}</td><td class="n">${{t.events}}</td></tr>`).join('');
    return head + tr;
  }}).join('');
  $('days').innerHTML = rows || '<tr><td>Sin datos. Ejecuta una actualización.</td></tr>';
}}

async function refresh() {{ const d = await api('/api/status'); if (d) renderStatus(d); loadLog(); }}
async function loadLog() {{ const d = await api('/api/log'); if (d) $('log').textContent = d.log || '—'; }}

async function runMode(mode) {{
  const btns = document.querySelectorAll('button');
  btns.forEach(b => b.disabled = true);
  $('run-status').textContent = mode === 'check' ? 'Comprobando la web oficial…' : 'Actualizando agenda…';
  const d = await api('/api/run?mode=' + mode, 'POST');
  btns.forEach(b => b.disabled = false);
  if (!d) return;
  const cls = d.exit === 1 ? 'err' : (d.exit === 2 ? 'ok' : 'warn');
  $('run-status').innerHTML = `<span class="pill ${{cls}}">${{esc(d.label)}}</span>`;
  $('out').hidden = false;
  $('out').textContent = d.output;
  refresh();
}}

$('btn-check').onclick  = () => runMode('check');
$('btn-update').onclick = () => runMode('update');
$('btn-refresh').onclick = refresh;
refresh();
</script>
</body></html>"""

LOGIN = """<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>FLIT · Acceso</title>
<style>
  body {{ margin:0; min-height:100vh; display:grid; place-items:center;
    font-family:system-ui,sans-serif; background:#0e0b16; color:#f4f1fb; }}
  form {{ background:#181226; border:1px solid #2a2140; border-radius:16px; padding:26px;
    width:min(92vw,330px); }}
  h1 {{ font-size:1rem; margin:0 0 4px; }}
  p {{ font-size:.8rem; opacity:.7; margin:0 0 16px; }}
  input {{ width:100%; padding:12px; border-radius:10px; border:1px solid #3a2e58;
    background:#0b0814; color:#fff; font-size:1rem; }}
  button {{ width:100%; margin-top:12px; padding:12px; border:0; border-radius:10px;
    color:#fff; font-weight:600; font-size:1rem; cursor:pointer;
    background:linear-gradient(100deg,#fe4a24,#fe0152,#6f25ee); }}
  .err {{ color:#f58aa3; font-size:.8rem; margin-top:10px; }}
</style></head>
<body>
  <form method="POST" action="{base}/login">
    <h1>Panel del scraper · FLIT 2026</h1>
    <p>Acceso restringido. Introduce la clave.</p>
    <input type="password" name="token" placeholder="Clave de acceso" autofocus autocomplete="current-password">
    <button type="submit">Entrar</button>
    {error}
  </form>
</body></html>"""


# ---------------------------------------------------------------- HTTP handler
class Handler(BaseHTTPRequestHandler):
    server_version = "FlitAdmin/1.0"
    base = "/" + SLUG

    # -- utilidades de respuesta -------------------------------------------
    def _send(self, code, body: bytes, ctype="text/html; charset=utf-8", extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        for k, v in (extra or []):
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, obj, code=200):
        self._send(code, json.dumps(obj, ensure_ascii=False).encode("utf-8"),
                   "application/json; charset=utf-8")

    def _not_found(self):
        self._send(HTTPStatus.NOT_FOUND, b"404 Not Found", "text/plain; charset=utf-8")

    # -- auth --------------------------------------------------------------
    def _authed(self) -> bool:
        cookie = SimpleCookie(self.headers.get("Cookie", ""))
        morsel = cookie.get(COOKIE_NAME)
        return valid_token(morsel.value if morsel else None)

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", "0") or "0")
        return self.rfile.read(length) if length else b""

    # -- routing -----------------------------------------------------------
    def do_GET(self):  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == self.base or path == self.base.rstrip("/"):
            if not self._authed():
                return self._serve_login()
            return self._serve_panel()

        if path == self.base + "/logout":
            expired = "{}=; Path={}; Max-Age=0; HttpOnly; SameSite=Strict".format(COOKIE_NAME, self.base)
            return self._send(HTTPStatus.SEE_OTHER, b"", "text/plain",
                              extra=[("Set-Cookie", expired), ("Location", self.base + "/")])

        if path == self.base + "/api/status":
            if not self._authed():
                return self._json({"error": "unauthorized"}, 401)
            return self._json(read_status())

        if path == self.base + "/api/log":
            if not self._authed():
                return self._json({"error": "unauthorized"}, 401)
            return self._json({"log": tail_log()})

        return self._not_found()

    def do_HEAD(self):  # noqa: N802
        self.do_GET()

    def do_POST(self):  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == self.base + "/login":
            data = urllib.parse.parse_qs(self._read_body().decode("utf-8", "replace"))
            token = (data.get("token") or [""])[0]
            if valid_token(token):
                cookie = "{}={}; Path={}; HttpOnly; SameSite=Strict; Max-Age=43200".format(
                    COOKIE_NAME, token, self.base)
                return self._send(HTTPStatus.SEE_OTHER, b"", "text/plain",
                                  extra=[("Set-Cookie", cookie), ("Location", self.base + "/")])
            return self._serve_login(error="Clave incorrecta.")

        if path == self.base + "/api/run":
            if not self._authed():
                return self._json({"error": "unauthorized"}, 401)
            qs = urllib.parse.parse_qs(parsed.query)
            mode = (qs.get("mode") or ["check"])[0]
            if mode not in ("check", "update", "force"):
                return self._json({"error": "bad mode"}, 400)
            return self._json(run_scraper(mode))

        return self._not_found()

    # -- páginas -----------------------------------------------------------
    def _serve_panel(self):
        page = PAGE.format(base=self.base, base_js=json.dumps(self.base))
        self._send(200, page.encode("utf-8"))

    def _serve_login(self, error: str = ""):
        err_html = f'<div class="err">{html.escape(error)}</div>' if error else ""
        page = LOGIN.format(base=self.base, error=err_html)
        self._send(200, page.encode("utf-8"))

    # silencia el logging ruidoso por defecto
    def log_message(self, fmt, *args):  # noqa: A003
        sys.stderr.write("  %s - %s\n" % (self.address_string(), fmt % args))


def main() -> int:
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    url = f"http://{HOST}:{PORT}/{SLUG}/"
    print("=" * 64)
    print("  Panel del scraper FLIT 2026 en marcha")
    print(f"  URL   : {url}")
    print(f"  Clave : {TOKEN}")
    if not os.environ.get("FLIT_ADMIN_TOKEN"):
        print(f"  (clave autogenerada y guardada en {TOKEN_FILE})")
    print("  Ctrl+C para detener.")
    print("=" * 64)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nDetenido.")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
