import { useMemo, useState } from "react";
import {
  CalendarX2,
  Download,
  Trash2,
  X,
  Clock,
  Loader2,
  Sun,
  Moon,
} from "lucide-react";
import { useSelection } from "../store/SelectionContext";
import { buildItinerary, groupByDay, longDate } from "../lib/agenda";
import { isDark, setThemeChoice } from "../lib/theme";
import { useThemeChoice } from "../lib/useTheme";
import BottomSheet from "./BottomSheet";
import EventTitle from "./EventTitle";

interface ItineraryModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ItineraryModal({ open, onClose }: ItineraryModalProps) {
  const { selected, remove, clear, count } = useSelection();
  const [busy, setBusy] = useState(false);
  const choice = useThemeChoice();
  const dark = isDark(choice);

  const groups = useMemo(
    () => (open ? groupByDay(buildItinerary(selected)) : []),
    [open, selected],
  );

  const download = async () => {
    setBusy(true);
    try {
      const { generateItineraryPdf } = await import("../lib/pdf");
      generateItineraryPdf(selected);
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={
        <div>
          <h3 className="font-display text-lg font-bold leading-tight text-fg">
            Mi cronograma
          </h3>
          <p className="text-xs text-muted">
            {count > 0 ? `${count} actividades seleccionadas` : "Aún no eliges nada"}
          </p>
        </div>
      }
      footer={
        count > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1 rounded-full border border-edge bg-surface p-1">
              <button
                onClick={() => setThemeChoice("light")}
                aria-pressed={!dark}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full py-2 text-sm font-bold transition-colors ${
                  !dark ? "bg-flit-gradient text-white" : "text-muted hover:bg-surface2"
                }`}
              >
                <Sun className="h-4 w-4" /> Claro
              </button>
              <button
                onClick={() => setThemeChoice("dark")}
                aria-pressed={dark}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full py-2 text-sm font-bold transition-colors ${
                  dark ? "bg-flit-gradient text-white" : "text-muted hover:bg-surface2"
                }`}
              >
                <Moon className="h-4 w-4" /> Oscuro
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (confirm("¿Vaciar todo tu cronograma?")) clear();
                }}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-edge px-4 py-3 text-sm font-semibold text-muted transition-colors hover:bg-surface2"
              >
                <Trash2 className="h-4 w-4" /> Vaciar
              </button>
              <button
                onClick={download}
                disabled={busy}
                className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-flit-gradient py-3 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-70"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                {busy ? "Generando…" : "Descargar PDF"}
              </button>
            </div>
          </div>
        ) : null
      }
    >
      {count === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-tintf text-tintf-fg">
            <CalendarX2 className="h-8 w-8" />
          </span>
          <p className="max-w-xs text-sm text-muted">
            Explora la agenda y toca el círculo de cada actividad para armar tu plan.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.dayId}>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-tintv-fg">
                {longDate(g.weekday, g.date)}
              </h4>
              <ul className="space-y-2">
                {g.events.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-start gap-3 rounded-2xl border border-edge bg-surface p-3"
                  >
                    <span className="flex w-14 shrink-0 flex-col items-end pt-0.5 text-right tabular-nums">
                      <span className="text-sm font-bold text-fg">{ev.start}</span>
                      {ev.end && <span className="text-[11px] text-muted">{ev.end}</span>}
                    </span>
                    <div className="min-w-0 flex-1">
                      <EventTitle
                        title={ev.title}
                        className="block text-sm font-medium leading-snug text-fg"
                      />
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted">
                        <Clock className="h-3 w-3" /> {ev.trackTitle}
                      </p>
                    </div>
                    <button
                      onClick={() => remove([ev.id])}
                      aria-label={`Quitar ${ev.title}`}
                      className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-tintf hover:text-tintf-fg"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
