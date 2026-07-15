import { agenda, toMinutes } from "./agenda";
import type { AgendaEvent, Day } from "../types/agenda";

/**
 * Cálculo de layout para la vista tipo Google Calendar.
 *
 * Modelo: cada día se divide en columnas por *track* (el festival corre hasta 2
 * escenarios en paralelo). Los bloques se posicionan por hora sobre una rejilla,
 * pero con una **altura mínima** y **resolución de colisiones** (empuje hacia abajo)
 * para que las charlas muy cortas (pitches de 5–10 min) sigan siendo legibles y
 * tocables — una rejilla estrictamente proporcional las haría de ~7px (inaccesible).
 */

// Ventana válida: descarta artefactos de parseo (p. ej. 24:00 / 1:30).
const DAY_MIN = 6 * 60;
const DAY_MAX = 21 * 60;
const FALLBACK_START = 8 * 60;
const FALLBACK_END = 19 * 60;

/** Altura mínima de un bloque, en px — objetivo táctil accesible + espacio para 2 líneas. */
export const MIN_BLOCK_PX = 56;
/** Separación mínima entre bloques consecutivos, en px. */
const GAP_PX = 5;

function validMin(t: string | null): number | null {
  const v = toMinutes(t);
  if (v === Number.MAX_SAFE_INTEGER) return null;
  if (v < DAY_MIN || v > DAY_MAX) return null;
  return v;
}

export interface CalEvent {
  event: AgendaEvent;
  trackId: string;
  trackTitle: string;
  startMin: number;
  top: number; // px, ya resuelto contra colisiones
  height: number; // px
}

export interface CalColumn {
  trackId: string;
  trackTitle: string;
  events: CalEvent[];
}

export interface DayLayout {
  dayId: string;
  weekday: string;
  date: string | null;
  day: number | null;
  bodyHeight: number; // px del cuerpo de este día
  columns: CalColumn[];
}

export interface WeekLayout {
  windowStart: number; // minutos
  windowEnd: number;
  hours: number[]; // marcas horarias en minutos (múltiplos de 60)
  bodyHeight: number; // px del cuerpo (máximo entre días)
  days: DayLayout[];
}

function layoutDay(day: Day, pxPerMin: number, windowStart: number): DayLayout {
  const columns: CalColumn[] = day.tracks.map((tr) => {
    const positioned = tr.events
      .map((e) => {
        const s = validMin(e.start) ?? validMin(e.time);
        if (s == null) return null;
        const en = validMin(e.end);
        const dur = en != null && en > s ? en - s : 30;
        return { event: e, startMin: s, dur };
      })
      .filter(
        (x): x is { event: AgendaEvent; startMin: number; dur: number } => x !== null,
      )
      .sort((a, b) => a.startMin - b.startMin);

    const events: CalEvent[] = [];
    let prevBottom = -Infinity;
    for (const p of positioned) {
      const idealTop = (p.startMin - windowStart) * pxPerMin;
      const height = Math.max(p.dur * pxPerMin, MIN_BLOCK_PX);
      const top = Math.max(idealTop, prevBottom + GAP_PX);
      events.push({
        event: p.event,
        trackId: tr.id,
        trackTitle: tr.title,
        startMin: p.startMin,
        top,
        height,
      });
      prevBottom = top + height;
    }
    return { trackId: tr.id, trackTitle: tr.title, events };
  });

  const bodyHeight = Math.max(
    0,
    ...columns.map((c) =>
      c.events.length ? c.events[c.events.length - 1].top + c.events[c.events.length - 1].height : 0,
    ),
  );

  return {
    dayId: day.id,
    weekday: day.weekday,
    date: day.date,
    day: day.day,
    bodyHeight,
    columns,
  };
}

/** Calcula el layout de toda la semana con una ventana temporal global compartida. */
export function layoutWeek(pxPerMin: number): WeekLayout {
  let gStart = Infinity;
  let gEnd = -Infinity;
  for (const day of agenda.days) {
    for (const tr of day.tracks) {
      for (const e of tr.events) {
        const s = validMin(e.start) ?? validMin(e.time);
        if (s == null) continue;
        gStart = Math.min(gStart, s);
        const en = validMin(e.end);
        gEnd = Math.max(gEnd, en != null && en > s ? en : s + 30);
      }
    }
  }
  if (!isFinite(gStart)) {
    gStart = FALLBACK_START;
    gEnd = FALLBACK_END;
  }
  const windowStart = Math.floor(gStart / 60) * 60;
  const windowEnd = Math.max(Math.ceil(gEnd / 60) * 60, windowStart + 60);

  const hours: number[] = [];
  for (let h = windowStart; h <= windowEnd; h += 60) hours.push(h);

  const days = agenda.days.map((d) => layoutDay(d, pxPerMin, windowStart));
  const windowHeight = (windowEnd - windowStart) * pxPerMin;
  const bodyHeight = Math.max(windowHeight, ...days.map((d) => d.bodyHeight)) + 12;

  return { windowStart, windowEnd, hours, bodyHeight, days };
}

/** 480 -> "8 am", 810 -> "1:30 pm" (marcas horarias solo usan enteros). */
export function hourLabel(min: number): string {
  const h = Math.floor(min / 60);
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${suffix}`;
}
