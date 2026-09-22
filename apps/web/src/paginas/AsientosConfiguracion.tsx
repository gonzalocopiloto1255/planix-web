import { SkeletonTabla } from '../componentes/ui';
import type {
  CuentaContableDto,
  PlantillaAsientoDto,
} from '@planix/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../lib/api';
import {
  actualizarCuenta,
  configuracionAsientos,
  crearCuenta,
  eliminarCuenta,
  guardarConfiguracionAsientos,
  listarCuentas,
} from '../lib/asientos';
import { useEmpresaActiva } from '../stores/empresaActiva';
import { useToasts } from '../stores/toast';

const estiloInput =
  'w-24 rounded-control border border-borde-fuerte px-2 py-1 text-cuerpo font-mono';

/** Plan de cuentas PCGE de la empresa (seed al primer acceso, editable). */
function PlanDeCuentas({ empresaId }: { empresaId: string }) {
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');

  const { data: cuentas, isPending } = useQuery({
    queryKey: ['cuentas-contables', empresaId],
    queryFn: () => listarCuentas(empresaId),
  });

  const invalidar = () =>
    void queryClient.invalidateQueries({ queryKey: ['cuentas-contables'] });
  const alError = (e: unknown) =>
    agregarToast('error', e instanceof ApiError ? e.message : 'Operación fallida');

  const crear = useMutation({
    mutationFn: () => crearCuenta(empresaId, { codigo, nombre }),
    onSuccess: () => {
      setCodigo('');
      setNombre('');
      invalidar();
    },
    onError: alError,
  });
  const renombrar = useMutation({
    mutationFn: (v: { id: string; nombre: string }) =>
      actualizarCuenta(v.id, { nombre: v.nombre }),
    onSuccess: invalidar,
    onError: alError,
  });
  const alternarActiva = useMutation({
    mutationFn: (c: CuentaContableDto) =>
      actualizarCuenta(c.id, { activa: !c.activa }),
    onSuccess: invalidar,
    onError: alError,
  });
  const borrar = useMutation({
    mutationFn: (id: string) => eliminarCuenta(id),
    onSuccess: invalidar,
    onError: alError,
  });

  return (
    <div className="rounded-tarjeta bg-superficie p-4 shadow-tarjeta">
      <h2 className="text-cuerpo font-semibold text-texto">Plan de cuentas (PCGE)</h2>
      <p className="mt-1 text-apoyo text-texto-tenue">
        Una cuenta con asientos registrados no se puede borrar: desactívala.
      </p>

      <div className="mt-3 flex items-end gap-2">
        <div>
          <label htmlFor="nueva-cuenta" className="block text-apoyo text-texto-suave">Código</label>
          <input
            id="nueva-cuenta"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            placeholder="6211"
            className={`mt-1 ${estiloInput}`}
          />
        </div>
        <div className="flex-1">
          <label htmlFor="nueva-cuenta-nombre" className="block text-apoyo text-texto-suave">Nombre</label>
          <input
            id="nueva-cuenta-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Sueldos y salarios"
            className="mt-1 w-full rounded-control border border-borde-fuerte px-2 py-1 text-cuerpo"
          />
        </div>
        <button
          type="button"
          onClick={() => crear.mutate()}
          disabled={!codigo || nombre.length < 3 || crear.isPending}
          className="rounded-control bg-primario px-3 py-1.5 text-cuerpo font-medium text-white hover:bg-primario-oscuro disabled:opacity-50"
        >
          Agregar
        </button>
      </div>

      <div className="mt-3 max-h-96 overflow-y-auto">
        {isPending && <SkeletonTabla />}
        {cuentas?.map((c) => (
          <div
            key={c.id}
            className={`flex items-center gap-2 border-b border-borde py-1.5 last:border-0 ${c.activa ? '' : 'opacity-50'}`}
          >
            <span className="w-16 shrink-0 font-mono text-cuerpo font-medium text-texto">
              {c.codigo}
            </span>
            <input
              aria-label={`Nombre de la cuenta ${c.codigo}`}
              defaultValue={c.nombre}
              onBlur={(e) => {
                if (e.target.value !== c.nombre && e.target.value.length >= 3) {
                  renombrar.mutate({ id: c.id, nombre: e.target.value });
                }
              }}
              className="flex-1 rounded border border-transparent px-2 py-1 text-cuerpo text-texto-suave hover:border-borde focus:border-primario focus:outline-none"
            />
            <button
              type="button"
              onClick={() => alternarActiva.mutate(c)}
              className="rounded px-2 py-1 text-apoyo text-texto-suave hover:bg-fondo"
            >
              {c.activa ? 'Desactivar' : 'Activar'}
            </button>
            <button
              type="button"
              onClick={() => borrar.mutate(c.id)}
              className="rounded px-2 py-1 text-apoyo text-peligro hover:bg-peligro-suave"
            >
              Borrar
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tabla editable concepto → cuentas + flag de asiento de destino. */
function Mapeos({ empresaId }: { empresaId: string }) {
  const queryClient = useQueryClient();
  const agregarToast = useToasts((s) => s.agregar);
  const [mapeos, setMapeos] = useState<PlantillaAsientoDto[]>([]);
  const [destino, setDestino] = useState(false);
  const [nuevoConcepto, setNuevoConcepto] = useState('');

  const { data: config } = useQuery({
    queryKey: ['asientos-config', empresaId],
    queryFn: () => configuracionAsientos(empresaId),
  });

  useEffect(() => {
    if (config) {
      setMapeos(config.mapeos);
      setDestino(config.generarAsientoDestino);
    }
  }, [config]);

  const guardar = useMutation({
    mutationFn: () =>
      guardarConfiguracionAsientos(empresaId, {
        generarAsientoDestino: destino,
        mapeos: mapeos.map((m) => ({
          concepto: m.concepto,
          cuentaCargo: m.cuentaCargo || null,
          cuentaAbono: m.cuentaAbono || null,
          cuentaCargoObrero: m.cuentaCargoObrero || null,
          cuentaAbonoObrero: m.cuentaAbonoObrero || null,
          centroCosto: m.centroCosto || null,
          auxiliarPorTrabajador: m.auxiliarPorTrabajador,
          tipoComprobante: m.tipoComprobante || null,
          rucTercero: m.rucTercero || null,
          razonSocialTercero: m.razonSocialTercero || null,
        })),
      }),
    onSuccess: () => {
      agregarToast('exito', 'Mapeo de asientos guardado');
      void queryClient.invalidateQueries({ queryKey: ['asientos-config'] });
    },
    onError: (e) => {
      agregarToast('error', e instanceof ApiError ? e.message : 'No se pudo guardar');
    },
  });

  const editar = (
    i: number,
    campo:
      | 'cuentaCargo'
      | 'cuentaAbono'
      | 'cuentaCargoObrero'
      | 'cuentaAbonoObrero'
      | 'centroCosto'
      | 'rucTercero'
      | 'razonSocialTercero'
      | 'tipoComprobante',
    valor: string,
  ) => {
    setMapeos((filas) =>
      filas.map((m, j) => (j === i ? { ...m, [campo]: valor } : m)),
    );
  };

  return (
    <div className="rounded-tarjeta bg-superficie p-4 shadow-tarjeta">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-cuerpo font-semibold text-texto">
            Mapeo concepto → cuentas
          </h2>
          <p className="mt-1 text-apoyo text-texto-tenue">
            Ingresos solo cargan (62x); descuentos y neto solo abonan (40x/41x); los
            aportes del empleador llevan cargo Y abono. Un concepto sin mapeo bloquea el
            asiento del cierre. Las cuentas de <strong>operarios</strong> son opcionales:
            si están vacías se usa la cuenta general para toda categoría. El tipo de
            comprobante y el RUC del tercero alimentan el formato CONCAR (S = propio,
            T = SUNAT, B = banco/AFP).
          </p>
        </div>
        <label className="flex items-center gap-2 text-cuerpo text-texto-suave">
          <input
            type="checkbox"
            checked={destino}
            onChange={(e) => setDestino(e.target.checked)}
          />
          Generar asiento de destino (94/95 contra 791)
        </label>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-cuerpo">
          <thead className="border-b border-borde text-apoyo uppercase text-texto-tenue">
            <tr>
              <th className="py-2 pr-3">Concepto</th>
              <th className="py-2 pr-3">Cargo (debe)</th>
              <th className="py-2 pr-3">Abono (haber)</th>
              <th className="py-2 pr-3">Cargo operarios</th>
              <th className="py-2 pr-3">Abono operarios</th>
              <th className="py-2 pr-3">C. costo</th>
              <th className="py-2 pr-3 text-center">Auxiliar por trabajador</th>
              <th className="py-2 pr-3">Tipo CP</th>
              <th className="py-2 pr-3">RUC tercero</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {mapeos.map((m, i) => (
              <tr key={m.concepto} className="border-b border-borde last:border-0">
                <td className="py-1.5 pr-3">
                  <p className="font-medium text-texto">{m.etiqueta}</p>
                  <p className="font-mono text-apoyo text-texto-tenue">{m.concepto}</p>
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    aria-label={`Cuenta cargo de ${m.concepto}`}
                    value={m.cuentaCargo ?? ''}
                    onChange={(e) => editar(i, 'cuentaCargo', e.target.value.replace(/\D/g, ''))}
                    className={estiloInput}
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    aria-label={`Cuenta abono de ${m.concepto}`}
                    value={m.cuentaAbono ?? ''}
                    onChange={(e) => editar(i, 'cuentaAbono', e.target.value.replace(/\D/g, ''))}
                    className={estiloInput}
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    aria-label={`Cuenta cargo de operarios de ${m.concepto}`}
                    value={m.cuentaCargoObrero ?? ''}
                    onChange={(e) =>
                      editar(i, 'cuentaCargoObrero', e.target.value.replace(/\D/g, ''))
                    }
                    className={estiloInput}
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    aria-label={`Cuenta abono de operarios de ${m.concepto}`}
                    value={m.cuentaAbonoObrero ?? ''}
                    onChange={(e) =>
                      editar(i, 'cuentaAbonoObrero', e.target.value.replace(/\D/g, ''))
                    }
                    className={estiloInput}
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    aria-label={`Centro de costo de ${m.concepto}`}
                    value={m.centroCosto ?? ''}
                    onChange={(e) => editar(i, 'centroCosto', e.target.value.replace(/\D/g, ''))}
                    className={estiloInput}
                  />
                </td>
                <td className="py-1.5 pr-3 text-center">
                  <input
                    aria-label={`Auxiliar por trabajador en ${m.concepto}`}
                    type="checkbox"
                    checked={m.auxiliarPorTrabajador}
                    onChange={(e) =>
                      setMapeos((filas) =>
                        filas.map((x, j) =>
                          j === i ? { ...x, auxiliarPorTrabajador: e.target.checked } : x,
                        ),
                      )
                    }
                  />
                </td>
                <td className="py-1.5 pr-3">
                  <select
                    aria-label={`Tipo de comprobante de ${m.concepto}`}
                    value={m.tipoComprobante ?? ''}
                    onChange={(e) => editar(i, 'tipoComprobante', e.target.value)}
                    className="w-16 rounded-control border border-borde-fuerte px-1 py-1 text-cuerpo"
                  >
                    <option value="">—</option>
                    <option value="S">S</option>
                    <option value="T">T</option>
                    <option value="B">B</option>
                  </select>
                </td>
                <td className="py-1.5 pr-3">
                  <input
                    aria-label={`RUC del tercero de ${m.concepto}`}
                    value={m.rucTercero ?? ''}
                    onChange={(e) => editar(i, 'rucTercero', e.target.value.replace(/\D/g, ''))}
                    className={estiloInput}
                  />
                  <input
                    aria-label={`Razón social del tercero de ${m.concepto}`}
                    value={m.razonSocialTercero ?? ''}
                    onChange={(e) => editar(i, 'razonSocialTercero', e.target.value)}
                    placeholder="Razón social"
                    className="mt-1 w-40 rounded-control border border-borde-fuerte px-2 py-1 text-apoyo"
                  />
                </td>
                <td className="cifras py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => setMapeos((filas) => filas.filter((_, j) => j !== i))}
                    className="rounded px-2 py-1 text-apoyo text-peligro hover:bg-peligro-suave"
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-end gap-2">
          <div>
            <label htmlFor="nuevo-concepto" className="block text-apoyo text-texto-suave">
              Concepto extra (código del catálogo)
            </label>
            <input
              id="nuevo-concepto"
              value={nuevoConcepto}
              onChange={(e) =>
                setNuevoConcepto(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))
              }
              placeholder="BONO_PRODUCCION"
              className="mt-1 w-48 rounded-control border border-borde-fuerte px-2 py-1 font-mono text-cuerpo"
            />
          </div>
          <button
            type="button"
            disabled={
              nuevoConcepto.length < 2 || mapeos.some((m) => m.concepto === nuevoConcepto)
            }
            onClick={() => {
              setMapeos((filas) => [
                ...filas,
                {
                  concepto: nuevoConcepto,
                  etiqueta: nuevoConcepto,
                  cuentaCargo: null,
                  cuentaAbono: null,
                  cuentaCargoObrero: null,
                  cuentaAbonoObrero: null,
                  centroCosto: null,
                  auxiliarPorTrabajador: false,
                  tipoComprobante: null,
                  rucTercero: null,
                  razonSocialTercero: null,
                },
              ]);
              setNuevoConcepto('');
            }}
            className="rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo text-texto-suave hover:bg-fondo disabled:opacity-50"
          >
            Agregar concepto
          </button>
        </div>
        <button
          type="button"
          onClick={() => guardar.mutate()}
          disabled={guardar.isPending || mapeos.length === 0}
          className="rounded-control bg-primario px-5 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
        >
          {guardar.isPending ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}

export function AsientosConfiguracion() {
  const empresa = useEmpresaActiva();

  if (!empresa.id) {
    return (
      <div className="rounded-tarjeta bg-superficie p-10 text-center shadow-tarjeta">
        <h1 className="text-subtitulo font-semibold text-texto">Elige la empresa activa</h1>
        <p className="mt-2 text-cuerpo text-texto-suave">
          El plan de cuentas y los mapeos son por empresa.{' '}
          <Link to="/empresas" className="text-primario underline">Ir a Empresas</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-subtitulo font-semibold text-texto">
          Configuración de asientos ·{' '}
          <span className="text-texto-tenue">{empresa.razonSocial}</span>
        </h1>
        <Link
          to="/asientos"
          className="rounded-control border border-borde-fuerte px-3 py-1.5 text-cuerpo text-texto-suave hover:bg-fondo"
        >
          ← Volver a asientos
        </Link>
      </div>
      <Mapeos empresaId={empresa.id} />
      <PlanDeCuentas empresaId={empresa.id} />
    </div>
  );
}
