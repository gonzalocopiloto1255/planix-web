import type { AlertaDto, EstadoAlerta } from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { SkeletonTabla } from '../componentes/ui';
import {
  COLOR_ESTADO_ALERTA,
  COLOR_URGENCIA,
  NOMBRE_URGENCIA,
  marcarAlerta,
  obtenerBandeja,
  recalcularAlertas,
  textoPlazo,
} from '../lib/alertas';
import { listarEmpresas } from '../lib/empresas';
import { useToasts } from '../stores/toast';

// =====================================================================
// Bandeja de alertas (Sesión 22 — §10.2).
//
// Agrupada por tipo, con filtro por empresa y estado, badge de urgencia
// por proximidad del vencimiento y enlace directo al módulo donde se
// atiende (el destino lo dice el backend, en `enlace`).
//
// "Recalcular" existe porque el job corre a las 06:00: si la contadora
// acaba de registrar un contrato quiere ver la alerta ya, sin esperar al
// día siguiente. Es idempotente.
// =====================================================================

const ESTADOS: { valor: EstadoAlerta | ''; etiqueta: string }[] = [
  { valor: '', etiqueta: 'Pendientes y vistas' },
  { valor: 'PENDIENTE', etiqueta: 'Solo pendientes' },
  { valor: 'VISTA', etiqueta: 'Solo vistas' },
  { valor: 'RESUELTA', etiqueta: 'Resueltas' },
];

function Fila({ alerta }: { alerta: AlertaDto }) {
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);

  const marcar = useMutation({
    mutationFn: (estado: 'VISTA' | 'RESUELTA') => marcarAlerta(alerta.id, estado),
    onSuccess: (_dato, estado) => {
      agregarToast(
        'exito',
        estado === 'VISTA' ? 'Alerta marcada como vista' : 'Alerta resuelta',
      );
      void queryClient.invalidateQueries({ queryKey: ['alertas'] });
      void queryClient.invalidateQueries({ queryKey: ['alertas-resumen'] });
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo actualizar'),
  });

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 border-b border-borde px-4 py-3 last:border-b-0">
      <div className="min-w-64 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-apoyo font-semibold ${COLOR_URGENCIA[alerta.urgencia]}`}
          >
            {NOMBRE_URGENCIA[alerta.urgencia]}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-apoyo font-medium ${COLOR_ESTADO_ALERTA[alerta.estado]}`}
          >
            {alerta.estado}
          </span>
          <p className="text-cuerpo font-semibold text-texto">{alerta.titulo}</p>
        </div>
        {alerta.detalle && (
          <p className="mt-1 text-cuerpo text-texto-suave">{alerta.detalle}</p>
        )}
        <p className="mt-1 text-apoyo text-texto-tenue">
          {alerta.empresaNombre ?? 'Sin empresa'}
          {alerta.fechaObjetivo ? ` · ${alerta.fechaObjetivo} (${textoPlazo(alerta)})` : ''}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          to={alerta.enlace}
          className="rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo text-texto-suave hover:bg-fondo"
        >
          Atender
        </Link>
        {alerta.estado === 'PENDIENTE' && (
          <button
            type="button"
            onClick={() => marcar.mutate('VISTA')}
            disabled={marcar.isPending}
            className="rounded-control px-3 py-1.5 text-cuerpo text-texto-suave hover:bg-fondo"
          >
            Marcar vista
          </button>
        )}
        {alerta.estado !== 'RESUELTA' && (
          <button
            type="button"
            onClick={() => marcar.mutate('RESUELTA')}
            disabled={marcar.isPending}
            className="rounded-control px-3 py-1.5 text-cuerpo text-exito hover:bg-exito-suave"
          >
            Resolver
          </button>
        )}
      </div>
    </li>
  );
}

export function Alertas() {
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [empresaId, setEmpresaId] = useState('');
  const [estado, setEstado] = useState<EstadoAlerta | ''>('');

  const { data: empresas } = useQuery({
    queryKey: ['empresas', '', false],
    queryFn: () => listarEmpresas(),
  });

  const { data: bandeja, isLoading } = useQuery({
    queryKey: ['alertas', empresaId, estado],
    queryFn: () =>
      obtenerBandeja({
        empresaId: empresaId || undefined,
        estado: estado || undefined,
      }),
  });

  const recalcular = useMutation({
    mutationFn: recalcularAlertas,
    onSuccess: (nueva) => {
      agregarToast(
        'exito',
        `Alertas actualizadas: ${nueva.pendientes} pendiente(s)`,
      );
      void queryClient.invalidateQueries({ queryKey: ['alertas'] });
      void queryClient.invalidateQueries({ queryKey: ['alertas-resumen'] });
    },
    onError: (e) =>
      agregarToast(
        'error',
        e instanceof ApiError ? e.message : 'No se pudieron recalcular',
      ),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-titulo font-semibold text-texto">Alertas</h1>
          <p className="text-cuerpo text-texto-suave">
            Vencimientos y obligaciones de tus empresas. Se recalculan todos los
            días; puedes actualizarlas ahora si acabas de registrar algo.
          </p>
        </div>
        <button
          type="button"
          onClick={() => recalcular.mutate()}
          disabled={recalcular.isPending}
          className="rounded-control bg-primario px-4 py-2 text-cuerpo font-medium text-white hover:bg-primario-oscuro disabled:bg-borde"
        >
          {recalcular.isPending ? 'Recalculando…' : 'Recalcular ahora'}
        </button>
      </header>

      <section className="flex flex-wrap items-center gap-3 rounded-tarjeta bg-superficie p-4 shadow-tarjeta">
        <select
          aria-label="Filtrar por empresa"
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          className="rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo"
        >
          <option value="">Todas las empresas</option>
          {empresas?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.razonSocial}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por estado"
          value={estado}
          onChange={(e) => setEstado(e.target.value as EstadoAlerta | '')}
          className="rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo"
        >
          {ESTADOS.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
        {bandeja && (
          <span className="text-cuerpo text-texto-suave">
            {bandeja.pendientes} pendiente(s) en total
          </span>
        )}
      </section>

      {isLoading && <SkeletonTabla />}

      {bandeja?.grupos.length === 0 && (
        <p className="rounded-tarjeta bg-superficie p-8 text-center text-cuerpo text-texto-suave shadow-tarjeta">
          Sin alertas con estos filtros. Nada vence en los próximos días.
        </p>
      )}

      {bandeja?.grupos.map((grupo) => (
        <section key={grupo.tipo} className="rounded-tarjeta bg-superficie shadow-tarjeta">
          <header className="flex items-center justify-between border-b border-borde px-4 py-3">
            <h2 className="text-seccion font-semibold text-texto">{grupo.nombre}</h2>
            <span className="text-apoyo text-texto-tenue">
              {grupo.alertas.length} en total · {grupo.pendientes} pendiente(s)
            </span>
          </header>
          <ul>
            {grupo.alertas.map((alerta) => (
              <Fila key={alerta.id} alerta={alerta} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
