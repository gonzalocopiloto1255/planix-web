import { SkeletonTabla } from '../componentes/ui';
import type {
  MesComparativoDto,
  MovimientoTRegistro,
  PeriodoDto,
} from '@planix/shared-types';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  listarPeriodos,
  etiquetaPeriodo,
  obtenerPlanilla,
  NOMBRE_MES,
  soles,
} from '../lib/planillas';
import {
  abrirBoleta,
  abrirBoletasMasivas,
  comparativoMensual,
  descargarAfpnet,
  descargarAportesExcel,
  archivosPlame,
  descargarPlameArchivo,
  descargarPlameExcel,
  descargarPlameZip,
  descargarPlanillaExcel,
  descargarTRegistroExcel,
  descargarTelecredito,
  reporteTRegistro,
  resumenAfpnet,
  resumenAportes,
  resumenPlame,
  resumenTelecredito,
} from '../lib/reportes';
import { useEmpresaActiva } from '../stores/empresaActiva';

// =====================================================================
// REPORTES (Sesión 18): boletas en PDF, planilla Excel, resumen de
// aportes, telecrédito y comparativo mensual. Todo por empresa activa y
// SOLO sobre periodos CERRADOS (los reportes salen del snapshot
// inmutable del cierre).
//
// El envío de boletas por correo se retiró del alcance (S24): la
// contadora descarga el PDF y lo manda desde su cuenta.
// =====================================================================

type Tab =
  | 'BOLETAS'
  | 'APORTES'
  | 'AFPNET'
  | 'PLAME'
  | 'T_REGISTRO'
  | 'TELECREDITO'
  | 'COMPARATIVO';

function SelectorPeriodoCerrado({
  periodos,
  periodoId,
  onCambiar,
}: {
  periodos: PeriodoDto[];
  periodoId: string;
  onCambiar: (id: string) => void;
}) {
  if (periodos.length === 0) {
    return (
      <p className="rounded-control bg-advertencia-suave px-3 py-2 text-cuerpo text-advertencia">
        No hay periodos cerrados: los reportes se emiten del snapshot del cierre.
      </p>
    );
  }
  return (
    <select
      aria-label="Periodo cerrado"
      value={periodoId}
      onChange={(e) => onCambiar(e.target.value)}
      className="rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
    >
      {periodos.map((p) => (
        <option key={p.id} value={p.id}>{etiquetaPeriodo(p)}</option>
      ))}
    </select>
  );
}

// ------------------------- BOLETAS -------------------------

function TabBoletas({ periodoId }: { periodoId: string }) {
  // La lista sale del propio periodo cerrado: no hace falta un endpoint
  // aparte desde que se retiró el envío por correo, que era quien traía
  // los estados de entrega.
  const { data: planilla, isPending } = useQuery({
    queryKey: ['planilla', periodoId],
    queryFn: () => obtenerPlanilla(periodoId),
    enabled: Boolean(periodoId),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void abrirBoletasMasivas(periodoId)}
          className="rounded-control bg-primario px-4 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro"
        >
          Ver todas las boletas (PDF)
        </button>
        <button
          type="button"
          onClick={() => void descargarPlanillaExcel(periodoId)}
          className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
        >
          Planilla detallada en Excel
        </button>
      </div>

      <p className="text-apoyo text-texto-suave">
        Planix genera las boletas; el envío al trabajador lo haces tú desde tu correo.
      </p>

      {isPending && <SkeletonTabla />}

      {planilla && (
        <div className="rounded-tarjeta bg-superficie shadow-tarjeta">
          <table className="w-full text-left text-cuerpo">
            <thead>
              <tr className="border-b border-borde text-apoyo uppercase text-texto-tenue">
                <th className="px-4 py-2">Trabajador</th>
                <th className="px-4 py-2">Documento</th>
                <th className="px-4 py-2">Cargo</th>
                <th className="cifras px-4 py-2 text-right">Neto a pagar</th>
                <th className="cifras px-4 py-2 text-right">Boleta</th>
              </tr>
            </thead>
            <tbody>
              {planilla.filas.map((f) => (
                <tr key={f.personaId} className="border-b border-borde">
                  <td className="px-4 py-2 font-medium text-texto">
                    {f.apellidos}, {f.nombres}
                  </td>
                  <td className="cifras px-4 py-2 text-texto-suave">{f.numeroDocumento}</td>
                  <td className="px-4 py-2 text-texto-suave">{f.cargo ?? '—'}</td>
                  <td className="cifras px-4 py-2 text-right">{soles(f.totales.netoPagar)}</td>
                  <td className="cifras px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void abrirBoleta(periodoId, f.personaId)}
                      className="text-apoyo text-primario hover:underline"
                    >
                      Ver PDF
                    </button>
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

// ------------------------- APORTES -------------------------

function TabAportes({ periodoId }: { periodoId: string }) {
  const { data: r } = useQuery({
    queryKey: ['aportes', periodoId],
    queryFn: () => resumenAportes(periodoId),
    enabled: Boolean(periodoId),
  });
  if (!r) {
    return <SkeletonTabla />;
  }

  const filas: { concepto: string; monto: string; destacado?: boolean }[] = [
    { concepto: 'ONP (13%)', monto: r.totalOnp },
    ...r.afps.map((a) => ({
      concepto: `AFP ${a.administradora} — fondo ${soles(a.fondo)} · prima ${soles(a.prima)} · comisión ${soles(a.comision)}`,
      monto: a.total,
    })),
    { concepto: 'Total AFP (archivo AFPnet)', monto: r.totalAfp, destacado: true },
    { concepto: 'EsSalud', monto: r.totalEssalud },
    ...(Number(r.totalCreditoEps) > 0
      ? [{ concepto: 'Crédito EPS', monto: r.totalCreditoEps }]
      : []),
    { concepto: 'Retención renta de 5ta', monto: r.totalRenta5ta },
    { concepto: 'Retenciones judiciales', monto: r.totalJudiciales },
    ...(Number(r.totalSctrSalud) > 0 ? [{ concepto: 'SCTR salud', monto: r.totalSctrSalud }] : []),
    ...(Number(r.totalSctrPension) > 0
      ? [{ concepto: 'SCTR pensión', monto: r.totalSctrPension }]
      : []),
    ...(Number(r.totalVidaLey) > 0 ? [{ concepto: 'Seguro Vida Ley', monto: r.totalVidaLey }] : []),
    ...(Number(r.totalSenati) > 0 ? [{ concepto: 'SENATI', monto: r.totalSenati }] : []),
  ];

  return (
    <div className="space-y-4">
      {r.avisoTasasEmpresa && (
        <p className="rounded-control border border-borde bg-fondo px-4 py-3 text-apoyo text-texto-suave">
          {r.avisoTasasEmpresa}
        </p>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void descargarAportesExcel(periodoId)}
          className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo"
        >
          Descargar Excel
        </button>
      </div>
      <div className="rounded-tarjeta bg-superficie shadow-tarjeta">
        <table className="w-full text-left text-cuerpo">
          <thead>
            <tr className="border-b border-borde text-apoyo uppercase text-texto-tenue">
              <th className="px-4 py-2">Tributo / aporte</th>
              <th className="cifras px-4 py-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr
                key={f.concepto}
                className={`border-b border-borde ${f.destacado ? 'bg-primario-suave/50 font-semibold' : ''}`}
              >
                <td className="px-4 py-2 text-texto">{f.concepto}</td>
                <td className="cifras px-4 py-2 text-right tabular-nums text-texto">
                  {soles(f.monto)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {r.judiciales.length > 0 && (
        <div className="rounded-tarjeta bg-superficie p-4 shadow-tarjeta">
          <h3 className="mb-2 text-apoyo font-semibold uppercase tracking-wide text-texto-tenue">
            Depósitos judiciales por beneficiario (depósito manual)
          </h3>
          <ul className="space-y-1.5">
            {r.judiciales.map((j) => (
              <li key={`${j.personaId}-${j.expediente}`} className="text-cuerpo text-texto">
                {j.beneficiario} · exp. {j.expediente} ·{' '}
                {j.bancoDeposito ? `${j.bancoDeposito} ${j.cuentaDeposito ?? ''}` : 'sin cuenta registrada'}{' '}
                — <span className="font-semibold">{soles(j.monto)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ------------------------- TELECRÉDITO -------------------------

function TabTelecredito({ periodoId }: { periodoId: string }) {
  const { data: r } = useQuery({
    queryKey: ['telecredito', periodoId],
    queryFn: () => resumenTelecredito(periodoId, 'BCP'),
    enabled: Boolean(periodoId),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* El archivo NO coincide con la plantilla oficial del BCP
            (contrastado en la S23.5): el banco usa una hoja de cálculo y
            esto genera un TXT. Se deja descargable porque el resumen de
            netos sí es útil, pero el botón es secundario y el aviso dice
            la verdad: ofrecerlo como si estuviera listo llevaría a
            alguien a presentarlo al banco y a que se lo rechacen. */}
        <p className="rounded-control border border-advertencia bg-advertencia-suave px-3 py-2 text-apoyo text-advertencia">
          <span className="font-semibold">
            Este archivo todavía no sirve para cargar en el Telecrédito del BCP.
          </span>{' '}
          La plantilla oficial del banco es una hoja de cálculo con otra
          estructura; lo que se descarga aquí es un TXT de formato genérico. El
          resumen de abonos de abajo sí es correcto y puedes usarlo para pagar
          manualmente.
        </p>
        <button
          type="button"
          onClick={() => void descargarTelecredito(periodoId, 'BCP')}
          disabled={!r || r.incluidos.length === 0}
          className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo disabled:opacity-50"
        >
          Descargar TXT genérico
        </button>
      </div>

      {r && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-tarjeta bg-superficie shadow-tarjeta">
            <p className="border-b border-borde px-4 py-2.5 text-cuerpo font-semibold text-texto">
              En el archivo ({r.incluidos.length}) — {soles(r.totalIncluido)}
            </p>
            <ul>
              {r.incluidos.map((f) => (
                <li key={f.personaId} className="flex justify-between border-b border-borde px-4 py-2 text-cuerpo">
                  <span>
                    {f.apellidos}, {f.nombres}
                    <span className="ml-2 font-mono text-apoyo text-texto-tenue">{f.cuenta}</span>
                  </span>
                  <span className="tabular-nums">{soles(f.neto)}</span>
                </li>
              ))}
              {r.incluidos.length === 0 && (
                <li className="px-4 py-6 text-center text-cuerpo text-texto-tenue">
                  Nadie tiene cuenta HABERES en BCP.
                </li>
              )}
            </ul>
          </div>
          <div className="rounded-tarjeta bg-superficie shadow-tarjeta">
            <p className="border-b border-borde px-4 py-2.5 text-cuerpo font-semibold text-texto">
              Pago manual ({r.pagoManual.length}) — {soles(r.totalPagoManual)}
            </p>
            <ul>
              {r.pagoManual.map((f) => (
                <li key={f.personaId} className="flex justify-between border-b border-borde px-4 py-2 text-cuerpo">
                  <span>
                    {f.apellidos}, {f.nombres}
                    <span className="ml-2 text-apoyo text-texto-tenue">
                      {f.banco ? `${f.banco} ${f.cuenta ?? ''}` : 'sin cuenta HABERES'}
                    </span>
                  </span>
                  <span className="tabular-nums">{soles(f.neto)}</span>
                </li>
              ))}
              {r.pagoManual.length === 0 && (
                <li className="px-4 py-6 text-center text-cuerpo text-texto-tenue">Nadie queda fuera.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------- AFPnet (S20) -------------------------

function TabAfpnet({ periodoId }: { periodoId: string }) {
  const { data: r } = useQuery({
    queryKey: ['afpnet', periodoId],
    queryFn: () => resumenAfpnet(periodoId),
    enabled: Boolean(periodoId),
  });

  return (
    <div className="space-y-4">
      {/* Retirar este aviso cuando exista la constancia de aceptación del portal (OBS-04). */}
      <p className="rounded-control border border-advertencia bg-advertencia-suave px-3 py-2 text-apoyo text-advertencia">
        <span className="font-semibold">Validación pendiente.</span> El archivo se
        genera con la estructura de la plantilla oficial de AFPnet, pero todavía
        ningún archivo generado por este sistema ha sido presentado al portal. Revisa
        el resultado de la carga la primera vez que lo declares.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-apoyo text-texto-suave">
          Un solo archivo para todas las AFP (portal unificado): 17 columnas, sin fila de
          títulos. Los afiliados a la ONP no van; los jubilados AFP se declaran con
          excepción <span className="font-mono">O</span> y remuneración 0.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void descargarAfpnet(periodoId, 'EXCEL')}
            disabled={!r || r.filas.length === 0}
            className="rounded-control bg-primario px-4 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
          >
            Descargar Excel
          </button>
          <button
            type="button"
            onClick={() => void descargarAfpnet(periodoId, 'TXT')}
            disabled={!r || r.filas.length === 0}
            className="rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo text-texto-suave hover:bg-fondo disabled:opacity-50"
          >
            Descargar texto
          </button>
        </div>
      </div>

      {r && (
        <>
          <div className="overflow-x-auto rounded-tarjeta bg-superficie shadow-tarjeta">
            <table className="w-full text-left text-cuerpo">
              <thead>
                <tr className="border-b border-borde text-apoyo uppercase text-texto-tenue">
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">CUSPP</th>
                  <th className="px-3 py-2">Documento</th>
                  <th className="px-3 py-2">Apellidos y nombres</th>
                  <th className="px-3 py-2 text-center">RL</th>
                  <th className="px-3 py-2 text-center">Inicio</th>
                  <th className="px-3 py-2 text-center">Cese</th>
                  <th className="px-3 py-2 text-center">Excep.</th>
                  <th className="cifras px-3 py-2 text-right">Rem. asegurable</th>
                </tr>
              </thead>
              <tbody>
                {r.filas.map((f) => (
                  <tr key={f.numeroDocumento} className="border-b border-borde">
                    <td className="px-3 py-2 tabular-nums text-texto-tenue">{f.secuencia}</td>
                    <td className="px-3 py-2 font-mono text-apoyo">{f.cuspp || '—'}</td>
                    <td className="px-3 py-2 font-mono text-apoyo">{f.numeroDocumento}</td>
                    <td className="px-3 py-2 text-texto">
                      {f.apellidoPaterno} {f.apellidoMaterno}, {f.nombres}
                      {f.administradora && (
                        <span className="ml-2 text-apoyo text-texto-tenue">{f.administradora}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">{f.relacionLaboral}</td>
                    <td className="px-3 py-2 text-center">{f.inicioRelacion}</td>
                    <td className="px-3 py-2 text-center">{f.ceseRelacion}</td>
                    <td className="px-3 py-2 text-center font-semibold">
                      {f.excepcion || '—'}
                    </td>
                    <td className="cifras px-3 py-2 text-right tabular-nums">
                      {soles(f.remuneracionAsegurable)}
                    </td>
                  </tr>
                ))}
                {r.filas.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-cuerpo text-texto-tenue">
                      Ningún trabajador del periodo está afiliado a una AFP.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-fondo font-semibold">
                  <td colSpan={8} className="cifras px-3 py-2 text-right">
                    Total remuneración asegurable
                  </td>
                  <td className="cifras px-3 py-2 text-right tabular-nums">
                    {soles(r.totalRemuneracionAsegurable)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {r.excluidos.length > 0 && (
            <div className="rounded-tarjeta bg-superficie p-4 shadow-tarjeta">
              <h3 className="mb-2 text-apoyo font-semibold uppercase tracking-wide text-texto-tenue">
                Fuera del archivo ({r.excluidos.length})
              </h3>
              <ul className="space-y-1">
                {r.excluidos.map((e) => (
                  <li key={e.personaId} className="text-cuerpo text-texto-suave">
                    {e.apellidos}, {e.nombres}{' '}
                    <span className="text-apoyo text-texto-tenue">— {e.motivo}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------- Archivos .txt del PLAME (S23.7) -------------------------

/**
 * Los tres archivos que el PDT PLAME importa. Se enseña ANTES de
 * descargar cuántas líneas trae cada uno y QUÉ QUEDA FUERA: el contador
 * tiene que enterarse aquí de lo que va a tener que digitar a mano, no
 * al cuadrar la declaración.
 */
function ArchivosPlame({ periodoId }: { periodoId: string }) {
  const { data } = useQuery({
    queryKey: ['plame-archivos', periodoId],
    queryFn: () => archivosPlame(periodoId),
    enabled: Boolean(periodoId),
  });

  if (!data) {
    return null;
  }

  const nombreZip = `plame-${data.anio}-${String(data.mes).padStart(2, '0')}-${data.empresa.ruc}.zip`;

  return (
    <section className="space-y-4 rounded-tarjeta bg-superficie p-5 shadow-tarjeta">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-seccion font-semibold text-texto">
            Archivos de importación del PDT
          </h3>
          <p className="mt-1 max-w-2xl text-apoyo text-texto-suave">
            En el PDT PLAME, cada estructura se carga desde{' '}
            <span className="font-medium text-texto">Archivo → Importar</span>, eligiendo
            la que corresponde. Los nombres ya siguen la convención de SUNAT, así que no
            hay que renombrarlos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void descargarPlameZip(periodoId, nombreZip)}
          className="shrink-0 rounded-control bg-primario px-4 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro"
        >
          Descargar los tres (ZIP)
        </button>
      </div>

      <div className="rounded-control border border-advertencia/30 bg-advertencia-suave px-4 py-3 text-cuerpo text-advertencia">
        {/*
          Ya no dice "verifica la primera carga": las tres estructuras
          entraron en el PDT real. Lo que queda es la trampa de la
          pantalla del aplicativo — un archivo mal terminado se importa
          "sin inconsistencias" y con CERO registros—, y eso hay que
          seguir mirándolo en cada carga, no solo en la primera.
        */}
        <span className="font-semibold">Mira cuántos registros importó el PDT.</span>{' '}
        {data.avisoVerificacion}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-cuerpo">
          <thead>
            <tr className="border-b border-borde text-apoyo uppercase text-texto-tenue">
              <th className="px-3 py-2">Estructura</th>
              <th className="px-3 py-2">Archivo</th>
              <th className="cifras px-3 py-2 text-right">Líneas</th>
              <th className="px-3 py-2"> </th>
            </tr>
          </thead>
          <tbody>
            {data.archivos.map((a) => (
              <tr key={a.estructura} className="border-b border-borde align-top">
                <td className="px-3 py-2">
                  <p className="font-medium text-texto">
                    {a.codigoAnexo} — {a.titulo}
                  </p>
                  <p className="text-apoyo text-texto-suave">{a.descripcion}</p>
                </td>
                <td className="px-3 py-2 font-mono text-apoyo text-texto-suave">
                  {a.nombreArchivo}
                </td>
                <td className="cifras px-3 py-2 text-right tabular-nums">
                  {a.lineas === 0 ? (
                    <span className="text-texto-tenue">vacío</span>
                  ) : (
                    a.lineas
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    disabled={a.lineas === 0}
                    onClick={() =>
                      void descargarPlameArchivo(periodoId, a.estructura, a.nombreArchivo)
                    }
                    className="rounded-control border border-borde-fuerte px-3 py-1.5 text-apoyo text-texto hover:bg-fondo disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Descargar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.omisiones.length > 0 && (
        <div className="rounded-control border border-borde bg-fondo px-4 py-3">
          <p className="text-cuerpo font-semibold text-texto">
            Esto NO va en los archivos: complétalo a mano en el PDT
          </p>
          <p className="mt-1 text-apoyo text-texto-suave">
            Planix prefiere dejar una línea fuera antes que declararla con un código
            adivinado. Son {data.omisiones.length} caso(s):
          </p>
          <ul className="mt-3 space-y-3">
            {data.omisiones.map((o) => (
              <li key={o.concepto} className="text-apoyo">
                <p className="font-medium text-texto">{o.concepto}</p>
                <p className="text-texto-suave">{o.motivo}</p>
                <p className="mt-0.5 text-texto">
                  <span className="font-medium">Qué hacer:</span> {o.queHacer}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ------------------------- Resumen PLAME (S20) -------------------------

function TabPlame({ periodoId }: { periodoId: string }) {
  const { data: r } = useQuery({
    queryKey: ['plame', periodoId],
    queryFn: () => resumenPlame(periodoId),
    enabled: Boolean(periodoId),
  });

  return (
    <div className="space-y-4">
      <ArchivosPlame periodoId={periodoId} />

      <div className="flex items-center justify-between gap-4">
        <p className="text-apoyo text-texto-suave">
          El resumen en Excel es el insumo para digitar el PDT a mano, por si prefieres
          revisarlo concepto a concepto antes de importar nada.
        </p>
        <button
          type="button"
          onClick={() => void descargarPlameExcel(periodoId)}
          className="shrink-0 rounded-control border border-borde-fuerte px-4 py-2 text-cuerpo font-semibold text-texto hover:bg-fondo"
        >
          Descargar resumen en Excel
        </button>
      </div>

      {r && (
        <>
          <div className="overflow-x-auto rounded-tarjeta bg-superficie shadow-tarjeta">
            <table className="w-full text-left text-cuerpo">
              <thead>
                <tr className="border-b border-borde text-apoyo uppercase text-texto-tenue">
                  <th className="px-3 py-2">Trabajador</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Pensión</th>
                  <th className="px-3 py-2">Salud</th>
                  <th className="cifras px-3 py-2 text-right">D. lab.</th>
                  <th className="cifras px-3 py-2 text-right">D. subs.</th>
                  <th className="cifras px-3 py-2 text-right">D. no lab.</th>
                  <th className="cifras px-3 py-2 text-right">Horas</th>
                  <th className="cifras px-3 py-2 text-right">Ingresos</th>
                  <th className="cifras px-3 py-2 text-right">Descuentos</th>
                  <th className="cifras px-3 py-2 text-right">Aportes</th>
                </tr>
              </thead>
              <tbody>
                {r.filas.map((f) => (
                  <tr key={f.personaId} className="border-b border-borde">
                    <td className="px-3 py-2">
                      <p className="font-medium text-texto">
                        {f.apellidos}, {f.nombres}
                      </p>
                      <p className="font-mono text-apoyo text-texto-tenue">
                        {f.tipoDocumento} {f.numeroDocumento}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-apoyo text-texto-suave">{f.tipoTrabajador}</td>
                    <td className="px-3 py-2 text-apoyo text-texto-suave">
                      {f.regimenPensionario}
                      {f.cuspp && (
                        <span className="ml-1 font-mono text-texto-tenue">{f.cuspp}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-apoyo text-texto-suave">{f.regimenSalud}</td>
                    <td className="cifras px-3 py-2 text-right tabular-nums">{f.diasLaborados}</td>
                    <td className="cifras px-3 py-2 text-right tabular-nums">{f.diasSubsidiados}</td>
                    <td className="cifras px-3 py-2 text-right tabular-nums">{f.diasNoLaborados}</td>
                    <td className="cifras px-3 py-2 text-right tabular-nums">
                      {f.horasOrdinarias}h {f.minutosOrdinarios}m
                    </td>
                    <td className="cifras px-3 py-2 text-right tabular-nums">{soles(f.totalIngresos)}</td>
                    <td className="cifras px-3 py-2 text-right tabular-nums">{soles(f.totalDescuentos)}</td>
                    <td className="cifras px-3 py-2 text-right tabular-nums">
                      {soles(f.totalAportesEmpleador)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-tarjeta bg-superficie p-4 shadow-tarjeta">
            <h3 className="mb-2 text-apoyo font-semibold uppercase tracking-wide text-texto-tenue">
              Totales por concepto (para cuadrar con el PDT)
            </h3>
            <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {r.totalesPorConcepto.map((c) => (
                <li key={c.codigo} className="flex justify-between text-cuerpo">
                  <span className="text-texto-suave">{c.nombre}</span>
                  <span className="tabular-nums text-texto">{soles(c.monto)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

// ------------------------- T-Registro (S20) -------------------------

function TabTRegistro() {
  const empresa = useEmpresaActiva();
  const hoy = new Date().toISOString().slice(0, 10);
  const inicioDeMes = `${hoy.slice(0, 7)}-01`;
  const [movimiento, setMovimiento] = useState<MovimientoTRegistro>('ALTAS');
  const [desde, setDesde] = useState(inicioDeMes);
  const [hasta, setHasta] = useState(hoy);

  const { data: r } = useQuery({
    queryKey: ['t-registro', empresa.id, movimiento, desde, hasta],
    queryFn: () =>
      reporteTRegistro(empresa.id as string, movimiento, desde, hasta),
    enabled: Boolean(empresa.id) && desde <= hasta,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-tarjeta bg-superficie p-4 shadow-tarjeta">
        <div>
          <label htmlFor="tr-movimiento" className="block text-apoyo text-texto-suave">
            Movimiento
          </label>
          <select
            id="tr-movimiento"
            value={movimiento}
            onChange={(e) => setMovimiento(e.target.value as MovimientoTRegistro)}
            className="mt-1 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
          >
            <option value="ALTAS">Altas (ingresos)</option>
            <option value="BAJAS">Bajas (ceses)</option>
          </select>
        </div>
        <div>
          <label htmlFor="tr-desde" className="block text-apoyo text-texto-suave">Desde</label>
          <input
            id="tr-desde"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="mt-1 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
          />
        </div>
        <div>
          <label htmlFor="tr-hasta" className="block text-apoyo text-texto-suave">Hasta</label>
          <input
            id="tr-hasta"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="mt-1 rounded-control border border-borde-fuerte px-3 py-2 text-cuerpo"
          />
        </div>
        <button
          type="button"
          onClick={() =>
            void descargarTRegistroExcel(empresa.id as string, movimiento, desde, hasta)
          }
          disabled={!r || r.filas.length === 0}
          className="ml-auto rounded-control bg-primario px-4 py-2 text-cuerpo font-semibold text-white hover:bg-primario-oscuro disabled:opacity-50"
        >
          Descargar Excel
        </button>
      </div>

      {r && (
        <>
          <p className="text-apoyo text-texto-suave">{r.aviso}</p>
          <div className="overflow-x-auto rounded-tarjeta bg-superficie shadow-tarjeta">
            <table className="w-full text-left text-cuerpo">
              <thead>
                <tr className="border-b border-borde text-apoyo uppercase text-texto-tenue">
                  <th className="px-3 py-2">Documento</th>
                  <th className="px-3 py-2">Trabajador</th>
                  <th className="px-3 py-2">Nacimiento</th>
                  <th className="px-3 py-2">Nacionalidad</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Régimen laboral</th>
                  <th className="px-3 py-2">Pensión</th>
                  <th className="px-3 py-2">Salud</th>
                  <th className="px-3 py-2">Ocupación</th>
                  <th className="px-3 py-2">Contrato</th>
                  <th className="px-3 py-2">
                    {movimiento === 'ALTAS' ? 'Ingreso' : 'Cese'}
                  </th>
                  <th className="cifras px-3 py-2 text-right">Remuneración</th>
                </tr>
              </thead>
              <tbody>
                {r.filas.map((f) => (
                  <tr key={f.personaId} className="border-b border-borde align-top">
                    <td className="px-3 py-2 font-mono text-apoyo">
                      {f.tipoDocumento} {f.numeroDocumento}
                    </td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-texto">
                        {f.apellidos}, {f.nombres}
                      </p>
                      {f.faltantes.length > 0 && (
                        <p className="text-apoyo text-advertencia">
                          ⚠ Falta: {f.faltantes.join(' · ')}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-apoyo">{f.fechaNacimiento ?? '—'}</td>
                    <td className="px-3 py-2 text-apoyo">{f.nacionalidad}</td>
                    <td className="px-3 py-2 text-apoyo">{f.tipoTrabajador}</td>
                    <td className="px-3 py-2 text-apoyo">{f.regimenLaboral}</td>
                    <td className="px-3 py-2 text-apoyo">
                      {f.regimenPensionario}
                      {f.cuspp && (
                        <span className="ml-1 font-mono text-texto-tenue">{f.cuspp}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-apoyo">{f.regimenSalud}</td>
                    <td className="px-3 py-2 text-apoyo">{f.ocupacion ?? '—'}</td>
                    <td className="px-3 py-2 text-apoyo">
                      {f.tipoContrato}
                      {f.contratoInicio && (
                        <span className="block text-texto-tenue">
                          {f.contratoInicio} → {f.contratoFin ?? 'indeterminado'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-apoyo">
                      {f.fechaMovimiento}
                      {f.motivoCese && (
                        <span className="block text-texto-tenue">{f.motivoCese}</span>
                      )}
                    </td>
                    <td className="cifras px-3 py-2 text-right tabular-nums">
                      {f.remuneracion ? soles(f.remuneracion) : '—'}
                    </td>
                  </tr>
                ))}
                {r.filas.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-3 py-6 text-center text-cuerpo text-texto-tenue">
                      Sin {movimiento === 'ALTAS' ? 'altas' : 'bajas'} en el rango elegido.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ------------------------- COMPARATIVO -------------------------

/**
 * Columnas del costo laboral (SVG propio, sin librerías). Serie única en
 * azul (#2a78d6) — sin leyenda: el título nombra la serie. Barras ≤24px
 * con extremo superior redondeado (4px) y base recta, rejilla hairline
 * recesiva y tooltip por barra. La alerta >15% NUNCA es solo color:
 * lleva icono ⚠ + porcentaje sobre la barra y banner de texto.
 */
function GraficoCostoLaboral({
  meses,
  umbral,
}: {
  meses: MesComparativoDto[];
  umbral: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const ANCHO = 640;
  const ALTO = 230;
  const M = { top: 28, right: 12, bottom: 24, left: 56 };
  const plotW = ANCHO - M.left - M.right;
  const plotH = ALTO - M.top - M.bottom;

  const max = Math.max(...meses.map((m) => Number(m.costoLaboral)), 1);
  // Techo "limpio" para los ticks de la rejilla
  const paso = 10 ** Math.floor(Math.log10(max));
  const techo = Math.ceil(max / paso) * paso;
  const ticks = [0, techo / 2, techo];

  const banda = plotW / meses.length;
  const anchoBarra = Math.min(24, banda - 16);
  const y = (v: number) => M.top + plotH - (v / techo) * plotH;

  const barra = (x: number, yTop: number, alto: number) => {
    // Extremo de dato redondeado (4px), base recta sobre la línea base
    const r = Math.min(4, alto);
    return `M ${x} ${yTop + alto} V ${yTop + r} Q ${x} ${yTop} ${x + r} ${yTop} H ${x + anchoBarra - r} Q ${x + anchoBarra} ${yTop} ${x + anchoBarra} ${yTop + r} V ${yTop + alto} Z`;
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className="w-full" role="img" aria-label="Costo laboral mensual">
        {/* Rejilla hairline recesiva + ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={M.left}
              x2={ANCHO - M.right}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? '#c3c2b7' : '#e1e0d9'}
              strokeWidth="1"
            />
            <text x={M.left - 8} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#898781">
              {t >= 1000 ? `${(t / 1000).toLocaleString('es-PE')}k` : t}
            </text>
          </g>
        ))}

        {meses.map((m, i) => {
          const xBanda = M.left + i * banda;
          const xBarra = xBanda + (banda - anchoBarra) / 2;
          const valor = Number(m.costoLaboral);
          const yTop = y(valor);
          const alerta =
            m.variacionPorcentaje !== null &&
            Math.abs(Number(m.variacionPorcentaje)) > umbral * 100;
          const esUltimo = i === meses.length - 1;
          return (
            <g
              key={`${m.anio}-${m.mes}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {/* Zona de hover más grande que la barra */}
              <rect x={xBanda} y={M.top} width={banda} height={plotH} fill="transparent" />
              <path d={barra(xBarra, yTop, M.top + plotH - yTop)} fill="#2a78d6" opacity={hover === null || hover === i ? 1 : 0.55} />
              {/* Alerta >15%: icono + porcentaje (nunca solo color) */}
              {alerta && (
                <text x={xBanda + banda / 2} y={yTop - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="#52514e">
                  ⚠ {Number(m.variacionPorcentaje) > 0 ? '+' : ''}
                  {m.variacionPorcentaje}%
                </text>
              )}
              {/* Etiqueta selectiva: solo el último mes (el resto en tooltip/tabla) */}
              {esUltimo && !alerta && (
                <text x={xBanda + banda / 2} y={yTop - 6} textAnchor="middle" fontSize="10" fill="#52514e">
                  {soles(m.costoLaboral)}
                </text>
              )}
              <text x={xBanda + banda / 2} y={ALTO - 8} textAnchor="middle" fontSize="10" fill="#898781">
                {NOMBRE_MES[m.mes - 1].slice(0, 3)} {String(m.anio).slice(2)}
              </text>
            </g>
          );
        })}
      </svg>

      {hover !== null && meses[hover] && (
        <div
          className="pointer-events-none absolute top-2 rounded-control border border-borde bg-superficie px-3 py-2 text-apoyo shadow-flotante"
          style={{
            left: `${((M.left + hover * banda + banda / 2) / ANCHO) * 100}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <p className="font-semibold text-texto">
            {NOMBRE_MES[meses[hover].mes - 1]} {meses[hover].anio}
          </p>
          <p className="text-texto-suave">Costo laboral: {soles(meses[hover].costoLaboral)}</p>
          <p className="text-texto-suave">Neto pagado: {soles(meses[hover].netoPagado)}</p>
          <p className="text-texto-suave">
            HE: {meses[hover].horasExtras} h · {meses[hover].headcount} trab.
          </p>
          {meses[hover].variacionPorcentaje !== null && (
            <p className="text-texto-suave">Variación: {meses[hover].variacionPorcentaje}%</p>
          )}
        </div>
      )}
    </div>
  );
}

function TabComparativo() {
  const empresa = useEmpresaActiva();
  const [meses, setMeses] = useState(6);
  const { data: c } = useQuery({
    queryKey: ['comparativo', empresa.id, meses],
    queryFn: () => comparativoMensual(empresa.id as string, meses),
    enabled: Boolean(empresa.id),
  });

  const alertas = useMemo(() => {
    if (!c) {
      return [];
    }
    const umbral = Number(c.umbralAlerta) * 100;
    return c.meses.filter(
      (m) => m.variacionPorcentaje !== null && Math.abs(Number(m.variacionPorcentaje)) > umbral,
    );
  }, [c]);

  if (!c) {
    return <SkeletonTabla />;
  }
  if (c.meses.length === 0) {
    return (
      <p className="rounded-control bg-advertencia-suave px-3 py-2 text-cuerpo text-advertencia">
        Aún no hay periodos cerrados: el comparativo se construye con los cierres mensuales.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {alertas.map((a) => {
        const anterior = c.meses[c.meses.findIndex((m) => m === a) - 1];
        return (
          <div
            key={`${a.anio}-${a.mes}`}
            className="rounded-control border border-advertencia/30 bg-advertencia-suave px-4 py-3 text-cuerpo text-advertencia"
          >
            ⚠ <span className="font-semibold">Revisa:</span> el costo laboral{' '}
            {Number(a.variacionPorcentaje) > 0 ? 'subió' : 'bajó'}{' '}
            <span className="font-semibold">{a.variacionPorcentaje}%</span> en{' '}
            {NOMBRE_MES[a.mes - 1]} {a.anio}
            {anterior ? ` vs ${NOMBRE_MES[anterior.mes - 1]}` : ''} (umbral: 15%).
          </div>
        );
      })}

      <div className="rounded-tarjeta bg-superficie p-5 shadow-tarjeta">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-cuerpo font-semibold text-texto">
            Costo laboral mensual (ingresos + aportes del empleador)
          </h3>
          <select
            aria-label="Meses a comparar"
            value={meses}
            onChange={(e) => setMeses(Number(e.target.value))}
            className="rounded-control border border-borde-fuerte px-2 py-1 text-apoyo"
          >
            {[3, 6, 12, 24].map((n) => (
              <option key={n} value={n}>Últimos {n} meses</option>
            ))}
          </select>
        </div>
        <GraficoCostoLaboral meses={c.meses} umbral={Number(c.umbralAlerta)} />
      </div>

      <div className="rounded-tarjeta bg-superficie shadow-tarjeta">
        <table className="w-full text-left text-cuerpo">
          <thead>
            <tr className="border-b border-borde text-apoyo uppercase text-texto-tenue">
              <th className="px-4 py-2">Mes</th>
              <th className="cifras px-4 py-2 text-right">Costo laboral</th>
              <th className="cifras px-4 py-2 text-right">Neto pagado</th>
              <th className="cifras px-4 py-2 text-right">HE (horas)</th>
              <th className="cifras px-4 py-2 text-right">Trabajadores</th>
              <th className="cifras px-4 py-2 text-right">Variación</th>
            </tr>
          </thead>
          <tbody>
            {c.meses.map((m) => {
              const alerta =
                m.variacionPorcentaje !== null &&
                Math.abs(Number(m.variacionPorcentaje)) > Number(c.umbralAlerta) * 100;
              return (
                <tr key={`${m.anio}-${m.mes}`} className="border-b border-borde">
                  <td className="px-4 py-2 font-medium text-texto">
                    {NOMBRE_MES[m.mes - 1]} {m.anio}
                  </td>
                  <td className="cifras px-4 py-2 text-right tabular-nums">{soles(m.costoLaboral)}</td>
                  <td className="cifras px-4 py-2 text-right tabular-nums">{soles(m.netoPagado)}</td>
                  <td className="cifras px-4 py-2 text-right tabular-nums">{m.horasExtras}</td>
                  <td className="cifras px-4 py-2 text-right tabular-nums">{m.headcount}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${alerta ? 'font-bold text-advertencia' : ''}`}>
                    {m.variacionPorcentaje === null
                      ? '—'
                      : `${alerta ? '⚠ ' : ''}${Number(m.variacionPorcentaje) > 0 ? '+' : ''}${m.variacionPorcentaje}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-tarjeta bg-superficie p-4 shadow-tarjeta">
        <h3 className="mb-2 text-apoyo font-semibold uppercase tracking-wide text-texto-tenue">
          Mayores variaciones de neto vs el mes anterior (detector de errores de digitación)
        </h3>
        {c.variacionesTrabajador.length === 0 ? (
          <p className="text-cuerpo text-texto-tenue">Sin variaciones entre los dos últimos meses cerrados.</p>
        ) : (
          <ul className="space-y-1.5">
            {c.variacionesTrabajador.map((v) => (
              <li key={v.personaId} className="flex justify-between text-cuerpo">
                <Link to={`/personas/${v.personaId}`} className="text-texto hover:text-primario">
                  {v.apellidos}, {v.nombres}
                </Link>
                <span className="tabular-nums text-texto-suave">
                  {soles(v.netoAnterior)} → {soles(v.netoActual)}{' '}
                  <span className={`font-semibold ${Number(v.variacion) > 0 ? 'text-exito' : 'text-peligro'}`}>
                    ({Number(v.variacion) > 0 ? '+' : ''}
                    {soles(v.variacion)}
                    {v.variacionPorcentaje ? ` · ${v.variacionPorcentaje}%` : ''})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ------------------------- Página -------------------------

export function Reportes() {
  const empresa = useEmpresaActiva();
  const location = useLocation();
  const [tab, setTab] = useState<Tab>(
    location.pathname.endsWith('/comparativo') ? 'COMPARATIVO' : 'BOLETAS',
  );
  const [periodoId, setPeriodoId] = useState('');

  const { data: periodos } = useQuery({
    queryKey: ['periodos', empresa.id],
    queryFn: () => listarPeriodos(empresa.id as string),
    enabled: Boolean(empresa.id),
  });
  const cerrados = useMemo(
    () => (periodos ?? []).filter((p) => p.estado === 'CERRADO'),
    [periodos],
  );
  const periodoActivo = periodoId || cerrados[0]?.id || '';

  if (!empresa.id) {
    return (
      <div className="rounded-tarjeta bg-superficie p-10 text-center shadow-tarjeta">
        <h1 className="text-subtitulo font-semibold text-texto">Elige la empresa activa</h1>
        <p className="mt-2 text-cuerpo text-texto-suave">
          Los reportes se emiten por empresa.{' '}
          <Link to="/empresas" className="text-primario underline">Ir a Empresas</Link>
        </p>
      </div>
    );
  }

  const TABS: { id: Tab; etiqueta: string }[] = [
    { id: 'BOLETAS', etiqueta: 'Boletas' },
    { id: 'APORTES', etiqueta: 'Aportes y tributos' },
    { id: 'AFPNET', etiqueta: 'AFPnet' },
    { id: 'PLAME', etiqueta: 'PLAME' },
    { id: 'T_REGISTRO', etiqueta: 'T-Registro' },
    { id: 'TELECREDITO', etiqueta: 'Telecrédito' },
    { id: 'COMPARATIVO', etiqueta: 'Comparativo' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-subtitulo font-semibold text-texto">
          Reportes · <span className="text-texto-tenue">{empresa.razonSocial}</span>
        </h1>
        <div className="flex rounded-control border border-borde bg-superficie p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-md px-3 py-1.5 text-cuerpo font-medium ${
                tab === t.id ? 'bg-primario text-white' : 'text-texto-suave hover:bg-fondo'
              }`}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>
      </div>

      {/* El T-Registro y el comparativo no dependen de un periodo cerrado */}
      {tab !== 'COMPARATIVO' && tab !== 'T_REGISTRO' && (
        <SelectorPeriodoCerrado
          periodos={cerrados}
          periodoId={periodoActivo}
          onCambiar={setPeriodoId}
        />
      )}

      {tab === 'BOLETAS' && periodoActivo && <TabBoletas periodoId={periodoActivo} />}
      {tab === 'APORTES' && periodoActivo && <TabAportes periodoId={periodoActivo} />}
      {tab === 'AFPNET' && periodoActivo && <TabAfpnet periodoId={periodoActivo} />}
      {tab === 'PLAME' && periodoActivo && <TabPlame periodoId={periodoActivo} />}
      {tab === 'T_REGISTRO' && <TabTRegistro />}
      {tab === 'TELECREDITO' && periodoActivo && <TabTelecredito periodoId={periodoActivo} />}
      {tab === 'COMPARATIVO' && <TabComparativo />}
    </div>
  );
}
