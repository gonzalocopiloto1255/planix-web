import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { obtenerSuscripcion } from '../lib/billing';

// =====================================================================
// Vuelta del checkout de Mercado Pago (Sesión 21 — §11).
//
// Mercado Pago devuelve al usuario ANTES de que llegue el webhook, así
// que esta pantalla NO activa nada: consulta el estado cada 3 segundos
// (hasta 60) esperando la confirmación del servidor. Si el webhook tarda
// más, se avisa con calma — el pago no se pierde, y en cuanto MP notifique
// la suscripción quedará activa sola.
// =====================================================================

const INTERVALO_MS = 3000;
const ESPERA_MAXIMA_MS = 60000;

export function SuscripcionResultado() {
  const [segundos, setSegundos] = useState(0);
  const agotado = segundos * 1000 >= ESPERA_MAXIMA_MS;

  const { data: suscripcion } = useQuery({
    queryKey: ['suscripcion'],
    queryFn: obtenerSuscripcion,
    refetchInterval: (query) => {
      const estado = query.state.data?.estado;
      return estado === 'ACTIVE' || agotado ? false : INTERVALO_MS;
    },
  });

  useEffect(() => {
    if (suscripcion?.estado === 'ACTIVE' || agotado) {
      return;
    }
    const t = setInterval(() => setSegundos((s) => s + INTERVALO_MS / 1000), INTERVALO_MS);
    return () => clearInterval(t);
  }, [suscripcion?.estado, agotado]);

  const confirmada = suscripcion?.estado === 'ACTIVE';

  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-tarjeta bg-superficie p-8 text-center shadow-tarjeta">
      {confirmada ? (
        <>
          <h1 className="text-titulo font-semibold text-exito">
            ¡Suscripción activa!
          </h1>
          <p className="text-cuerpo text-texto-suave">
            Tu plan {suscripcion?.plan?.nombre} quedó activo
            {suscripcion?.vigenteHasta
              ? ` hasta el ${suscripcion.vigenteHasta}`
              : ''}
            . Ya puedes seguir trabajando con normalidad.
          </p>
        </>
      ) : agotado ? (
        <>
          <h1 className="text-titulo font-semibold text-texto">
            Seguimos esperando la confirmación
          </h1>
          <p className="text-cuerpo text-texto-suave">
            Mercado Pago aún no nos confirma el cobro. No hace falta que pagues
            de nuevo: en cuanto llegue la confirmación tu suscripción se activa
            sola. Si en unos minutos sigue igual, escríbenos.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-titulo font-semibold text-texto">
            Confirmando tu pago…
          </h1>
          <p className="text-cuerpo text-texto-suave">
            Estamos esperando la confirmación de Mercado Pago ({segundos}s). No
            cierres esta ventana.
          </p>
          <div className="mx-auto h-1.5 w-48 overflow-hidden rounded-full bg-fondo">
            <div
              className="h-1.5 rounded-full bg-primario transition-all"
              style={{
                width: `${Math.min(100, (segundos * 1000 * 100) / ESPERA_MAXIMA_MS)}%`,
              }}
            />
          </div>
        </>
      )}

      <Link
        to="/suscripcion"
        className="inline-block rounded-control bg-primario px-4 py-2 text-cuerpo font-medium text-white hover:bg-primario-oscuro"
      >
        Ver mi suscripción
      </Link>
    </div>
  );
}
