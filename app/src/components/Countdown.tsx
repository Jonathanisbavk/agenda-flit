import { useEffect, useState } from "react";
import { FESTIVAL_START, LIVE_EVENT, effectiveLive } from "../lib/liveStatus";

interface Parts {
  days: number;
  hours: number;
  minutes: number;
  live: boolean;
}

function diff(): Parts {
  // El estado "en vivo" respeta la verificación manual; si no hay, manda la fecha.
  const live = effectiveLive();
  if (live) return { days: 0, hours: 0, minutes: 0, live: true };
  const ms = FESTIVAL_START - Date.now();
  const minutes = Math.max(0, Math.floor(ms / 60000));
  return {
    days: Math.floor(minutes / 1440),
    hours: Math.floor((minutes % 1440) / 60),
    minutes: minutes % 60,
    live: false,
  };
}

export default function Countdown() {
  const [parts, setParts] = useState<Parts>(diff);

  useEffect(() => {
    const update = () => setParts(diff());
    const id = window.setInterval(update, 30000);
    // Reacciona a la verificación manual (misma pestaña) y a otras pestañas.
    window.addEventListener(LIVE_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(LIVE_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  if (parts.live) {
    return (
      <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/30 backdrop-blur-sm">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
        </span>
        ¡El festival está en vivo!
      </div>
    );
  }

  const cells: { value: number; label: string }[] = [
    { value: parts.days, label: "días" },
    { value: parts.hours, label: "horas" },
    { value: parts.minutes, label: "min" },
  ];

  return (
    <div className="mt-5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-white/70">
        Comienza en
      </p>
      <div className="flex gap-2" role="timer" aria-label="Cuenta regresiva para el inicio del festival">
        {cells.map((c) => (
          <div
            key={c.label}
            className="flex min-w-[58px] flex-col items-center rounded-2xl bg-white/15 px-3 py-2 ring-1 ring-white/25 backdrop-blur-md"
          >
            <span className="font-display text-2xl font-extrabold leading-none text-white tabular-nums">
              {String(c.value).padStart(2, "0")}
            </span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/75">
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
