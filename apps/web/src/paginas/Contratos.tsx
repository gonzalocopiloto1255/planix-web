import type { ContratoDto, EstadoContrato, PlantillaContratoDto } from '@planix/shared-types';
import { VARIABLES_CONTRATO } from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BadgeEstado,
  ModalRenovar,
} from '../componentes/SeccionContratos';
import { ApiError } from '../lib/api';
import {
  NOMBRE_ESTADO,
  NOMBRE_TIPO_CONTRATO,
  abrirPdfContrato,
  actualizarPlantilla,
  contratosDeEmpresa,
  crearPlantilla,
  listarPlantillas,
} from '../lib/contratos';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { useToasts } from '../stores/toast';

// =====================================================================
// CONTRATOS por empresa (Sesión 17): tabla con semáforo de estados y
// filtro + editor de plantillas (markdown ligero con variables {{...}};
// la lista de variables disponibles se muestra junto al editor).
// =====================================================================

const ESTADOS_FILTRO: EstadoContrato[] = [
  'VIGENTE',
  'POR_VENCER',
  'VENCIDO',
  'SIN_FIN',
  'RENOVADO',
];

function TabContratos() {
  const empresa = useEmpresaActiva();
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<EstadoContrato | ''>('');
  const [renovando, setRenovando] = useState<ContratoDto | null>(null);

  const { data: contratos } = useQuery({
    queryKey: ['contratos-empresa', empresa.id],
    queryFn: () => contratosDeEmpresa(empresa.id as string),
    enabled: Boolean(empresa.id),
  });

  const filtrados = contratos?.filter((c) => !filtro || c.estado === filtro) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <select
          aria-label="Filtrar por estado"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as EstadoContrato | '')}
          className="rounded-control border border-borde-fuerte px-2 py-1.5 text-cuerpo"
        >
          <option value="">Todos los estados</option>
          {ESTADOS_FILTRO.map((e) => (
            <option key={e} value={e}>{NOMBRE_ESTADO[e]}</option>
          ))}
        </select>
        <p className="text-apoyo text-texto-tenue">
          Los contratos se generan desde la ficha de cada persona.
        </p>
      </div>

      <div className="overflow-x-auto rounded-tarjeta bg-superficie shadow-tarjeta">
        <table className="w-full text-left text-cuerpo">
          <thead>
            <tr className="border-b border-borde text-apoyo uppercase text-texto-tenue">
              <th className="px-4 py-3">Persona</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Inicio</th>
              <th className="px-4 py-3">Fin</th>
              <th className="px-4 py-3">Estado</th>
              <th className="cifras px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-texto-tenue">
                  {contratos && contratos.length === 0
                    ? 'Sin contratos registrados: genera el primero desde la ficha de una persona.'
                    : 'Ningún contrato con ese estado.'}
                </td>
              </tr>
            )}
            {filtrados.map((c) => (
              <tr key={c.id} className="border-b border-borde hover:bg-fondo">
                <td className="px-4 py-2.5">
                  <Link
                    to={`/personas/${c.personaId}`}
                    className="font-medium text-texto hover:text-primario"
                  >
                    {c.apellidos}, {c.nombres}
                  </Link>
                  <span className="ml-2 text-apoyo text-texto-tenue">{c.numeroDocumento}</span>
                </td>
                <td className="px-4 py-2.5">{NOMBRE_TIPO_CONTRATO[c.tipo]}</td>
                <td className="px-4 py-2.5">{c.inicio}</td>
                <td className="px-4 py-2.5">{c.fin ?? '—'}</td>
                <td className="px-4 py-2.5"><BadgeEstado estado={c.estado} /></td>
                <td className="cifras px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-3">
                    {c.pdfDisponible && (
                      <button
                        type="button"
                        onClick={() => void abrirPdfContrato(c.id)}
                        className="text-apoyo text-primario hover:underline"
                      >
                        Ver PDF
                      </button>
                    )}
                    {c.fin && c.estado !== 'RENOVADO' && (
                      <button
                        type="button"
                        onClick={() => setRenovando(c)}
                        className="text-apoyo text-primario hover:underline"
                      >
                        Renovar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {renovando && (
        <ModalRenovar
          contrato={renovando}
          onCerrar={() => setRenovando(null)}
          onExito={() => {
            void queryClient.invalidateQueries({ queryKey: ['contratos-empresa'] });
          }}
        />
      )}
    </div>
  );
}

function EditorPlantilla({
  plantilla,
  onCerrar,
}: {
  plantilla: PlantillaContratoDto | null; // null = nueva
  onCerrar: () => void;
}) {
  const empresa = useEmpresaActiva();
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [nombre, setNombre] = useState(plantilla?.nombre ?? '');
  const [contenido, setContenido] = useState(plantilla?.contenido ?? '');
  const [activo, setActivo] = useState(plantilla?.activo ?? true);

  const guardar = useMutation({
    mutationFn: () =>
      plantilla
        ? actualizarPlantilla(plantilla.id, { nombre, contenido, activo })
        : crearPlantilla(empresa.id as string, { nombre, contenido, activo }),
    onSuccess: () => {
      agregarToast('exito', 'Plantilla guardada');
      void queryClient.invalidateQueries({ queryKey: ['plantillas-contrato'] });
      onCerrar();
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo guardar'),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <div className="space-y-3">
        <input
          aria-label="Nombre de la plantilla"
          placeholder="Nombre de la plantilla"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo font-medium"
        />
        <textarea
          aria-label="Contenido de la plantilla"
          value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          rows={22}
          className="w-full rounded-control border border-borde-fuerte px-3 py-2 font-mono text-apoyo leading-relaxed"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-cuerpo text-texto-suave">
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
            />
            Activa (disponible al generar contratos)
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => guardar.mutate()}
              disabled={guardar.isPending || !nombre || !contenido}
              className="rounded-control bg-primario px-4 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
            >
              {guardar.isPending ? 'Guardando…' : 'Guardar plantilla'}
            </button>
          </div>
        </div>
      </div>

      <aside className="space-y-3">
        <div className="rounded-tarjeta bg-superficie p-4 shadow-tarjeta">
          <h3 className="mb-2 text-apoyo font-semibold uppercase tracking-wide text-texto-tenue">
            Variables disponibles
          </h3>
          <ul className="space-y-1.5">
            {VARIABLES_CONTRATO.map((v) => (
              <li key={v.variable} className="text-apoyo">
                <code className="rounded bg-fondo px-1 py-0.5 font-mono text-primario-oscuro">
                  {'{{'}{v.variable}{'}}'}
                </code>
                <span className="ml-1 text-texto-suave">{v.descripcion}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-tarjeta bg-superficie p-4 text-apoyo text-texto-suave shadow-tarjeta">
          <p className="mb-1 font-semibold text-texto-suave">Formato (markdown ligero)</p>
          <p><code># Título centrado</code> · <code>## Cláusula</code></p>
          <p><code>**negrita**</code> · <code>- lista</code></p>
          <p className="mt-2">
            Las variables se reemplazan al GENERAR el contrato y quedan congeladas en el
            documento; una variable sin valor sale como línea para completar a mano.
          </p>
        </div>
      </aside>
    </div>
  );
}

function TabPlantillas() {
  const empresa = useEmpresaActiva();
  const [editando, setEditando] = useState<PlantillaContratoDto | null>(null);
  const [creando, setCreando] = useState(false);

  const { data: plantillas } = useQuery({
    queryKey: ['plantillas-contrato', empresa.id],
    queryFn: () => listarPlantillas(empresa.id as string),
    enabled: Boolean(empresa.id),
  });

  if (creando || editando) {
    return (
      <EditorPlantilla
        plantilla={editando}
        onCerrar={() => {
          setEditando(null);
          setCreando(false);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-apoyo text-texto-tenue">
          La primera visita siembra 4 plantillas legales estándar; edítalas a tu gusto
          (revisar con asesoría legal).
        </p>
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="rounded-control bg-primario px-3 py-1.5 text-cuerpo font-semibold text-white hover:bg-primario-oscuro"
        >
          + Nueva plantilla
        </button>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {plantillas?.map((p) => (
          <li key={p.id} className={`rounded-tarjeta bg-superficie p-4 shadow-tarjeta ${p.activo ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-texto">{p.nombre}</p>
                <p className="mt-1 text-apoyo text-texto-tenue">
                  {p.activo ? 'Activa' : 'Inactiva'} · actualizada{' '}
                  {p.actualizadoEn.slice(0, 10)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditando(p)}
                className="rounded-control border border-borde-fuerte px-3 py-1.5 text-apoyo text-texto-suave hover:bg-fondo"
              >
                Editar
              </button>
            </div>
            <p className="mt-2 line-clamp-3 text-apoyo text-texto-suave">
              {p.contenido.replace(/[#*]/g, '').slice(0, 220)}…
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Contratos() {
  const empresa = useEmpresaActiva();
  const [tab, setTab] = useState<'CONTRATOS' | 'PLANTILLAS'>('CONTRATOS');

  if (!empresa.id) {
    return (
      <div className="rounded-tarjeta bg-superficie p-10 text-center shadow-tarjeta">
        <h1 className="text-subtitulo font-semibold text-texto">Elige la empresa activa</h1>
        <p className="mt-2 text-cuerpo text-texto-suave">
          Los contratos y sus plantillas se gestionan por empresa.{' '}
          <Link to="/empresas" className="text-primario underline">Ir a Empresas</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-subtitulo font-semibold text-texto">
          Contratos · <span className="text-texto-tenue">{empresa.razonSocial}</span>
        </h1>
        <div className="flex rounded-control border border-borde bg-superficie p-1">
          <button
            type="button"
            onClick={() => setTab('CONTRATOS')}
            className={`rounded-md px-4 py-1.5 text-cuerpo font-medium ${
              tab === 'CONTRATOS' ? 'bg-primario text-white' : 'text-texto-suave hover:bg-fondo'
            }`}
          >
            Contratos
          </button>
          <button
            type="button"
            onClick={() => setTab('PLANTILLAS')}
            className={`rounded-md px-4 py-1.5 text-cuerpo font-medium ${
              tab === 'PLANTILLAS' ? 'bg-primario text-white' : 'text-texto-suave hover:bg-fondo'
            }`}
          >
            Plantillas
          </button>
        </div>
      </div>

      {tab === 'CONTRATOS' ? <TabContratos /> : <TabPlantillas />}
    </div>
  );
}
