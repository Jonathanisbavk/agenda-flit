import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Coffee, Info, ChevronLeft, ChevronRight } from "lucide-react";
import type { AgendaEvent } from "../types/agenda";
import { useSelection } from "../store/SelectionContext";
import { shortDate } from "../lib/agenda";
import { layoutWeek, hourLabel, type CalEvent } from "../lib/calendar";
import EventTitle from "./EventTitle";

const PX_PER_MIN = 1.5;
const DAY_H = 56; // fila del nombre del día
const CHIP_H = 34; // fila del chip de track
const HEADER_H = DAY_H + CHIP_H;
const GUTTER = 56; // ancho de la regla horaria (px)
const MIN_TRACK = 150; // ancho mínimo de columna de track (px)

type Span = 1 | 2 | 3;

/** Dos acentos de marca para distinguir los tracks paralelos (escenarios). */
const ACCENTS = [
  { bar: "bg-magenta", chip: "bg-tintf text-tintf-fg" },
  { bar: "bg-violet", chip: "bg-tintv text-tintv-fg" },
];

function initialSpan(): Span {
  if (typeof window === "undefined") return 1;
  if (window.matchMedia("(min-width: 1024px)").matches) return 3;
  if (window.matchMedia("(min-width: 640px)").matches) return 2;
  return 1;
}

/** Nº de líneas de título que caben según la altura del bloque. */
function clampLines(height: number): number {
  return Math.max(1, Math.min(5, Math.floor((height - 26) / 17)));
}

interface BlockProps {
  ce: CalEvent;
  accentIdx: number;
  onOpen: (event: AgendaEvent) => void;
}

function Block({ ce, accentIdx, onOpen }: BlockProps) {
  const { has, toggle } = useSelection();
  const ev = ce.event;
  const style = { top: ce.top, height: ce.height } as const;

  if (ev.isBreak) {
    return (
      <div
        className="absolute inset-x-1 flex items-center gap-1.5 overflow-hidden rounded-lg border border-dashed border-edge bg-surface2/70 px-2 text-muted"
        style={style}
      >
        <Coffee className="h-4 w-4 shrink-0" />
        <span className="truncate text-xs font-semibold uppercase tracking-wide">
          {ev.title}
        </span>
      </div>
    );
  }

  const selected = has(ev.id);
  const accent = ACCENTS[accentIdx % ACCENTS.length];
  const lines = clampLines(ce.height);
  const timeText = ev.end ? `${ev.start}–${ev.end}` : ev.start;
  const showCategory =
    ce.height >= 88 &&
    !!ev.category &&
    ev.category.toUpperCase() !== ev.title.toUpperCase();

  return (
    <div className="absolute inset-x-1" style={style}>
      <button
        onClick={() => toggle(ev.id)}
        aria-pressed={selected}
        aria-label={
          selected ? `Quitar ${ev.title} de mi plan` : `Agregar ${ev.title} a mi plan`
        }
        className={[
          "group flex h-full w-full cursor-pointer flex-col gap-1 overflow-hidden rounded-xl border py-2 pl-3 pr-2 text-left shadow-sm transition-colors duration-200",
          selected
            ? "border-transparent bg-flit-gradient text-white"
            : "border-edge bg-surface text-fg hover:bg-surface2",
        ].join(" ")}
      >
        {!selected && (
          <span aria-hidden className={`absolute left-0 top-0 h-full w-1.5 ${accent.bar}`} />
        )}

        {/* fila superior: estado + hora (deja hueco a la derecha para el botón info) */}
        <span className="flex items-center gap-1.5 pr-8">
          <span
            className={[
              "grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
              selected
                ? "border-transparent bg-white/25 text-white"
                : "border-fg/25 text-muted group-hover:border-violet/60",
            ].join(" ")}
          >
            {selected ? (
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            ) : (
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            )}
          </span>
          <span
            className={[
              "truncate text-xs font-bold tabular-nums",
              selected ? "text-white/90" : "text-muted",
            ].join(" ")}
          >
            {timeText}
          </span>
        </span>

        {showCategory && (
          <span
            className={[
              "w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wide",
              selected ? "bg-white/20 text-white" : accent.chip,
            ].join(" ")}
          >
            {ev.category}
          </span>
        )}

        <span
          className="text-sm font-medium leading-snug"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: lines,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          <EventTitle title={ev.title} />
        </span>
      </button>

      {/* Botón de información — claro, con fondo y objetivo táctil holgado. */}
      <button
        onClick={() => onOpen(ev)}
        aria-label={`Ver información de ${ev.title}`}
        className={[
          "absolute right-1.5 top-1.5 grid h-8 w-8 cursor-pointer place-items-center rounded-full border transition-colors",
          selected
            ? "border-white/40 bg-white/15 text-white hover:bg-white/30"
            : "border-edge bg-surface2 text-tintv-fg hover:bg-tintv hover:text-tintv-fg",
        ].join(" ")}
      >
        <Info className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

interface CalendarViewProps {
  activeDayId: string;
  onSelectDay: (dayId: string) => void;
  onOpenEvent: (event: AgendaEvent) => void;
}

export default function CalendarView({
  activeDayId,
  onSelectDay,
  onOpenEvent,
}: CalendarViewProps) {
  const week = useMemo(() => layoutWeek(PX_PER_MIN), []);
  const total = week.days.length;
  const [span, setSpanState] = useState<Span>(initialSpan);
  const userChose = useRef(false);

  // Corrige el valor por defecto si al montar el ancho aún no estaba disponible;
  // solo una vez y nunca sobre una elección explícita del usuario.
  useEffect(() => {
    if (!userChose.current) setSpanState(initialSpan());
  }, []);

  const setSpan = (n: Span) => {
    userChose.current = true;
    setSpanState(n);
  };

  const effSpan = Math.min(span, total) as Span;
  const maxStart = Math.max(0, total - effSpan);
  const activeIdx = Math.max(
    0,
    week.days.findIndex((d) => d.dayId === activeDayId),
  );
  const startIdx = Math.min(activeIdx, maxStart);
  const visible = week.days.slice(startIdx, startIdx + effSpan);
  const canPrev = startIdx > 0;
  const canNext = startIdx < maxStart;

  const rangeLabel =
    visible.length === 1
      ? `${visible[0].weekday} ${visible[0].day}`
      : `${shortDate(visible[0].date)} – ${shortDate(visible[visible.length - 1].date)}`;

  const spanOpts: Span[] = [1, 2, 3];

  return (
    <section aria-label="Calendario de la semana" className="mt-4">
      {/* Barra de control: navegación de días + selector de cuántos días ver */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => canPrev && onSelectDay(week.days[startIdx - 1].dayId)}
            disabled={!canPrev}
            aria-label="Días anteriores"
            className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-edge bg-surface text-fg transition-colors hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="min-w-[7rem] text-center font-display text-sm font-bold text-fg">
            {rangeLabel}
          </span>
          <button
            onClick={() => canNext && onSelectDay(week.days[startIdx + 1].dayId)}
            disabled={!canNext}
            aria-label="Días siguientes"
            className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-edge bg-surface text-fg transition-colors hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div
          role="group"
          aria-label="Cuántos días mostrar"
          className="inline-flex items-center gap-1 rounded-full border border-edge bg-surface p-1 shadow-sm"
        >
          <span className="pl-2 pr-1 text-xs font-semibold text-muted">Ver</span>
          {spanOpts.map((n) => {
            const active = span === n;
            return (
              <button
                key={n}
                onClick={() => setSpan(n)}
                aria-pressed={active}
                aria-label={`Mostrar ${n} ${n === 1 ? "día" : "días"}`}
                className={[
                  "min-h-[40px] min-w-[40px] cursor-pointer rounded-full px-3 text-sm font-bold transition-colors",
                  active ? "bg-flit-gradient text-white" : "text-muted hover:bg-surface2",
                ].join(" ")}
              >
                {n}
              </button>
            );
          })}
          <span className="pl-1 pr-2 text-xs font-semibold text-muted">
            {span === 1 ? "día" : "días"}
          </span>
        </div>
      </div>

      <div
        className="overflow-auto rounded-3xl border border-edge bg-surface shadow-sm"
        style={{ maxHeight: "calc(100dvh - 250px)", minHeight: 440 }}
      >
        <div className="flex w-full">
          {/* Regla horaria (columna fija a la izquierda) */}
          <div
            className="sticky left-0 z-20 shrink-0 border-r border-edge bg-surface"
            style={{ width: GUTTER }}
          >
            <div style={{ height: HEADER_H }} className="border-b border-edge" />
            <div className="relative" style={{ height: week.bodyHeight }}>
              {week.hours.map((h) => (
                <div
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[11px] font-bold text-muted"
                  style={{ top: (h - week.windowStart) * PX_PER_MIN }}
                >
                  {hourLabel(h)}
                </div>
              ))}
            </div>
          </div>

          {/* Días visibles */}
          {visible.map((day) => (
            <div
              key={day.dayId}
              className="flex flex-1 flex-col border-l border-edge first:border-l-0"
              style={{ minWidth: Math.max(1, day.columns.length) * MIN_TRACK }}
            >
              {/* Cabecera del día (sticky arriba) */}
              <div
                className="sticky top-0 z-10 flex items-center justify-center gap-2 border-b border-edge bg-surface px-2 text-center"
                style={{ height: DAY_H }}
              >
                <span className="font-display text-base font-bold text-fg">{day.weekday}</span>
                <span className="grid h-8 min-w-8 place-items-center rounded-full bg-flit-gradient px-2 text-base font-bold text-white">
                  {day.day}
                </span>
              </div>

              {/* Columnas de track */}
              <div className="flex flex-1">
                {day.columns.map((col, i) => (
                  <div
                    key={col.trackId}
                    className="relative min-w-0 flex-1 border-l border-edge/50 first:border-l-0"
                  >
                    {/* Chip del track (sticky bajo la cabecera) */}
                    <div
                      className="sticky z-10 flex items-center bg-surface px-1.5"
                      style={{ top: DAY_H, height: CHIP_H }}
                    >
                      <span
                        className={`truncate rounded-full px-2 py-1 text-[11px] font-bold uppercase leading-none tracking-wide ${ACCENTS[i % ACCENTS.length].chip}`}
                        title={col.trackTitle}
                      >
                        {col.trackTitle}
                      </span>
                    </div>

                    {/* Cuerpo con líneas horarias + bloques */}
                    <div className="relative" style={{ height: week.bodyHeight }}>
                      {week.hours.map((h) => (
                        <div
                          key={h}
                          aria-hidden
                          className="absolute inset-x-0 border-t border-edge/40"
                          style={{ top: (h - week.windowStart) * PX_PER_MIN }}
                        />
                      ))}
                      {col.events.map((ce) => (
                        <Block key={ce.event.id} ce={ce} accentIdx={i} onOpen={onOpenEvent} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-2 px-1 text-center text-sm text-muted">
        Toca un bloque para agregarlo a tu plan · el botón{" "}
        <Info className="inline h-4 w-4 align-text-bottom" /> muestra los detalles
      </p>
    </section>
  );
}
