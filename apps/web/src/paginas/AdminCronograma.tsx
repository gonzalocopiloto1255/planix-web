import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import {
  borrarFilaCronograma,
  descargarPlantillaCronograma,
  guardarFilaCronograma,
  importarCronograma,
  obtenerCronograma,
} from '../lib/alertas';
import { ApiError } from '../lib/api';
import { useToasts } from '../stores/toast';

// =====================================================================
// Calendario tributario SUNAT (Sesión 22 — §10.2). SOLO SUPERADMIN.
//
// La tabla NACE VACÍA a propósito: las fechas oficiales las publica SUNAT
// cada año por resolución y Planix no las inventa (§4.2). Se cargan aquí,
// por Excel o fila a fila, y desde ese momento alimentan las alertas
// VENCIMIENTO_SUNAT de todos los estudios.
// =====================================================================

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Setiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function AdminCronograma() {
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const archivoRef = useRef<HTMLInputElement>(null);
  const [anio, setAnio] = useState(new Date().getFullYear());

  const [fila, setFila] = useState({
    mes: 1,
    digitoRuc: 0,
    fechaVencimiento: '',
    fechaBuenContribuyente: '',
    normaLegal: '',
  });

  const { data: cronograma } = useQuery({
    queryKey: ['cronograma-sunat', anio],
    queryFn: () => obtenerCronograma(anio),
  });

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ['cronograma-sunat'] });
  };

  const guardar = useMutation({
    mutationFn: () =>
      guardarFilaCronograma({
        anio,
        mes: fila.mes,
        digitoRuc: fila.digitoRuc,
        fechaVencimiento: fila.fechaVencimiento,
        fechaBuenContribuyente: fila.fechaBuenContribuyente || null,
        normaLegal: fila.normaLegal || null,
      }),
    onSuccess: () => {
      agregarToast('exito', 'Fila del cronograma guardada');
      invalidar();
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo guardar'),
  });

  const borrar = useMutation({
    mutationFn: borrarFilaCronograma,
    onSuccess: () => {
      agregarToast('exito', 'Fila eliminada');
      invalidar();
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo eliminar'),
  });

  const importar = useMutation({
    mutationFn: importarCronograma,
    onSuccess: (resultado) => {
      agregarToast(
        resultado.errores.length > 0 ? 'advertencia' : 'exito',
        `Carga: ${resultado.creadas} nuevas, ${resultado.actualizadas} actualizadas` +
          (resultado.errores.length > 0
            ? `, ${resultado.errores.length} fila(s) con error`
            : ''),
      );
      if (resultado.anio) {
        setAnio(resultado.anio);
      }
      invalidar();
      if (archivoRef.current) {
        archivoRef.current.value = '';
      }
    },
    onError: (e) =>
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo cargar'),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-titulo font-semibold text-texto">Calendario SUNAT</h1>
        <p className="text-cuerpo text-texto-suave">
          Cronograma de vencimientos por último dígito de RUC. Planix no inventa
          fechas oficiales: se cargan de la resolución de SUNAT y desde ahí
          alimentan las alertas de todos los estudios.
        </p>
      </header>

      <section className="flex flex-wrap items-end gap-3 rounded-tarjeta bg-superficie p-4 shadow-tarjeta">
        <div>
          <label htmlFor="anio" className="block text-apoyo font-medium text-texto-suave">
            Año del cronograma
          </label>
          <input
            id="anio"
            type="number"
            min={2000}
            max={2100}
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="mt-1 w-28 rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo"
          />
        </div>
        <button
          type="button"
          onClick={() => void descargarPlantillaCronograma()}
          className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
        >
          Descargar plantilla Excel
        </button>
        <div>
          <label
            htmlFor="archivo"
            className="block text-apoyo font-medium text-texto-suave"
          >
            Carga masiva (.xlsx)
          </label>
          <input
            id="archivo"
            ref={archivoRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) {
                importar.mutate(archivo);
              }
            }}
            className="mt-1 text-cuerpo"
          />
        </div>
      </section>

      {cronograma?.aviso && (
        <p className="rounded-tarjeta border border-advertencia/30 bg-advertencia-suave px-4 py-3 text-cuerpo text-advertencia">
          {cronograma.aviso}
        </p>
      )}

      <section className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        <h2 className="mb-3 text-seccion font-semibold text-texto">Agregar o corregir una fila</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="mes" className="block text-apoyo font-medium text-texto-suave">
              Mes de la obligación
            </label>
            <select
              id="mes"
              value={fila.mes}
              onChange={(e) => setFila({ ...fila, mes: Number(e.target.value) })}
              className="mt-1 rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo"
            >
              {MESES.map((nombre, i) => (
                <option key={nombre} value={i + 1}>
                  {nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="digito" className="block text-apoyo font-medium text-texto-suave">
              Último dígito RUC
            </label>
            <select
              id="digito"
              value={fila.digitoRuc}
              onChange={(e) => setFila({ ...fila, digitoRuc: Number(e.target.value) })}
              className="mt-1 rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo"
            >
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="vence" className="block text-apoyo font-medium text-texto-suave">
              Vence
            </label>
            <input
              id="vence"
              type="date"
              value={fila.fechaVencimiento}
              onChange={(e) => setFila({ ...fila, fechaVencimiento: e.target.value })}
              className="mt-1 rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo"
            />
          </div>
          <div>
            <label htmlFor="venceBc" className="block text-apoyo font-medium text-texto-suave">
              Vence buen contribuyente
            </label>
            <input
              id="venceBc"
              type="date"
              value={fila.fechaBuenContribuyente}
              onChange={(e) =>
                setFila({ ...fila, fechaBuenContribuyente: e.target.value })
              }
              className="mt-1 rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="norma" className="block text-apoyo font-medium text-texto-suave">
              Norma legal
            </label>
            <input
              id="norma"
              value={fila.normaLegal}
              onChange={(e) => setFila({ ...fila, normaLegal: e.target.value })}
              placeholder="R.S. 000-2025/SUNAT"
              className="mt-1 w-full rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo"
            />
          </div>
          <button
            type="button"
            onClick={() => guardar.mutate()}
            disabled={guardar.isPending || !fila.fechaVencimiento}
            className="rounded-control bg-primario px-4 py-2 text-cuerpo font-medium text-white hover:bg-primario-oscuro disabled:bg-borde"
          >
            Guardar fila
          </button>
        </div>
      </section>

      <section className="rounded-tarjeta bg-superficie p-6 shadow-tarjeta">
        <h2 className="mb-3 text-seccion font-semibold text-texto">
          Cronograma {anio}
        </h2>
        {cronograma?.filas.length === 0 ? (
          <p className="text-cuerpo text-texto-tenue">Sin filas cargadas para este año.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-cuerpo">
              <thead>
                <tr className="border-b border-borde text-apoyo uppercase text-texto-tenue">
                  <th className="py-2">Mes</th>
                  <th className="py-2">Dígito</th>
                  <th className="py-2">Vence</th>
                  <th className="py-2">Buen contribuyente</th>
                  <th className="py-2">Norma</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {cronograma?.filas.map((f) => (
                  <tr key={f.id} className="border-b border-borde">
                    <td className="py-2">{MESES[f.mes - 1]}</td>
                    <td className="py-2 font-medium">{f.digitoRuc}</td>
                    <td className="py-2">{f.fechaVencimiento}</td>
                    <td className="py-2 text-texto-suave">
                      {f.fechaBuenContribuyente ?? '—'}
                    </td>
                    <td className="py-2 text-texto-tenue">{f.normaLegal ?? '—'}</td>
                    <td className="cifras py-2 text-right">
                      <button
                        type="button"
                        onClick={() => borrar.mutate(f.id)}
                        className="text-apoyo text-peligro underline"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
