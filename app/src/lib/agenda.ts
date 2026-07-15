import rawData from "../data/agenda.json";
import type { Agenda, Day, Track, AgendaEvent, SelectedEvent } from "../types/agenda";

export const agenda = rawData as Agenda;

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** "2026-07-16" -> "16 Jul" (etiqueta corta para tabs) */
export function shortDate(iso: string | null): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS_ES[Number(m) - 1].slice(0, 3)}`;
}

/** "2026-07-16" -> "Jueves 16 de Julio, 2026" */
export function longDate(weekday: string, iso: string | null): string {
  if (!iso) return weekday;
  const [y, m, d] = iso.split("-");
  return `${weekday} ${Number(d)} de ${MONTHS_ES[Number(m) - 1]}, ${y}`;
}

/** "9:40" -> 580 (minutos desde medianoche), para ordenar de forma estable */
export function toMinutes(time: string | null): number {
  if (!time) return Number.MAX_SAFE_INTEGER;
  const m = time.match(/(\d{1,2}):(\d{2})/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Eventos de un track que el usuario puede elegir (excluye descansos). */
export function selectableEvents(track: Track): AgendaEvent[] {
  return track.events.filter((e) => !e.isBreak);
}

export function findDay(dayId: string): Day | undefined {
  return agenda.days.find((d) => d.id === dayId);
}

/** Mapa id-de-evento -> título de su track, para el panel de detalle. */
export const trackTitleByEvent: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const day of agenda.days) {
    for (const track of day.tracks) {
      for (const ev of track.events) map[ev.id] = track.title;
    }
  }
  return map;
})();

/**
 * A partir de un set de ids seleccionados, devuelve los eventos enriquecidos
 * con contexto de día/track y ordenados cronológicamente. Base del itinerario.
 */
export function buildItinerary(selected: Set<string>): SelectedEvent[] {
  const out: SelectedEvent[] = [];
  for (const day of agenda.days) {
    for (const track of day.tracks) {
      for (const ev of track.events) {
        if (selected.has(ev.id)) {
          out.push({
            ...ev,
            dayId: day.id,
            weekday: day.weekday,
            date: day.date,
            dayNumber: day.day,
            trackId: track.id,
            trackTitle: track.title,
          });
        }
      }
    }
  }
  out.sort((a, b) => {
    const da = (a.date ?? "") + "";
    const db = (b.date ?? "") + "";
    if (da !== db) return da < db ? -1 : 1;
    return toMinutes(a.start) - toMinutes(b.start);
  });
  return out;
}

/** Agrupa el itinerario por día (preservando orden cronológico). */
export function groupByDay(events: SelectedEvent[]): {
  dayId: string;
  weekday: string;
  date: string | null;
  events: SelectedEvent[];
}[] {
  const map = new Map<string, SelectedEvent[]>();
  for (const ev of events) {
    const arr = map.get(ev.dayId) ?? [];
    arr.push(ev);
    map.set(ev.dayId, arr);
  }
  return [...map.entries()].map(([dayId, evs]) => ({
    dayId,
    weekday: evs[0].weekday,
    date: evs[0].date,
    events: evs,
  }));
}
