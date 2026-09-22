import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api';
import {
  COLOR_ESTADO_SUSCRIPCION,
  NOMBRE_ESTADO_SUSCRIPCION,
  listarTenants,
  otorgarCortesia,
  revocarCortesia,
} from '../lib/billing';
import { useAuth } from '../stores/auth';
import { useToasts } from '../stores/toast';

// =====================================================================
// Panel de plataforma (Sesión 21 — §11): SOLO SUPERADMIN.
// Lista los estudios contables con su plan, su estado y su uso, y
// permite dar o quitar la cortesía (COMPLIMENTARY), que es como el
// estudio benefactor usa Planix sin pagar. Ambas acciones se auditan.
// =====================================================================

export function AdminTenants() {
  const rol = useAuth((s) => s.sesion?.usuario.rol);
  const agregarToast = useToasts((s) => s.agregar);
  const queryClient = useQueryClient();

  const { data: tenants } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: listarTenants,
    enabled: rol === 'SUPERADMIN',
  });

  const cambiar = useMutation({
    mutationFn: ({ id, cortesia }: { id: string; cortesia: boolean }) =>
      cortesia ? otorgarCortesia(id) : revocarCortesia(id),
    onSuccess: (fila) => {
      agregarToast(
        'exito',
        `${fila.nombre}: ${NOMBRE_ESTADO_SUSCRIPCION[fila.estado ?? 'TRIAL']}`,
      );
      void queryClient.invalidateQueries({ queryKey: ['admin-tenants'] });
    },
    onError: (e) =>
      agregarToast(
        'error',
        e instanceof ApiError ? e.message : 'No se pudo cambiar la cortesía',
      ),
  });

  if (rol !== 'SUPERADMIN') {
    return (
      <p className="text-cuerpo text-texto-suave">
        Esta sección es del administrador de la plataforma.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-titulo font-semibold text-texto">Estudios contables</h1>
        <p className="text-cuerpo text-texto-suave">
          Suscripciones de la plataforma. La cortesía no vence y no tiene
          límites de plan.
        </p>
      </header>

      <div className="overflow-x-auto rounded-tarjeta bg-superficie shadow-tarjeta">
        <table className="w-full text-left text-cuerpo">
          <thead>
            <tr className="border-b border-borde text-apoyo uppercase text-texto-tenue">
              <th className="px-4 py-3">Estudio</th>
              <th className="px-4 py-3">RUC</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Alta</th>
              <th className="px-4 py-3">Vigencia</th>
              <th className="cifras px-4 py-3 text-right">Empresas</th>
              <th className="cifras px-4 py-3 text-right">Trabajadores</th>
              <th className="cifras px-4 py-3 text-right">Cortesía</th>
            </tr>
          </thead>
          <tbody>
            {(tenants ?? []).map((t) => (
              <tr key={t.id} className="border-b border-borde">
                <td className="px-4 py-3 font-medium text-texto">{t.nombre}</td>
                <td className="px-4 py-3 text-texto-suave">{t.ruc ?? '—'}</td>
                <td className="px-4 py-3 text-texto-suave">{t.plan ?? '—'}</td>
                <td className="px-4 py-3">
                  {t.estado ? (
                    <span
                      className={`rounded-full px-2.5 py-1 text-apoyo font-semibold ${COLOR_ESTADO_SUSCRIPCION[t.estado]}`}
                    >
                      {NOMBRE_ESTADO_SUSCRIPCION[t.estado]}
                    </span>
                  ) : (
                    <span className="text-texto-tenue">sin suscripción</span>
                  )}
                </td>
                <td className="px-4 py-3 text-texto-suave">{t.creadoEn}</td>
                <td className="px-4 py-3 text-texto-suave">
                  {t.vigenteHasta ?? t.trialFin ?? '—'}
                </td>
                <td className="cifras px-4 py-3 text-right">{t.empresas}</td>
                <td className="cifras px-4 py-3 text-right">{t.trabajadores}</td>
                <td className="cifras px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={cambiar.isPending}
                    onClick={() =>
                      cambiar.mutate({
                        id: t.id,
                        cortesia: t.estado !== 'COMPLIMENTARY',
                      })
                    }
                    className="rounded-control border border-borde-fuerte px-3 py-1.5 text-apoyo text-texto-suave hover:bg-fondo"
                  >
                    {t.estado === 'COMPLIMENTARY' ? 'Revocar' : 'Otorgar'}
                  </button>
                </td>
              </tr>
            ))}
            {tenants?.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-texto-tenue">
                  Todavía no hay estudios registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
