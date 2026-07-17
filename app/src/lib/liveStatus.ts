// Estado "en vivo" del festival.
//
// Dos capas:
//   1. Sistema automático (por fecha): el festival está "en vivo" cuando ya pasó
//      la hora de inicio. Esto SIEMPRE sigue funcionando (no se quita).
//   2. Verificación manual: un operador puede forzar el estado desde el panel de
//      admin ("en vivo" / "apagado"). Solo sobrescribe al automático cuando se
//      fija explícitamente; por defecto ("auto") manda el sistema por fecha.
//
// La preferencia manual se guarda en este dispositivo (localStorage), igual que
// el resto del estado de la app (sin backend).

// Inicio del festival: 15 de julio 2026, 08:00 (hora de Perú, UTC-5).
export const FESTIVAL_START = new Date("2026-07-15T08:00:00-05:00").getTime();

export type LiveOverride = "auto" | "on" | "off";

const KEY = "flit-agenda-2026.liveOverride";
/** Evento propio: `storage` no dispara en la misma pestaña que escribe. */
export const LIVE_EVENT = "flit:live-override";

/** Estado por el sistema automático (solo fecha). */
export function autoLive(now: number = Date.now()): boolean {
  return FESTIVAL_START - now <= 0;
}

/** Preferencia de verificación manual guardada (o "auto" si no hay). */
export function readOverride(): LiveOverride {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "on" || v === "off") return v;
  } catch {
    /* almacenamiento no disponible: cae a auto */
  }
  return "auto";
}

/** Fija la verificación manual y avisa a la app en la misma pestaña. */
export function writeOverride(value: LiveOverride): void {
  try {
    if (value === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, value);
  } catch {
    /* ignora fallos de almacenamiento */
  }
  window.dispatchEvent(new CustomEvent(LIVE_EVENT));
}

/** Estado efectivo: manual si está fijado, si no el automático por fecha. */
export function effectiveLive(now: number = Date.now()): boolean {
  const override = readOverride();
  if (override === "on") return true;
  if (override === "off") return false;
  return autoLive(now);
}
