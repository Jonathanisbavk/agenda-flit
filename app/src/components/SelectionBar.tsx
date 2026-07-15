import { useState } from "react";
import { Download, ListChecks, Loader2 } from "lucide-react";
import { useSelection } from "../store/SelectionContext";

interface SelectionBarProps {
  onView: () => void;
}

export default function SelectionBar({ onView }: SelectionBarProps) {
  const { count, selected } = useSelection();
  const [busy, setBusy] = useState(false);

  if (count === 0) return null;

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
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="mx-auto flex max-w-3xl items-center gap-2 rounded-2xl border border-edge bg-surface/95 p-2 shadow-lg shadow-black/10 backdrop-blur-md">
        <button
          onClick={onView}
          className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface2"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-flit-gradient text-white">
            <ListChecks className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-base font-bold text-fg">
              {count} {count === 1 ? "actividad" : "actividades"}
            </span>
            <span className="block text-[11px] text-muted">Toca para revisar tu plan</span>
          </span>
        </button>
        <button
          onClick={download}
          disabled={busy}
          className="flex shrink-0 cursor-pointer items-center gap-2 rounded-xl bg-flit-gradient px-4 py-3 text-sm font-bold text-white transition-transform active:scale-95 disabled:opacity-70"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          <span className="hidden sm:inline">Descargar PDF</span>
          <span className="sm:hidden">PDF</span>
        </button>
      </div>
    </div>
  );
}
