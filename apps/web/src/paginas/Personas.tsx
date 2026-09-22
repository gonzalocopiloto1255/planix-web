import type { PersonaDto, TipoVinculo } from '@planix/shared-types';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listarPersonas } from '../lib/personas';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { SkeletonTabla } from '../componentes/ui';

const TABS: { tipo: TipoVinculo; etiqueta: string }[] = [
  { tipo: 'PLANILLA', etiqueta: 'Trabajadores' },
  { tipo: 'LOCADOR', etiqueta: 'Locadores' },
  { tipo: 'PRACTICANTE', etiqueta: 'Practicantes' },
];

const REGIMEN_BADGE: Record<string, string> = {
  GENERAL: 'bg-primario-suave text-primario-oscuro',
  PEQUENA_EMPRESA: 'bg-advertencia-suave text-advertencia',
  MICROEMPRESA: 'bg-exito-suave text-exito',
};

function detallePorTipo(p: PersonaDto): string {
  if (p.tipoVinculo === 'LOCADOR') {
    return p.rucLocador ?? '';
  }
  if (p.tipoVinculo === 'PRACTICANTE') {
    return `Subvención S/ ${p.subvencionMensual ?? ''}`;
  }
  return p.cargo ?? '—';
}

export function Personas() {
  const navigate = useNavigate();
  const empresa = useEmpresaActiva();
  const [tab, setTab] = useState<TipoVinculo>('PLANILLA');
  const [buscar, setBuscar] = useState('');

  const { data: personas, isPending } = useQuery({
    queryKey: ['personas', empresa.id, tab, buscar],
    queryFn: () =>
      listarPersonas(empresa.id as string, {
        tipoVinculo: tab,
        buscar: buscar || undefined,
      }),
    enabled: Boolean(empresa.id),
  });

  if (!empresa.id) {
    return (
      <div className="rounded-tarjeta bg-superficie p-10 text-center shadow-tarjeta">
        <h1 className="text-subtitulo font-semibold text-texto">Elige la empresa activa</h1>
        <p className="mt-2 text-cuerpo text-texto-suave">
          Las personas se gestionan por empresa. Selecciónala en el menú superior o{' '}
          <Link to="/empresas" className="text-primario underline">
            ve al módulo Empresas
          </Link>
          .
        </p>
      </div>
    );
  }

  const hayPersonas = (personas?.length ?? 0) > 0;
  const vacioSinFiltros = !isPending && !hayPersonas && !buscar;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-subtitulo font-semibold text-texto">
          Personas · <span className="text-texto-tenue">{empresa.razonSocial}</span>
        </h1>
        <div className="flex gap-2">
          <Link
            to="/personas/importar"
            className="rounded-control border border-primario px-4 py-2 text-cuerpo font-semibold text-primario-oscuro hover:bg-primario-suave"
          >
            Importar desde Excel
          </Link>
          <Link
            to={`/personas/nueva?tipo=${tab}`}
            className="rounded-control bg-primario px-4 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro"
          >
            Agregar persona
          </Link>
        </div>
      </div>

      <div className="flex gap-1 border-b border-borde">
        {TABS.map((t) => (
          <button
            key={t.tipo}
            type="button"
            onClick={() => setTab(t.tipo)}
            className={`px-4 py-2 text-cuerpo font-medium ${
              tab === t.tipo
                ? 'border-b-2 border-primario text-primario-oscuro'
                : 'text-texto-suave hover:text-texto'
            }`}
          >
            {t.etiqueta}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={buscar}
        onChange={(e) => setBuscar(e.target.value)}
        placeholder="Buscar por nombre o documento…"
        className="w-72 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo focus:border-primario focus:outline-none"
      />

      {vacioSinFiltros ? (
        <div className="flex flex-col items-center rounded-tarjeta bg-superficie p-12 text-center shadow-tarjeta">
          <h2 className="text-lg font-bold text-texto">
            Aún no hay {TABS.find((t) => t.tipo === tab)?.etiqueta.toLowerCase()} registrados
          </h2>
          <p className="mt-2 max-w-md text-cuerpo text-texto-suave">
            Agrégalos uno a uno o tráelos todos de golpe desde tu Excel actual.
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              to={`/personas/nueva?tipo=${tab}`}
              className="rounded-control bg-primario px-5 py-2.5 text-cuerpo font-semibold text-white hover:bg-primario-oscuro"
            >
              Agregar persona
            </Link>
            <Link
              to="/personas/importar"
              className="rounded-control border border-primario px-5 py-2.5 text-cuerpo font-semibold text-primario-oscuro hover:bg-primario-suave"
            >
              Importar desde Excel
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-tarjeta bg-superficie shadow-tarjeta">
          <table className="w-full text-left text-cuerpo">
            <thead className="border-b border-borde text-apoyo uppercase text-texto-tenue">
              <tr>
                <th className="px-4 py-3">Documento</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">{tab === 'LOCADOR' ? 'RUC' : 'Cargo / detalle'}</th>
                <th className="px-4 py-3">Régimen / pensión</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {isPending && (
                <tr>
                  <td colSpan={5} className="p-0"><SkeletonTabla /></td>
                </tr>
              )}
              {!isPending && !hayPersonas && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-texto-tenue">
                    Sin resultados
                  </td>
                </tr>
              )}
              {personas?.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/personas/${p.id}`)}
                  className="cursor-pointer border-b border-borde last:border-0 hover:bg-fondo"
                >
                  <td className="px-4 py-3 font-mono text-texto-suave">
                    {p.tipoDocumento} {p.numeroDocumento}
                  </td>
                  <td className="px-4 py-3 font-medium text-texto">
                    {p.apellidos}, {p.nombres}
                  </td>
                  <td className="px-4 py-3 text-texto-suave">{detallePorTipo(p)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {p.regimenLaboral && (
                        <span className={`rounded-full px-2 py-0.5 text-apoyo font-medium ${REGIMEN_BADGE[p.regimenLaboral]}`}>
                          {p.regimenLaboral === 'PEQUENA_EMPRESA' ? 'Pequeña' : p.regimenLaboral === 'MICROEMPRESA' ? 'Micro' : 'General'}
                        </span>
                      )}
                      {p.sistemaPension && (
                        <span className="rounded-full bg-fondo px-2 py-0.5 text-apoyo font-medium text-texto-suave">
                          {p.sistemaPension === 'AFP' ? `AFP ${p.afp ?? ''}` : p.sistemaPension.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.estadoCese === 'ACTIVO' ? (
                      <span className="text-exito">Activo</span>
                    ) : (
                      <span className="text-texto-tenue">Cesado</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
