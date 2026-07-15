import { agenda, shortDate } from "../lib/agenda";
import { useSelection } from "../store/SelectionContext";

interface DayNavProps {
  activeDayId: string;
  onSelect: (dayId: string) => void;
}

export default function DayNav({ activeDayId, onSelect }: DayNavProps) {
  const { selected } = useSelection();

  return (
    <nav
      id="day-nav"
      aria-label="Días del festival"
      className="sticky top-[var(--header-h,105px)] z-20 -mx-4 mt-5 border-y border-edge bg-bg/90 px-4 py-2 backdrop-blur-md"
    >
      <div className="no-scrollbar mx-auto flex max-w-3xl gap-2 overflow-x-auto">
        {agenda.days.map((day) => {
          const isActive = day.id === activeDayId;
          const dayEventIds = day.tracks.flatMap((t) => t.events.map((e) => e.id));
          const picked = dayEventIds.filter((id) => selected.has(id)).length;
          return (
            <button
              key={day.id}
              onClick={() => onSelect(day.id)}
              aria-current={isActive ? "true" : undefined}
              className={[
                "flex shrink-0 cursor-pointer flex-col items-start rounded-2xl border px-4 py-2 text-left transition-all active:scale-95",
                isActive
                  ? "border-transparent bg-flit-gradient text-white shadow-md shadow-flit-500/25"
                  : "border-edge bg-surface text-fg hover:-translate-y-0.5 hover:border-violet/40 hover:shadow-sm",
              ].join(" ")}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                {day.weekday}
              </span>
              <span className="font-display text-base font-bold leading-none">
                {shortDate(day.date)}
              </span>
              {picked > 0 && (
                <span
                  className={[
                    "mt-1 rounded-full px-1.5 text-[10px] font-bold",
                    isActive ? "bg-white/25 text-white" : "bg-tintf text-tintf-fg",
                  ].join(" ")}
                >
                  {picked} elegidas
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
