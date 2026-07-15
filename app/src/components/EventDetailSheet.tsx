import { Check, Clock, MapPin, Plus, Users, Info } from "lucide-react";
import type { AgendaEvent, Speaker } from "../types/agenda";
import { useSelection } from "../store/SelectionContext";
import BottomSheet from "./BottomSheet";
import EventTitle from "./EventTitle";
import SpeakerCard from "./SpeakerCard";
import Flag from "./Flag";

interface EventDetailSheetProps {
  event: AgendaEvent | null;
  trackTitle?: string;
  onClose: () => void;
}

/** Líneas de "details" que no corresponden a un ponente ya listado (info del bloque). */
function infoLines(event: AgendaEvent): string[] {
  const names = new Set(
    event.speakers
      .map((s) => (s.name ?? s.role ?? "").toLowerCase())
      .filter(Boolean),
  );
  return event.details.filter((d) => {
    const low = d.toLowerCase();
    if (/\(\s*pa[ií]s/.test(low)) return false;
    return ![...names].some((n) => low.includes(n) || n.includes(low));
  });
}

export default function EventDetailSheet({ event, trackTitle, onClose }: EventDetailSheetProps) {
  const { has, toggle } = useSelection();
  if (!event) return null;
  const selected = has(event.id);

  // Si no se detectaron ponentes, dejamos un espacio reservado.
  const speakers: Speaker[] =
    event.speakers.length > 0
      ? event.speakers
      : [
          {
            name: null,
            role: null,
            country: event.country,
            iso: event.iso,
            moderator: false,
          },
        ];

  const info = infoLines(event);

  return (
    <BottomSheet
      open={!!event}
      onClose={onClose}
      title={
        <div className="pr-2">
          {event.category && (
            <span className="text-xs font-bold uppercase tracking-wide text-tintv-fg">
              {event.category}
            </span>
          )}
          <h3 className="font-display text-lg leading-tight text-fg">
            <EventTitle title={event.title} className="font-semibold" />
          </h3>
        </div>
      }
      footer={
        <button
          onClick={() => toggle(event.id)}
          className={[
            "flex w-full cursor-pointer items-center justify-center gap-2 rounded-full py-3 text-sm font-bold transition-transform active:scale-[0.98]",
            selected ? "bg-fg text-bg" : "bg-flit-gradient text-white",
          ].join(" ")}
        >
          {selected ? (
            <>
              <Check className="h-5 w-5" /> En tu plan — quitar
            </>
          ) : (
            <>
              <Plus className="h-5 w-5" /> Añadir a mi plan
            </>
          )}
        </button>
      }
    >
      {/* Chips de contexto */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-tintf px-3 py-1.5 text-sm font-semibold text-tintf-fg">
          <Clock className="h-4 w-4" /> {event.time}
        </span>
        {trackTitle && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-tintv px-3 py-1.5 text-sm font-semibold text-tintv-fg">
            <MapPin className="h-4 w-4" /> {trackTitle}
          </span>
        )}
        {event.iso && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface2 px-3 py-1.5 text-sm font-semibold text-fg">
            <Flag iso={event.iso} country={event.country} className="h-3.5 w-5" />
            {event.country}
          </span>
        )}
      </div>

      {/* Ponentes — con espacio para foto + mini CV */}
      <section className="mt-5">
        <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-fg">
          <Users className="h-4 w-4 text-tintf-fg" />
          {speakers.length > 1 ? "Ponentes" : "Ponente"}
          <span className="text-xs font-medium text-muted">
            ({event.speakers.length || "por confirmar"})
          </span>
        </h4>
        <div className="space-y-2">
          {speakers.map((s, i) => (
            <SpeakerCard key={`${s.name ?? "tbd"}-${i}`} speaker={s} />
          ))}
        </div>
      </section>

      {/* Información adicional del bloque */}
      {info.length > 0 && (
        <section className="mt-5">
          <h4 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-fg">
            <Info className="h-4 w-4 text-tintv-fg" /> Sobre este bloque
          </h4>
          <ul className="space-y-1.5">
            {info.map((d, i) => (
              <li
                key={i}
                className="rounded-xl bg-surface2 px-3 py-2 text-sm leading-relaxed text-muted"
              >
                {d}
              </li>
            ))}
          </ul>
        </section>
      )}
    </BottomSheet>
  );
}
