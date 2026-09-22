import type { PlanDto } from '@planix/shared-types';
import { CUENTA, puede } from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api';
import { SkeletonTabla } from '../componentes/ui';
import {
  COLOR_ESTADO_SUSCRIPCION,
  NOMBRE_ESTADO_SUSCRIPCION,
  cancelarSuscripcion,
  listarPlanes,
  obtenerSuscripcion,
  soles,
  suscribir,
} from '../lib/billing';
import { useAuth } from '../stores/auth';
import { useToasts } from '../stores/toast';

// =====================================================================
// Pantalla de suscripción (Sesión 21 — §11).
// Muestra el estado real que devuelve la API, el uso frente a los
// límites del plan y las opciones de contratación. El botón lleva al
// checkout de Mercado Pago: la activación la confirma el webhook, nunca
// esta pantalla.
//
// De ahí la distinción entre `plan` (el efectivo, el que da los límites) y
// `planPendiente` (el elegido en el checkout, todavía sin confirmar): el
// plan pendiente se marca como tal y JAMÁS se muestra como "tu plan actual".
// =====================================================================

function Badge({ estado }: { estado: keyof typeof NOMBRE_ESTADO_SUSCRIPCION }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-apoyo font-semibold ${COLOR_ESTADO_SUSCRIPCION[estado]}`}
    >
      {NOMBRE_ESTADO_SUSCRIPCION[estado]}
    </span>
  );
}

function Uso({
  etiqueta,
  usados,
  tope,
}: {
  etiqueta: string;
  usados: number;
  tope: number | null;
}) {
  const porcentaje = tope ? Math.min(100, Math.round((usados / tope) * 100)) : 0;
  return (
    <div>
      <p className="text-apoyo uppercase text-texto-tenue">{etiqueta}</p>
      <p className="text-seccion font-semibold text-texto">
        {usados}
        <span className="text-cuerpo font-normal text-texto-tenue">
          {tope === null ? ' · sin límite' : ` de ${tope}`}
        </span>
      </p>
      {tope !== null && (
        <div className="mt-1 h-1.5 w-full rounded-full bg-fondo">
          <div
            className={`h-1.5 rounded-full ${porcentaje >= 100 ? 'bg-peligro' : 'bg-primario'}`}
            style={{ width: `${porcentaje}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function Suscripcion() {
  const agregarToast = useToasts((s) => s.agregar);
  const queryClient = useQueryClient();
  // Consultar el estado es LECTURA_CONTABLE y por eso el ADMINISTRADOR
  // entra; CONTRATAR y CANCELAR son CUENTA, o sea solo el titular (§12).
  // Un botón que al pulsarlo da 403 es peor que un botón ausente: hace
  // creer que se puede hacer algo y lo desmiente cuando ya se intentó.
  const gestionaLaCuenta = puede(useAuth((s) => s.sesion?.usuario.rol), CUENTA);

  const { data: suscripcion } = useQuery({
    queryKey: ['suscripcion'],
    queryFn: obtenerSuscripcion,
  });
  const { data: planes } = useQuery({
    queryKey: ['planes'],
    queryFn: listarPlanes,
  });

  const contratar = useMutation({
    mutationFn: (planId: string) => suscribir(planId),
    onSuccess: (respuesta) => {
      // Al checkout de Mercado Pago; se vuelve por /suscripcion/resultado
      window.location.href = respuesta.initPoint;
    },
    onError: (e) =>
      agregarToast(
        'error',
        e instanceof ApiError ? e.message : 'No se pudo iniciar el pago',
      ),
  });

  const cancelar = useMutation({
    mutationFn: cancelarSuscripcion,
    onSuccess: () => {
      agregarToast('exito', 'Suscripción cancelada. Tus datos siguen disponibles.');
      void queryClient.invalidateQueries({ queryKey: ['suscripcion'] });
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo cancelar'),
  });

  if (!suscripcion) {
    return <SkeletonTabla />;
  }

  const esPlanActual = (plan: PlanDto) =>
    suscripcion.plan?.id === plan.id &&
    suscripcion.estado !== 'SUSPENDED' &&
    suscripcion.estado !== 'CANCELED';

  const esPlanPendiente = (plan: PlanDto) =>
    suscripcion.planPendiente?.id === plan.id;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-titulo font-semibold text-texto">Suscripción</h1>
        <p className="text-cuerpo text-texto-suave">
          Tus datos son tuyos siempre: aunque la suscripción no esté activa,
          puedes consultarlos y exportarlos sin límite.
        </p>
      </header>

      <section className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Badge estado={suscripcion.estado} />
              <span className="text-seccion font-semibold text-texto">
                {suscripcion.plan?.nombre ?? 'Sin plan'}
              </span>
            </div>
            {suscripcion.estado === 'TRIAL' && (
              <p className="text-cuerpo text-texto-suave">
                {suscripcion.diasTrialRestantes > 0
                  ? `Te quedan ${suscripcion.diasTrialRestantes} días de prueba (hasta el ${suscripcion.trialFin}).`
                  : 'Tu prueba gratuita terminó.'}
              </p>
            )}
            {suscripcion.vigenteHasta && (
              <p className="text-cuerpo text-texto-suave">
                Vigente hasta el {suscripcion.vigenteHasta}
              </p>
            )}
            {suscripcion.canceladaEn && (
              <p className="text-cuerpo text-texto-suave">
                Cancelada el {suscripcion.canceladaEn}
              </p>
            )}
            {suscripcion.planPendiente && (
              <p className="text-cuerpo text-advertencia">
                Elegiste el plan {suscripcion.planPendiente.nombre}: se activará
                cuando Mercado Pago confirme el pago. Hasta entonces siguen
                vigentes tu plan y tus límites actuales.
              </p>
            )}
          </div>

          <div className="flex gap-8">
            <Uso
              etiqueta="Empresas"
              usados={suscripcion.uso.empresas}
              tope={suscripcion.uso.maxEmpresas}
            />
            <Uso
              etiqueta="Trabajadores"
              usados={suscripcion.uso.trabajadores}
              tope={suscripcion.uso.maxTrabajadores}
            />
            {/* Los usuarios van incluidos en el plan, no se cobran aparte
                (S23.5); el número cuenta también las invitaciones vivas. */}
            <Uso
              etiqueta="Usuarios"
              usados={suscripcion.uso.usuarios}
              tope={suscripcion.uso.maxUsuarios}
            />
          </div>
        </div>

        {suscripcion.banner && (
          <p className="mt-4 rounded-control bg-fondo px-4 py-3 text-cuerpo text-texto-suave">
            {suscripcion.banner}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-seccion font-semibold text-texto">Planes</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {planes?.map((plan) => {
            const actual = esPlanActual(plan);
            const pendiente = esPlanPendiente(plan);
            const esPrueba = plan.codigo === 'TRIAL';
            return (
              <article
                key={plan.id}
                className={`flex flex-col rounded-tarjeta border bg-superficie p-5 shadow-tarjeta ${
                  actual
                    ? 'border-primario'
                    : pendiente
                      ? 'border-advertencia'
                      : 'border-borde'
                }`}
              >
                <h3 className="text-seccion font-semibold text-texto">
                  {plan.nombre}
                </h3>
                <p className="mt-1 text-titulo font-semibold text-texto">
                  {soles(plan.precio)}
                  <span className="text-cuerpo font-normal text-texto-tenue">
                    {plan.frecuencia === 'ANUAL' ? ' /año' : ' /mes'}
                  </span>
                </p>
                <p className="mt-2 flex-1 text-cuerpo text-texto-suave">
                  {plan.descripcion}
                </p>
                {actual ? (
                  <span className="mt-4 rounded-control bg-primario-suave px-3 py-2 text-center text-cuerpo font-medium text-primario-oscuro">
                    Tu plan actual
                  </span>
                ) : (
                  <>
                    {pendiente && (
                      <span className="mt-4 rounded-control bg-advertencia-suave px-3 py-2 text-center text-apoyo font-medium text-advertencia">
                        Pendiente de confirmación de Mercado Pago
                      </span>
                    )}
                    {gestionaLaCuenta && (
                    <button
                      type="button"
                      disabled={esPrueba || contratar.isPending}
                      onClick={() => contratar.mutate(plan.id)}
                      className={`${pendiente ? 'mt-2' : 'mt-4'} rounded-control bg-primario px-3 py-2 text-cuerpo font-medium text-white hover:bg-primario-oscuro disabled:cursor-not-allowed disabled:bg-borde disabled:text-texto-tenue`}
                    >
                      {esPrueba
                        ? 'Incluido al registrarte'
                        : pendiente
                          ? 'Reintentar el pago'
                          : 'Suscribirme'}
                    </button>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        <h2 className="mb-3 text-seccion font-semibold text-texto">Pagos</h2>
        {suscripcion.pagos.length === 0 ? (
          <p className="text-cuerpo text-texto-tenue">Todavía no hay pagos registrados.</p>
        ) : (
          <table className="w-full text-left text-cuerpo">
            <thead>
              <tr className="border-b border-borde text-apoyo uppercase text-texto-tenue">
                <th className="py-2">Fecha</th>
                <th className="py-2">Monto</th>
                <th className="py-2">Estado</th>
                <th className="py-2">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {suscripcion.pagos.map((pago) => (
                <tr key={pago.id} className="border-b border-borde">
                  <td className="py-2">{pago.fechaPago}</td>
                  <td className="py-2">{soles(pago.monto)}</td>
                  <td className="py-2">{pago.estado}</td>
                  <td className="py-2 text-texto-tenue">{pago.mpPaymentId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {gestionaLaCuenta &&
        (suscripcion.estado === 'ACTIVE' || suscripcion.estado === 'PAST_DUE') && (
        <button
          type="button"
          onClick={() => cancelar.mutate()}
          disabled={cancelar.isPending}
          className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
        >
          Cancelar mi suscripción
        </button>
      )}
    </div>
  );
}
