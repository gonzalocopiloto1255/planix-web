import { AlertTriangle, CheckCircle2, X, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useToasts } from '../stores/toast';

// =====================================================================
// Avisos flotantes. Cada tono lleva SU ICONO: el color no puede ser el
// único indicador de si algo salió bien o mal (accesibilidad).
// =====================================================================

const TONOS: Record<string, { clase: string; Icono: LucideIcon }> = {
  exito: { clase: 'border-exito/25 bg-exito-suave text-exito', Icono: CheckCircle2 },
  error: { clase: 'border-peligro/25 bg-peligro-suave text-peligro', Icono: XCircle },
  advertencia: {
    clase: 'border-advertencia/30 bg-advertencia-suave text-advertencia',
    Icono: AlertTriangle,
  },
};

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const quitar = useToasts((s) => s.quitar);

  if (toasts.length === 0) {
    return null;
  }
  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex w-84 flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const { clase, Icono } = TONOS[t.tipo] ?? TONOS.exito;
        return (
          <div
            key={t.id}
            className={`transicion flex items-start gap-2.5 rounded-tarjeta border bg-superficie px-4 py-3 text-cuerpo shadow-flotante ${clase}`}
          >
            <Icono className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="min-w-0 flex-1">{t.texto}</p>
            <button
              type="button"
              onClick={() => quitar(t.id)}
              aria-label="Cerrar aviso"
              className="transicion -mr-1 shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
