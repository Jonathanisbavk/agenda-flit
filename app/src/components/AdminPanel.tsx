import { useEffect, useState } from "react";
import { Radio, X, CheckCircle2 } from "lucide-react";
import {
  autoLive,
  effectiveLive,
  readOverride,
  writeOverride,
  type LiveOverride,
} from "../lib/liveStatus";

/** Ruta secreta del panel (igual convención que el panel del scraper). */
export const ADMIN_SLUG = "panel-flit-ops-9k27x";

const OPTIONS: { id: LiveOverride; label: string; hint: string }[] = [
  { id: "auto", label: "Automático", hint: "Según la fecha del festival (sistema)" },
  { id: "on", label: "En vivo", hint: "Forzar el badge «¡En vivo!»" },
  { id: "off", label: "Apagado", hint: "Forzar la cuenta regresiva" },
];

/**
 * Panel de admin con **verificación manual** del estado "en vivo".
 * El sistema automático (por fecha) sigue funcionando: "Automático" lo respeta;
 * "En vivo"/"Apagado" son overrides manuales que se guardan en este dispositivo.
 */
export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [override, setOverride] = useState<LiveOverride>(readOverride);
  // Recalcula el estado mostrado cada segundo (por si el automático cambia).
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const apply = (value: LiveOverride) => {
    writeOverride(value);
    setOverride(value);
  };

  const auto = autoLive();
  const live = effectiveLive();

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Panel de administración"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-edge bg-surface shadow-2xl">
        <div className="flex items-center justify-between bg-flit-gradient px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            <h2 className="font-display text-base font-extrabold">Panel · Verificación manual</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar panel"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 hover:bg-white/30"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-2xl border border-edge bg-surface2 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Estado del sistema (fecha)</span>
              <span className="font-semibold">{auto ? "En vivo" : "Antes del inicio"}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted">Estado mostrado ahora</span>
              <span
                className={[
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
                  live ? "bg-flit-gradient text-white" : "bg-surface text-muted ring-1 ring-edge",
                ].join(" ")}
              >
                {live && (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                  </span>
                )}
                {live ? "¡En vivo!" : "Cuenta regresiva"}
              </span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
              Verificación manual del «en vivo»
            </p>
            <div className="space-y-2">
              {OPTIONS.map((opt) => {
                const active = override === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => apply(opt.id)}
                    aria-pressed={active}
                    className={[
                      "flex min-h-[44px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-2.5 text-left transition-colors",
                      active
                        ? "border-transparent bg-flit-gradient text-white"
                        : "border-edge bg-surface hover:bg-surface2",
                    ].join(" ")}
                  >
                    <span>
                      <span className="block text-sm font-bold">{opt.label}</span>
                      <span
                        className={[
                          "block text-xs",
                          active ? "text-white/85" : "text-muted",
                        ].join(" ")}
                      >
                        {opt.hint}
                      </span>
                    </span>
                    {active && <CheckCircle2 className="h-5 w-5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-muted">
            La preferencia manual se guarda en este dispositivo. El sistema automático por fecha
            sigue funcionando y se usa cuando eliges «Automático».
          </p>
        </div>
      </div>
    </div>
  );
}
