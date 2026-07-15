import { Check, Plus, Coffee, Info, ChevronRight } from "lucide-react";
import type { AgendaEvent } from "../types/agenda";
import { useSelection } from "../store/SelectionContext";
import EventTitle from "./EventTitle";
import Flag from "./Flag";

interface EventCardProps {
  event: AgendaEvent;
  onOpen: (event: AgendaEvent) => void;
}

export default function EventCard({ event, onOpen }: EventCardProps) {
  const { has, toggle } = useSelection();

  // Pausas / descansos: fila discreta, no seleccionable.
  if (event.isBreak) {
    return (
      <div className="flex items-center gap-3 py-2 pl-1 text-muted">
        <span className="w-14 shrink-0 text-right text-xs font-semibold tabular-nums">
          {event.start}
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
          <Coffee className="h-3.5 w-3.5" />
          {event.title}
        </span>
        <span className="h-px flex-1 bg-edge" />
      </div>
    );
  }

  const selected = has(event.id);

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-card border shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        selected
          ? "border-tintf-fg/50 bg-tintf shadow-flit-500/15"
          : "border-edge bg-surface hover:border-violet/40",
      ].join(" ")}
    >
      {/* Tocar la barra = agregar / quitar del plan (sin mostrar el detalle). */}
      <button
        onClick={() => toggle(event.id)}
        aria-pressed={selected}
        aria-label={
          selected
            ? `Quitar ${event.title} de mi plan`
            : `Agregar ${event.title} a mi plan`
        }
        className="flex w-full cursor-pointer items-start gap-3 py-3 pl-4 pr-3 text-left"
      >
        <span
          aria-hidden
          className={[
            "absolute left-0 top-0 h-full w-1.5 transition-colors",
            selected ? "bg-flit-gradient" : "bg-transparent",
          ].join(" ")}
        />

        <span className="flex w-14 shrink-0 flex-col items-end pt-0.5 text-right tabular-nums">
          <span className="font-display text-sm font-bold leading-tight text-fg">
            {event.start}
          </span>
          {event.end && (
            <span className="text-[11px] leading-tight text-muted">{event.end}</span>
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="mb-1 flex items-center gap-2">
            {event.category && (
              <span className="inline-block rounded-full bg-tintv px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-tintv-fg">
                {event.category}
              </span>
            )}
            {event.iso && (
              <Flag iso={event.iso} country={event.country} className="h-3 w-[18px]" />
            )}
          </span>
          <EventTitle
            title={event.title}
            className="block text-sm font-medium leading-snug text-fg"
          />
        </span>

        {/* Indicador de selección (icono + color + borde, no solo color). */}
        <span
          className={[
            "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-all",
            selected
              ? "border-transparent bg-flit-gradient text-white"
              : "border-fg/25 bg-surface text-muted group-hover:border-violet/60",
          ].join(" ")}
        >
          {selected ? (
            <Check className="h-4 w-4" strokeWidth={3} />
          ) : (
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          )}
        </span>
      </button>

      {/* La información del evento solo se revela aquí. */}
      <button
        onClick={() => onOpen(event)}
        aria-label={`Ver más información de ${event.title}`}
        className="flex w-full cursor-pointer items-center justify-center gap-1 border-t border-edge py-2 text-xs font-semibold text-tintv-fg transition-colors hover:bg-surface2"
      >
        <Info className="h-3.5 w-3.5" /> Más información
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
