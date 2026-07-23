import {
  AlertCircle,
  AlertTriangle,
  Info,
} from "lucide-react";

import {
  systemAlerts,
  type SystemAlert,
} from "@/data/dashboard";

const alertStyles: Record<
  SystemAlert["level"],
  {
    icon: typeof AlertCircle;
    iconClassName: string;
    containerClassName: string;
  }
> = {
  critical: {
    icon: AlertCircle,
    iconClassName: "text-red-600",
    containerClassName: "border-red-100 bg-red-50/60",
  },
  warning: {
    icon: AlertTriangle,
    iconClassName: "text-amber-600",
    containerClassName: "border-amber-100 bg-amber-50/60",
  },
  info: {
    icon: Info,
    iconClassName: "text-[#F57B00]",
    containerClassName: "border-orange-100 bg-orange-50/60",
  },
};

export function SystemAlerts() {
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <header className="mb-5">
        <h2 className="text-base font-semibold text-zinc-900">
          Alertas do sistema
        </h2>

        <p className="mt-1 text-sm text-zinc-500">
          Itens que precisam de atenção.
        </p>
      </header>

      <div className="space-y-3">
        {systemAlerts.map((alert) => {
          const alertStyle = alertStyles[alert.level];
          const Icon = alertStyle.icon;

          return (
            <button
              key={alert.id}
              type="button"
              className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${alertStyle.containerClassName}`}
            >
              <Icon
                size={20}
                className={`mt-0.5 shrink-0 ${alertStyle.iconClassName}`}
              />

              <span>
                <span className="block text-sm font-semibold text-zinc-900">
                  {alert.title}
                </span>

                <span className="mt-1 block text-xs leading-5 text-zinc-600">
                  {alert.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </article>
  );
}