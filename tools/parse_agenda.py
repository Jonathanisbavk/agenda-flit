#!/usr/bin/env python3
"""
parse_agenda.py
Extrae la agenda de FLIT Arequipa 2026 desde el HTML exportado de WordPress/Elementor
y genera un JSON estructurado consumible por la app React.

Uso:
    python tools/parse_agenda.py
"""
from __future__ import annotations

import html
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "Agenda FLIT Arequipa 2026 - FLIT.html"
OUT = ROOT / "app" / "src" / "data" / "agenda.json"

MONTHS = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "octubre": 10, "noviembre": 11,
    "diciembre": 12,
}
WEEKDAYS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]


def strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn"
    )


def clean(text: str) -> str:
    text = html.unescape(text)
    text = text.replace("–", "-").replace("—", "-").replace("舑", "-")
    text = text.replace("&#8211;", "-")
    text = re.sub(r"\s+", " ", text)
    return text.strip(" -–—\t\n")


# ---- Helpers de limpieza --------------------------------------------------

def to_min(t: str | None) -> int | None:
    if not t:
        return None
    m = re.match(r"^\s*(\d{1,2}):(\d{2})\s*$", t)
    return int(m.group(1)) * 60 + int(m.group(2)) if m else None


def fmt_min(x: int | None) -> str | None:
    if x is None:
        return None
    return f"{x // 60}:{x % 60:02d}"


# País entre paréntesis: "(PAÍS: PERÚ)" o "(PAÍS MÉXICO)" — con o sin dos puntos.
PAIS_RE = re.compile(r"\(\s*pa[ií]s\b\s*:?\s*[^)]*\)", re.I)


def strip_pais(text: str) -> str:
    return clean(PAIS_RE.sub(" ", text))


# Nombres de país canónicos (con acentos), para un chip consistente.
CANON_COUNTRY = {
    "PERU": "Perú", "CHILE": "Chile", "BRASIL": "Brasil", "BRAZIL": "Brasil",
    "MEXICO": "México", "ARGENTINA": "Argentina", "COLOMBIA": "Colombia",
    "ECUADOR": "Ecuador", "BOLIVIA": "Bolivia", "URUGUAY": "Uruguay",
    "PARAGUAY": "Paraguay", "ESPANA": "España", "ESTADOS UNIDOS": "Estados Unidos",
    "EEUU": "Estados Unidos", "USA": "Estados Unidos", "VENEZUELA": "Venezuela",
    "PANAMA": "Panamá", "COSTA RICA": "Costa Rica",
}


def canon_country(c: str | None) -> str | None:
    if not c:
        return None
    key = strip_accents(c).upper().strip()
    if key in CANON_COUNTRY:
        return CANON_COUNTRY[key]
    return c.title() if c.isupper() else c


# ---- Tokenizer ------------------------------------------------------------
# Recorremos el documento en orden y emitimos tokens:
#   ("section", titulo_crudo)      -> nueva sección (icon-list-text)
#   ("time", "HH:MM a HH:MM")      -> nuevo evento (heading "Mainstage<br>...")
#   ("title", texto)               -> titulo de evento (heading simple)
#   ("body", html_interno)         -> descripcion (text-editor)

SECTION_RE = re.compile(
    r'<span class="elementor-icon-list-text">(.*?)</span>', re.S
)
HEADING_RE = re.compile(
    r'<span class="elementor-heading-title elementor-size-default">(.*?)</span>', re.S
)
TEXTEDITOR_RE = re.compile(
    r'elementor-widget-text-editor.*?<div class="elementor-widget-container">(.*?)</div>',
    re.S,
)


def find_tokens(doc: str):
    tokens = []
    for m in SECTION_RE.finditer(doc):
        tokens.append((m.start(), "section", m.group(1)))
    for m in HEADING_RE.finditer(doc):
        raw = m.group(1)
        flat = clean(re.sub(r"<[^>]+>", " ", raw))
        if strip_accents(flat).lower().startswith("mainstage"):
            time = clean(re.sub(r"(?i)mainstage", "", flat))
            tokens.append((m.start(), "time", time))
        else:
            tokens.append((m.start(), "title", flat))
    for m in TEXTEDITOR_RE.finditer(doc):
        tokens.append((m.start(), "body", m.group(1)))
    tokens.sort(key=lambda t: t[0])
    return tokens


# ---- Section metadata -----------------------------------------------------

def parse_section(raw: str) -> dict:
    raw = raw.replace("<br />", "\n").replace("<br/>", "\n").replace("<br>", "\n")
    lines = [clean(re.sub(r"<[^>]+>", " ", l)) for l in raw.split("\n")]
    lines = [l for l in lines if l]
    title = lines[0] if lines else "FLIT"
    blob = " ".join(lines)
    low = strip_accents(blob).lower()

    # fecha
    day = month = year = None
    dm = re.search(r"(\d{1,2})\s+de\s+([a-zñ]+)\s+(\d{4})", strip_accents(blob).lower())
    if not dm:
        dm = re.search(r"(\d{1,2})\s+de\s+([a-zñ]+)", strip_accents(blob).lower())
    if dm:
        day = int(dm.group(1))
        month = MONTHS.get(dm.group(2))
        year = int(dm.group(3)) if dm.lastindex and dm.lastindex >= 3 and dm.group(3) else 2026
    # El HTML original mezcla 2025/2026; el festival es 2026.
    year = 2026

    weekday = next((w for w in WEEKDAYS if w in low), None)

    date_iso = None
    if day and month:
        date_iso = f"{year:04d}-{month:02d}-{day:02d}"

    # rango horario de la sección
    tr = re.search(r"(\d{1,2}:\d{2})\s*(?:am|pm)?\s*a\s*(\d{1,2}:\d{2})", low)
    span = None
    if tr:
        span = f"{tr.group(1)} - {tr.group(2)}"

    return {
        "title": title,
        "subtitle": " · ".join(lines[1:]) if len(lines) > 1 else "",
        "weekday": weekday,
        "date": date_iso,
        "day": day,
        "span": span,
        "lines": lines,
    }


# ---- Event body parsing ---------------------------------------------------

def parse_body(raw: str) -> dict:
    # Los ponentes suelen ir en <li> o <h1-6> (uno por elemento); tratamos esos
    # cierres como límites de bloque, además de </p>, para no fusionarlos.
    blocks = re.split(r"(?i)</(?:p|li|h[1-6])>", raw)
    strongs = []
    plain = []
    for p in blocks:
        is_strong = "<strong>" in p or "<b>" in p
        txt = clean(re.sub(r"<[^>]+>", " ", p))
        if not txt:
            continue
        if is_strong:
            strongs.append(txt)
        else:
            plain.append(txt)
    return {"strongs": strongs, "plain": plain}


def normalize_time(time: str) -> tuple[str | None, str | None]:
    m = re.search(r"(\d{1,2}:\d{2})\s*a\s*(\d{1,2}:\d{2})", time)
    if m:
        return m.group(1), m.group(2)
    m = re.search(r"(\d{1,2}:\d{2})", time)
    if m:
        return m.group(1), None
    return None, None


CATEGORY_HINTS = [
    "conferencia magistral", "panel de dialogo", "panel", "ceremonia",
    "inauguracion", "clausura", "almuerzo", "descanso", "coffee", "break",
    "acreditacion", "registro", "sorteo", "trivia", "pitch", "demo",
    "taller", "workshop", "keynote", "hackaton", "premiacion", "networking",
    "fireside", "charla", "ponencia", "mesa redonda", "show", "presentacion",
]

BREAK_WORDS = ["almuerzo", "descanso", "coffee", "break", "acreditacion", "registro",
               "sorteo", "trivia", "networking", "receso"]


def categorize(text: str) -> str | None:
    low = strip_accents(text).lower()
    for hint in CATEGORY_HINTS:
        if hint in low:
            return hint
    return None


def is_break(title: str, category: str | None) -> bool:
    blob = strip_accents((title or "") + " " + (category or "")).lower()
    return any(w in blob for w in BREAK_WORDS)


# ---- Speaker extraction ---------------------------------------------------
COUNTRY_ISO = {
    "PERU": "PE", "CHILE": "CL", "BRASIL": "BR", "BRAZIL": "BR", "MEXICO": "MX",
    "ARGENTINA": "AR", "COLOMBIA": "CO", "ECUADOR": "EC", "BOLIVIA": "BO",
    "URUGUAY": "UY", "PARAGUAY": "PY", "ESPANA": "ES", "ESTADOS UNIDOS": "US",
    "EEUU": "US", "USA": "US", "VENEZUELA": "VE", "PANAMA": "PA", "COSTA RICA": "CR",
}

ROLE_KEYWORDS = [
    "ceo", "cto", "cfo", "coo", "cmo", "cio", "founder", "co-founder", "cofounder",
    "fundador", "cofundador", "co-fundador", "director", "directora", "gerente",
    "subgerente", "sub gerente", "presidente", "vicepresidente", "representante",
    "coordinador", "coordinadora", "jefe", "jefa", "lider", "rector", "decano",
    "ministro", "viceministro", "embajador", "consultor", "especialista", "docente",
    "profesor", "investigador", "socio", "partner", "head", "manager", "country manager",
    "encargado", "responsable", "analista", "ejecutivo", "asesor", "mentor", "speaker",
]


def iso_for(country: str | None) -> str | None:
    if not country:
        return None
    key = strip_accents(country).upper().strip()
    return COUNTRY_ISO.get(key)


def looks_like_role(text: str) -> bool:
    low = strip_accents(text).lower()
    if any(k in low for k in ROLE_KEYWORDS):
        return True
    # frases con minúsculas suelen ser cargos/descripción
    letters = [c for c in text if c.isalpha()]
    if letters and sum(c.islower() for c in letters) / len(letters) > 0.4:
        return True
    return False


def looks_like_name(text: str) -> bool:
    words = text.split()
    if not (1 <= len(words) <= 5):
        return False
    if looks_like_role(text):
        return False
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    # nombres suelen ir en mayúsculas
    return sum(c.isupper() for c in letters) / len(letters) > 0.6


def split_country(line: str) -> tuple[str, str | None]:
    cm = re.search(r"\(\s*pa[ií]s\b\s*:?\s*([^)]+)\)", line, re.I)
    country = None
    if cm:
        country = clean(cm.group(1)).upper()
        line = line[: cm.start()] + line[cm.end():]
    return clean(line), country


def extract_speakers(details: list[str]) -> list[dict]:
    """Heurística para identificar ponentes (nombre, cargo, país, moderador).

    Maneja los dos formatos del origen:
      A) un ponente por línea: nombre / cargo / (PAÍS: X) en párrafos separados.
      B) varios ponentes en una sola línea, separados por " - " y con el país
         inline: "NOMBRE (CARGO) (PAÍS: X) - NOMBRE2 - CARGO2 (PAÍS: Y) - ..."
    Se procesa segmento a segmento para no mezclar cargos entre ponentes.
    """
    speakers: list[dict] = []
    current: dict | None = None

    def push():
        nonlocal current
        if current and (current.get("name") or current.get("role")):
            speakers.append(current)
        current = None

    def set_country(sp: dict, c: str | None):
        if c:
            sp["country"] = canon_country(c)
            sp["iso"] = iso_for(c)

    for raw in details:
        mod_pending = False
        mm = re.match(r"^\s*modera(?:dor|dora)?\s*:?\s*", raw, re.I)
        if mm:
            mod_pending = True
            raw = raw[mm.end():]

        segments = [s for s in re.split(r"\s+-\s+", raw) if s.strip()]
        if not segments:
            _, c = split_country(raw)
            if c and current:
                set_country(current, c)
            continue

        for seg in segments:
            seg, country = split_country(seg)
            seg = clean(seg)
            if not seg:
                if current:
                    set_country(current, country)
                continue

            # nombre con cargo inline: "NOMBRE (CARGO)"
            name = role = None
            pm = re.match(r"^(.+?)\s*\(([^)]+)\)\s*$", seg)
            if pm and looks_like_name(pm.group(1)):
                name, role = clean(pm.group(1)), clean(pm.group(2))
            elif looks_like_name(seg):
                name = seg

            if name is not None:
                push()
                current = {
                    "name": name, "role": role or None,
                    "country": None, "iso": None,
                    "moderator": mod_pending,
                }
                set_country(current, country)
                mod_pending = False
            elif current and not current.get("role"):
                current["role"] = seg
                set_country(current, country)
            elif current:
                current["role"] = f"{current['role']} · {seg}" if current.get("role") else seg
                set_country(current, country)
            else:
                # cargo institucional sin nombre (p.ej. REPRESENTANTE DE CLARO);
                # descartar frases descriptivas (preguntas o textos largos).
                has_kw = any(k in strip_accents(seg).lower() for k in ROLE_KEYWORDS)
                is_sentence = seg.endswith("?") or len(seg.split()) > 8
                if has_kw and not is_sentence:
                    push()
                    speakers.append({
                        "name": None, "role": seg,
                        "country": canon_country(country), "iso": iso_for(country),
                        "moderator": mod_pending,
                    })
                    mod_pending = False
    push()

    # normaliza iso por si quedó país sin código
    for s in speakers:
        if not s.get("iso"):
            s["iso"] = iso_for(s.get("country"))
    return speakers


# ---- Normalización de títulos ---------------------------------------------
# El origen escribe los títulos a mano: mezcla comillas «» "" '', repite el tipo
# de actividad que ya vive en `category`, grita en MAYÚSCULAS y trae erratas.
# Aquí se dejan legibles sin perder información: el tipo sigue en el badge.

QUOTES = "«»“”„‟\"'‘’"

# Erratas del origen. Se aplican sin distinguir mayúsculas; el recase posterior
# fija la capitalización final, por eso el reemplazo va en minúscula.
TITLE_TYPOS = [
    (r"\bC\s+redenciales\b", "credenciales"),
    (r"\bdiggitales\b", "digitales"),
    (r"\bdeliveraci[oó]n\b", "deliberación"),
    (r"\binaguraci[oó]n\b", "inauguración"),
    (r"\bporqu[eé]\b", "por qué"),
    (r"\bdialogo\b", "diálogo"),
    (r"\bseleccion\b", "selección"),
    (r"\bcyberseguridad\b", "ciberseguridad"),
    (r"\blatinoamerica\b", "Latinoamérica"),
    (r"\bmineria\b", "minería"),
    (r"\btecnologia\b", "tecnología"),
    (r"\bcamara\b", "cámara"),
    (r"\blideres\b", "líderes"),
]

# El tipo de actividad ya se muestra como badge (`category`): repetirlo en el
# título solo entierra el tema real. "panel" solo se quita en la forma
# "PANEL#1:", nunca suelto: en "Panel de diálogo #1" el prefijo *es* el título.
TITLE_PREFIX_RE = re.compile(
    r"^(?:(?:conferencia\s+magistral|keynote|charla|ponencia|tema)\s*(?:#\s*\d+)?\s*[:.\-]?"
    r"|panel\s*#\s*\d+\s*[:.\-])\s*",
    re.I,
)

# Título que es solo la etiqueta del tipo, sin tema ("Conferencia Magistral").
TYPE_ONLY_RE = re.compile(
    r"^(?:conferencia\s+magistral|keynote|charla|ponencia|tema)\s*(?:#\s*\d+)?\s*$",
    re.I,
)

# Siglas y marcas que conservan su forma al recapitalizar.
UPPER_TOKENS = {
    "IA", "AI", "TIC", "TICS", "FLIT", "HUB", "LATAM", "GENAI", "TEDX", "GPT",
    "PYME", "PYMES", "MYPE", "MYPES", "CEO", "CTO", "CENIA", "COFIDE", "IOT",
    "B2B", "B2C", "MBA", "ONG", "PUCP", "CCIA", "PECAP",
}
PROPER_TOKENS = {
    "PERU": "Perú", "AREQUIPA": "Arequipa", "LATINOAMERICA": "Latinoamérica",
    "AMERICA": "América", "AMERICAS": "Américas", "CHILE": "Chile",
    "BRASIL": "Brasil", "MEXICO": "México", "DRIVE": "Drive",
    "KUBERNETES": "Kubernetes", "LATAMGPT": "LatamGPT", "AGENTIC": "Agentic",
    "BUENAVENTURA": "Buenaventura", "CLARO": "Claro", "WHATSAPP": "WhatsApp",
}


def _caps_ratio(text: str) -> float:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return 0.0
    return sum(c.isupper() for c in letters) / len(letters)


def _sentence_case(text: str) -> str:
    """Sentence case en español: solo la primera palabra, siglas y nombres propios."""
    out = []
    first = True
    for word in text.split(" "):
        m = re.search(r"[^\W\d_]+", word)
        if not m:
            out.append(word)
            continue
        core = m.group(0)
        key = strip_accents(core).upper()
        # Sufijo ordinal ("6TA", "1ERA"): va pegado al dígito y siempre minúscula.
        after_digit = m.start() > 0 and word[m.start() - 1].isdigit()
        if key in UPPER_TOKENS:
            new = key
        elif key in PROPER_TOKENS:
            new = PROPER_TOKENS[key]
        elif first and not after_digit:
            new = core[0].upper() + core[1:].lower()
        else:
            new = core.lower()
        out.append(word[: m.start()] + new + word[m.end():])
        first = False
    return " ".join(out)


def _upper_first(text: str) -> str:
    m = re.search(r"[^\W\d_]", text)
    if not m or text[m.start()].isupper():
        return text
    i = m.start()
    # No tocar el sufijo de un ordinal ("1era", "6ta").
    if i > 0 and text[i - 1].isdigit():
        return text
    return text[:i] + text[i].upper() + text[i + 1:]


def normalize_title(title: str) -> str:
    """Deja un título del origen legible, sin tocar su significado."""
    text = clean("".join(" " if c in QUOTES else c for c in title))

    # El prefijo solo se quita si detrás queda un tema de verdad.
    stripped = clean(TITLE_PREFIX_RE.sub("", text))
    if stripped and not TYPE_ONLY_RE.match(text):
        text = stripped

    # Se mide sobre el tema ya sin prefijo: un "Conferencia Magistral:" delante
    # diluye el ratio y dejaría pasar temas que sí vienen gritados. Y antes de
    # las erratas, cuyo reemplazo en minúscula también lo diluiría.
    shouted = _caps_ratio(text) > 0.7

    for pat, repl in TITLE_TYPOS:
        text = re.sub(pat, repl, text, flags=re.I)

    if shouted:
        text = _sentence_case(text)
    return _upper_first(clean(text)).strip(" :;,.-")


def build_event(time: str, title_tok: str | None, body: dict | None, idx: int) -> dict:
    start, end = normalize_time(time)
    strongs = body["strongs"] if body else []
    plain = body["plain"] if body else []

    category = None
    title = title_tok
    details: list[str] = []

    if strongs:
        # 1er strong suele ser el TIPO (CONFERENCIA MAGISTRAL, PANEL...)
        cat_guess = categorize(strongs[0])
        rest = list(strongs)
        if cat_guess:
            category = strongs[0]
            rest = strongs[1:]
        # quitar la palabra "TEMA"
        rest = [s for s in rest if strip_accents(s).lower().strip() != "tema"]
        if not title:
            title = rest[0] if rest else (category or "Actividad")
            details = rest[1:] + plain
        else:
            details = rest + plain
    elif title:
        details = plain
        category = categorize(title)
    else:
        title = plain[0] if plain else "Actividad"
        details = plain[1:]

    title = (title or "Actividad").strip().rstrip(":").strip()
    if not category:
        category = categorize(title)

    # El origen a veces deja como título la lista de ponentes ("NOMBRE (CEO X)
    # (PAÍS: PERÚ)"), o solo la etiqueta del tipo con el tema caído a details.
    # En ambos casos el tema real está en otro sitio: se recoloca para no perder
    # ni el tema ni al ponente (el roster vuelve a details y de ahí a speakers).
    if PAIS_RE.search(title) and category:
        details = [title] + details
        title = category
    elif TYPE_ONLY_RE.match(title) and details and len(details[0].split()) > 4:
        title = details.pop(0)

    title = normalize_title(title) or "Actividad"

    # país a nivel de evento (del texto con "(PAÍS: X)")
    country = None
    cm = re.search(r"pa[ií]s:\s*([a-záéíóúñ ]+)", strip_accents(" ".join(details)).lower())
    if cm:
        country = cm.group(1).strip().upper()

    is_brk = is_break(title, category)
    # Los ponentes se extraen del texto que aún conserva "(PAÍS: X)" inline…
    speakers = [] if is_brk else extract_speakers([d for d in details if d])
    # …y luego se limpia ese marcador del texto visible.
    details = [d for d in (strip_pais(d) for d in details) if d]

    if not country and speakers:
        country = next((s["country"] for s in speakers if s.get("country")), None)
    country = canon_country(country)

    return {
        "id": f"ev-{idx:03d}",
        "time": time,
        "start": start,
        "end": end,
        "title": title,
        "category": (category or "").upper() or None,
        "details": details,
        "country": country,
        "iso": iso_for(country),
        "speakers": speakers,
        "image": None,
        "isBreak": is_brk,
    }


def fix_track_times(events: list[dict]) -> None:
    """Corrige horas en formato 12h sin am/pm (p. ej. sábado: 1:30 = 13:30).

    El origen las escribe sin marcador, pero dentro de un track las actividades
    van en orden; si una hora retrocede respecto a la anterior, se le suman 12h
    (siempre que el resultado siga siendo una hora válida < 24:00). Reescribe
    start/end/time de forma coherente.
    """
    floor = 0
    for ev in events:
        s = to_min(ev.get("start"))
        if s is None:
            continue
        e = to_min(ev.get("end"))
        while s < floor and s + 720 <= 24 * 60:
            s += 720
        if e is not None:
            while e < s and e + 720 <= 24 * 60:
                e += 720
        ev["start"] = fmt_min(s)
        if e is not None:
            ev["end"] = fmt_min(e)
            ev["time"] = f"{fmt_min(s)} a {fmt_min(e)}"
        else:
            ev["time"] = fmt_min(s)
        floor = e if e is not None else s


def build_payload(doc: str) -> dict:
    """Transforma el HTML crudo (local o descargado) en el payload de la app."""
    # limitar al contenido principal para evitar footers/menus
    tokens = find_tokens(doc)

    sections: list[dict] = []
    current = None
    pending_time = None
    pending_title = None
    idx = 0

    def flush(body=None):
        nonlocal pending_time, pending_title, idx
        if pending_time is None or current is None:
            pending_time = None
            pending_title = None
            return
        ev = build_event(pending_time, pending_title, body, idx)
        current["events"].append(ev)
        idx += 1
        pending_time = None
        pending_title = None

    for _pos, kind, value in tokens:
        if kind == "section":
            flush()
            meta = parse_section(value)
            current = {**meta, "id": f"sec-{len(sections):02d}", "events": []}
            sections.append(current)
        elif kind == "time":
            # nuevo evento: cerrar el anterior (sin body extra)
            flush()
            pending_time = value
        elif kind == "title":
            if pending_time is not None and pending_title is None:
                pending_title = value
            # si no hay tiempo pendiente, ignorar titulos sueltos
        elif kind == "body":
            if pending_time is not None:
                flush(parse_body(value))

    flush()

    # descartar secciones sin eventos
    sections = [s for s in sections if s["events"]]

    # corregir horas 12h/am-pm dentro de cada track
    for s in sections:
        fix_track_times(s["events"])

    # agrupar por dia para la app (varias secciones pueden compartir dia/fecha)
    days_map: dict[str, dict] = {}
    weekday_label = {
        "lunes": "Lunes", "martes": "Martes", "miercoles": "Miércoles",
        "jueves": "Jueves", "viernes": "Viernes", "sabado": "Sábado",
        "domingo": "Domingo",
    }
    for s in sections:
        key = s["date"] or s["title"]
        if key not in days_map:
            days_map[key] = {
                "id": f"day-{len(days_map)}",
                "date": s["date"],
                "weekday": weekday_label.get(s["weekday"] or "", ""),
                "day": s["day"],
                "tracks": [],
            }
        days_map[key]["tracks"].append({
            "id": s["id"],
            "title": s["title"],
            "subtitle": s["subtitle"],
            "span": s["span"],
            "events": s["events"],
        })

    days = list(days_map.values())
    days.sort(key=lambda d: (d["date"] or "9999"))

    total_events = sum(len(t["events"]) for d in days for t in d["tracks"])

    payload = {
        "event": {
            "name": "FLIT Arequipa 2026",
            "subtitle": "Festival Latinoamericano de Innovación y Tecnología",
            "eje": "Tecnología para ser más humanos",
            "location": "Arequipa, Perú",
            "dates": "15 - 18 de Julio 2026",
        },
        "brand": {
            "coral": "#fe4a24",
            "magenta": "#fe0152",
            "violet": "#6f25ee",
        },
        "stats": {
            "days": len(days),
            "tracks": len(sections),
            "events": total_events,
        },
        "days": days,
    }
    return payload


def summarize(payload: dict) -> None:
    """Imprime un resumen legible del payload generado."""
    stats = payload["stats"]
    print(f"  dias: {stats['days']} | tracks: {stats['tracks']} | eventos: {stats['events']}")
    for d in payload["days"]:
        print(f"  [{d['weekday']} {d.get('day')}] ({d['date']})")
        for t in d["tracks"]:
            print(f"      - {t['title']}: {len(t['events'])} eventos")


def write_payload(payload: dict, out: Path = OUT) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    doc = SOURCE.read_text(encoding="utf-8", errors="ignore")
    payload = build_payload(doc)
    write_payload(payload)
    print(f"OK -> {OUT}")
    summarize(payload)


if __name__ == "__main__":
    main()
