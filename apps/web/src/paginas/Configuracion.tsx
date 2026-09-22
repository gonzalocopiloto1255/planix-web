import { CUENTA, MAX_DIAS_ANTICIPACION, puede } from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import { Seguridad2fa } from '../componentes/Seguridad2fa';
import { ApiError } from '../lib/api';
import {
  guardarPreferenciasAlertas,
  obtenerPreferenciasAlertas,
} from '../lib/alertas';
import { descargarMisDatos, resumenRespaldo } from '../lib/seguridad';
import { useToasts } from '../stores/toast';

// =====================================================================
// Configuración del estudio (Sesión 22).
//
// Por ahora contiene la ANTICIPACIÓN de las alertas: la contadora pidió
// 15 días, y ese es el valor por defecto de todo estudio nuevo. Los
// escalones (30/15/5) son opcionales y solo aplican a los contratos: con
// ellos, la alerta se reabre cada vez que el plazo cruza uno más corto.
// =====================================================================

/** Escalones sugeridos si el estudio quiere avisos repetidos. */
const SUGERENCIA_ESCALONES = [30, 15, 5];

export function Configuracion() {
  const rol = useAuth((s) => s.sesion?.usuario.rol);
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);

  const { data: preferencias } = useQuery({
    queryKey: ['alertas-preferencias'],
    queryFn: obtenerPreferenciasAlertas,
  });

  const [dias, setDias] = useState('15');
  const [conEscalones, setConEscalones] = useState(false);
  const [escalones, setEscalones] = useState('30, 15, 5');

  useEffect(() => {
    if (!preferencias) {
      return;
    }
    setDias(String(preferencias.diasAnticipacion));
    setConEscalones(preferencias.escalonesContrato.length > 0);
    if (preferencias.escalonesContrato.length > 0) {
      setEscalones(preferencias.escalonesContrato.join(', '));
    }
  }, [preferencias]);

  const guardar = useMutation({
    mutationFn: () =>
      guardarPreferenciasAlertas({
        diasAnticipacion: Number(dias),
        escalonesContrato: conEscalones
          ? escalones
              .split(',')
              .map((v) => Number(v.trim()))
              .filter((v) => Number.isInteger(v) && v > 0)
          : [],
      }),
    onSuccess: () => {
      agregarToast('exito', 'Preferencias de alertas guardadas');
      void queryClient.invalidateQueries({ queryKey: ['alertas-preferencias'] });
      void queryClient.invalidateQueries({ queryKey: ['alertas'] });
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo guardar'),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-titulo font-semibold text-texto">Configuración</h1>
        <p className="text-cuerpo text-texto-suave">
          Preferencias de tu estudio contable.
        </p>
      </header>

      <section className="max-w-2xl space-y-4 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        <div>
          <h2 className="text-seccion font-semibold text-texto">Alertas</h2>
          <p className="text-cuerpo text-texto-suave">
            Con cuánta anticipación quieres enterarte de un vencimiento
            (contratos, CTS, gratificaciones, vencimientos SUNAT, vacaciones por
            vencer, reembolsos de subsidio y suspensiones de 4ta).
          </p>
        </div>

        <div>
          <label
            htmlFor="diasAnticipacion"
            className="block text-cuerpo font-medium text-texto"
          >
            Días de anticipación
          </label>
          <input
            id="diasAnticipacion"
            type="number"
            min={1}
            max={MAX_DIAS_ANTICIPACION}
            value={dias}
            onChange={(e) => setDias(e.target.value)}
            className="mt-1 w-32 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo focus:border-primario focus:outline-none"
          />
          <p className="mt-1 text-apoyo text-texto-tenue">
            Entre 1 y {MAX_DIAS_ANTICIPACION} días. Por defecto 15.
          </p>
        </div>

        <div className="space-y-2 border-t border-borde pt-4">
          <label className="flex items-center gap-2 text-cuerpo text-texto">
            <input
              type="checkbox"
              checked={conEscalones}
              onChange={(e) => setConEscalones(e.target.checked)}
              className="rounded border-borde-fuerte"
            />
            Avisarme varias veces de los contratos por vencer
          </label>
          {conEscalones && (
            <div>
              <label
                htmlFor="escalones"
                className="block text-cuerpo font-medium text-texto"
              >
                Escalones (días, separados por coma)
              </label>
              <input
                id="escalones"
                value={escalones}
                onChange={(e) => setEscalones(e.target.value)}
                placeholder={SUGERENCIA_ESCALONES.join(', ')}
                className="mt-1 w-48 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo focus:border-primario focus:outline-none"
              />
              <p className="mt-1 text-apoyo text-texto-tenue">
                Con {SUGERENCIA_ESCALONES.join('/')} la alerta del contrato vuelve
                a aparecer como pendiente al cruzar cada plazo, aunque ya la
                hayas marcado como vista. Máximo 5 escalones.
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => guardar.mutate()}
          disabled={guardar.isPending}
          className="rounded-control bg-primario px-4 py-2 text-cuerpo font-medium text-white hover:bg-primario-oscuro disabled:bg-borde"
        >
          {guardar.isPending ? 'Guardando…' : 'Guardar preferencias'}
        </button>
      </section>

      {/* Seguridad: segundo factor (§12) */}
      <Seguridad2fa />

      <MisDatos />

      {/* Solo el TITULAR reparte accesos: al resto ni se le ofrece. */}
      {puede(rol, CUENTA) && (
        <section className="max-w-2xl rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
          <h2 className="text-seccion font-semibold text-texto">Usuarios</h2>
          <p className="mt-1 text-cuerpo text-texto-suave">
            Da acceso a tu equipo y decide qué puede hacer cada uno. Los
            usuarios van incluidos en tu plan.
          </p>
          <Link
            to="/configuracion/usuarios"
            className="mt-3 inline-block rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto hover:bg-fondo"
          >
            Gestionar usuarios
          </Link>
        </section>
      )}

      <section className="max-w-2xl rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        <h2 className="text-seccion font-semibold text-texto">Feriados</h2>
        <p className="mt-1 text-cuerpo text-texto-suave">
          Los feriados nacionales vienen cargados. Aquí añades los de cada
          empresa —el aniversario de la ciudad, el día del sector— y anotas
          los descansos sustitutorios, que son los que deciden qué día
          trabajado se paga triple.
        </p>
        <Link
          to="/feriados"
          className="mt-3 inline-block rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto hover:bg-fondo"
        >
          Ver el calendario de feriados
        </Link>
      </section>

      {/* El registro de auditoría es CUENTA, igual que los usuarios:
          enlazarlo para todos llevaba a un 403 con la pantalla en blanco. */}
      {puede(rol, CUENTA) && (
      <section className="max-w-2xl rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        <h2 className="text-seccion font-semibold text-texto">Auditoría</h2>
        <p className="mt-1 text-cuerpo text-texto-suave">
          Historial de quién hizo qué en tu estudio: cierres de periodo,
          cambios de sueldo, liquidaciones, depósitos de CTS y accesos.
        </p>
        <Link
          to="/configuracion/auditoria"
          className="mt-3 inline-block rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto hover:bg-fondo"
        >
          Ver el historial
        </Link>
      </section>
      )}
    </div>
  );
}

/**
 * Portabilidad (Ley 29733): el contador se lleva sus datos cuando quiera.
 * No se bloquea nunca por morosidad — la información es suya (§4.9).
 */
function MisDatos() {
  const rol = useAuth((s) => s.sesion?.usuario.rol);
  const agregarToast = useToasts((s) => s.agregar);
  const { data: resumen } = useQuery({
    queryKey: ['respaldo-resumen'],
    queryFn: resumenRespaldo,
    enabled: puede(rol, CUENTA),
  });

  const descargar = useMutation({
    mutationFn: descargarMisDatos,
    onSuccess: () => agregarToast('exito', 'Descarga generada'),
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo exportar'),
  });

  // `respaldo/*` es CUENTA: quien responde por los datos es quien se los
  // lleva. Al resto no se le ofrece un botón que la API le va a negar.
  if (!puede(rol, CUENTA)) {
    return null;
  }

  return (
    <section className="max-w-2xl space-y-3 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
      <div>
        <h2 className="text-seccion font-semibold text-texto">Mis datos</h2>
        <p className="text-cuerpo text-texto-suave">
          Descarga toda la información de tu estudio en Excel. Es tu derecho
          de portabilidad: puedes hacerlo cuando quieras, incluso con la
          suscripción vencida.
        </p>
      </div>
      {resumen && (
        <p className="text-cuerpo text-texto-suave">
          {resumen.empresas} empresa(s) · {resumen.personas} persona(s) ·{' '}
          {resumen.periodos} periodo(s) de planilla.
        </p>
      )}
      <button
        type="button"
        onClick={() => descargar.mutate()}
        disabled={descargar.isPending}
        className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto hover:bg-fondo disabled:opacity-50"
      >
        {descargar.isPending ? 'Preparando…' : 'Descargar mis datos (Excel)'}
      </button>
    </section>
  );
}
