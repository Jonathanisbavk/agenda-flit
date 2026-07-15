import { useEffect, useState } from "react";

// Inicio del festival: 15 de julio 2026, 08:00 (hora de Perú, UTC-5).
const TARGET = new Date("2026-07-15T08:00:00-05:00").getTime();

interface Parts {
  days: number;
  hours: number;
  minutes: number;
  live: boolean;
}

function diff(): Parts {
  const ms = TARGET - Date.now();
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, live: true };
  const minutes = Math.floor(ms / 60000);
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
    const id = window.setInterval(() => setParts(diff()), 30000);
    return () => window.clearInterval(id);
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
