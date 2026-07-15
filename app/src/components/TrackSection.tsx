import { useMemo } from "react";
import {
  Clock,
  Layers,
  CheckCheck,
  Briefcase,
  Rocket,
  GraduationCap,
  Code2,
  Flower2,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import type { AgendaEvent, Track } from "../types/agenda";
import { selectableEvents } from "../lib/agenda";
import { useSelection } from "../store/SelectionContext";
import EventCard from "./EventCard";

function trackIcon(title: string): LucideIcon {
  const t = title.toLowerCase();
  if (t.includes("pyme") || t.includes("mype")) return Briefcase;
  if (t.includes("demo")) return Rocket;
  if (t.includes("mujer")) return Flower2;
  if (t.includes("educa")) return GraduationCap;
  if (t.includes("hackaton")) return Code2;
  return Megaphone;
}

interface TrackSectionProps {
  track: Track;
  query: string;
  onOpenEvent: (event: AgendaEvent) => void;
  /** Se llama al pulsar «Elegir todo» (no al quitar): para avanzar a lo siguiente. */
  onPickedAll?: () => void;
}

function matches(event: AgendaEvent, q: string): boolean {
  if (!q) return true;
  const haystack = [event.title, event.category, event.country, ...event.details]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q.toLowerCase());
}

export default function TrackSection({
  track,
  query,
  onOpenEvent,
  onPickedAll,
}: TrackSectionProps) {
  const { add, remove, allSelected, selected } = useSelection();

  const pickable = useMemo(() => selectableEvents(track), [track]);
  const pickableIds = useMemo(() => pickable.map((e) => e.id), [pickable]);
  const allOn = allSelected(pickableIds);
  const pickedCount = pickableIds.filter((id) => selected.has(id)).length;
  const Icon = trackIcon(track.title);

  const visible = useMemo(
    () => track.events.filter((e) => (query ? !e.isBreak && matches(e, query) : true)),
    [track.events, query],
  );

  if (query && visible.length === 0) return null;

  const handlePickAll = () => {
    if (allOn) {
      remove(pickableIds);
    } else {
      add(pickableIds);
      onPickedAll?.();
    }
  };

  return (
    <section id={`track-${track.id}`} className="mt-6 scroll-mt-36">
      <div className="overflow-hidden rounded-3xl border border-edge bg-surface shadow-sm">
        <div className="relative overflow-hidden bg-flit-gradient px-4 py-3.5 text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-xl"
          />
          <div className="relative flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/25 backdrop-blur-sm">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-bold leading-tight">{track.title}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/85">
                {track.span && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {track.span}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Layers className="h-3.5 w-3.5" /> {pickable.length} actividades
                </span>
              </div>
            </div>
            <button
              onClick={handlePickAll}
              aria-pressed={allOn}
              className={[
                "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition-all active:scale-95",
                allOn
                  ? "bg-white/20 text-white ring-1 ring-white/40 hover:bg-white/30"
                  : "bg-white text-flit-600 shadow-sm hover:bg-flit-50",
              ].join(" ")}
            >
              <CheckCheck className="h-4 w-4" />
              {allOn ? "Quitar todo" : "Elegir todo"}
            </button>
          </div>
          {pickedCount > 0 && (
            <div className="relative mt-3">
              <div className="flex items-center justify-between text-[11px] font-semibold text-white/90">
                <span>{pickedCount} de {pickable.length} en tu plan</span>
                <span>{Math.round((pickedCount / pickable.length) * 100)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-500"
                  style={{ width: `${(pickedCount / pickable.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 p-3">
          {visible.map((event) => (
            <EventCard key={event.id} event={event} onOpen={onOpenEvent} />
          ))}
        </div>
      </div>
    </section>
  );
}
