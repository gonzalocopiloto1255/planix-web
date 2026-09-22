import type { ResultadoImportacion } from '@planix/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { descargarPlantilla, importarArchivo } from '../lib/personas';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { useToasts } from '../stores/toast';

export function ImportadorPersonas() {
  const empresa = useEmpresaActiva();
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);

  if (!empresa.id) {
    return (
      <div className="rounded-tarjeta bg-superficie p-10 text-center shadow-tarjeta">
        <p className="text-cuerpo text-texto-suave">
          Elige la empresa activa para importar.{' '}
          <Link to="/empresas" className="text-primario underline">Ir a Empresas</Link>
        </p>
      </div>
    );
  }

  const subir = async () => {
    if (!archivo) {
      return;
    }
    setProcesando(true);
    setResultado(null);
    try {
      const r = await importarArchivo(empresa.id as string, archivo);
      setResultado(r);
      agregarToast(
        r.errores.length === 0 ? 'exito' : 'advertencia',
        `Importación: ${r.creados} creados, ${r.omitidos} omitidos, ${r.errores.length} errores`,
      );
      void queryClient.invalidateQueries({ queryKey: ['personas'] });
    } catch {
      agregarToast('error', 'No se pudo procesar el archivo');
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-subtitulo font-semibold text-texto">
          Importar personas · <span className="text-texto-tenue">{empresa.razonSocial}</span>
        </h1>
        <Link to="/personas" className="text-cuerpo text-primario hover:underline">
          ← Volver a personas
        </Link>
      </div>

      <section className="space-y-4 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        <div className="flex items-start gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primario-suave text-cuerpo font-bold text-primario-oscuro">
            1
          </div>
          <div>
            <h2 className="text-cuerpo font-semibold text-texto">Descarga la plantilla</h2>
            <p className="mt-1 text-cuerpo text-texto-suave">
              Cuatro hojas: TRABAJADORES, LOCADORES, PRACTICANTES y SALDOS_INICIALES
              (vacaciones pendientes, préstamos activos e ingresos del año para 5ta).
              La fila 2 es un ejemplo: bórrala o déjala, se ignora sola.
            </p>
            <button
              type="button"
              onClick={() => void descargarPlantilla(empresa.id as string)}
              className="mt-2 rounded-control border border-primario px-4 py-2 text-cuerpo font-semibold text-primario-oscuro hover:bg-primario-suave"
            >
              Descargar plantilla .xlsx
            </button>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primario-suave text-cuerpo font-bold text-primario-oscuro">
            2
          </div>
          <div className="flex-1">
            <h2 className="text-cuerpo font-semibold text-texto">Sube el archivo llenado</h2>
            <p className="mt-1 text-cuerpo text-texto-suave">
              Cada fila se valida por separado: las correctas se crean aunque otras tengan
              errores, y volver a subir el mismo archivo no duplica personas.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                className="text-cuerpo text-texto-suave file:mr-3 file:rounded-control file:border-0 file:bg-fondo file:px-4 file:py-2 file:text-cuerpo file:font-medium file:text-texto"
              />
              <button
                type="button"
                disabled={!archivo || procesando}
                onClick={() => void subir()}
                className="rounded-control bg-primario px-5 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
              >
                {procesando ? 'Procesando…' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {resultado && (
        <section className="space-y-4 rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
          <h2 className="text-cuerpo font-semibold uppercase tracking-wide text-texto-tenue">
            Resultado
          </h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-control bg-exito-suave p-4">
              <p className="text-titulo font-semibold text-exito">{resultado.creados}</p>
              <p className="text-apoyo text-exito">creados</p>
            </div>
            <div className="rounded-control bg-fondo p-4">
              <p className="text-titulo font-semibold text-texto-suave">{resultado.omitidos}</p>
              <p className="text-apoyo text-texto-suave">omitidos (ya existían)</p>
            </div>
            <div className="rounded-control bg-peligro-suave p-4">
              <p className="text-titulo font-semibold text-peligro">{resultado.errores.length}</p>
              <p className="text-apoyo text-peligro">errores</p>
            </div>
          </div>

          {resultado.errores.length > 0 && (
            <table className="w-full text-left text-cuerpo">
              <thead className="text-apoyo uppercase text-texto-tenue">
                <tr>
                  <th className="px-3 py-2">Hoja</th>
                  <th className="px-3 py-2">Fila</th>
                  <th className="px-3 py-2">Columna</th>
                  <th className="px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {resultado.errores.map((e, i) => (
                  <tr key={i} className="border-t border-peligro-suave bg-peligro-suave/50 text-peligro">
                    <td className="px-3 py-2">{e.hoja}</td>
                    <td className="px-3 py-2">{e.fila}</td>
                    <td className="px-3 py-2">{e.columna ?? ''}</td>
                    <td className="px-3 py-2">{e.mensaje}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {resultado.avisos.length > 0 && (
            <div className="rounded-control bg-advertencia-suave p-3">
              <p className="mb-1 text-apoyo font-semibold uppercase text-advertencia">Avisos</p>
              <ul className="space-y-1 text-cuerpo text-advertencia">
                {resultado.avisos.map((a, i) => (
                  <li key={i}>
                    {a.hoja} fila {a.fila}: {a.mensaje}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
