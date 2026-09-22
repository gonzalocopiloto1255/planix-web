import type {
  BancoTelecredito,
  ComparativoMensualDto,
  FormatoAfpnet,
  MovimientoTRegistro,
  ReporteTRegistroDto,
  ResumenAfpnetDto,
  ResumenAportesDto,
  ArchivosPlameDto,
  EstructuraPlame,
  ResumenPlameDto,
  ResumenTelecreditoDto,
} from '@planix/shared-types';
import { api, apiJson } from './api';

async function abrir(ruta: string): Promise<void> {
  const res = await api(ruta);
  const url = URL.createObjectURL(await res.blob());
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function descargar(ruta: string, nombre: string): Promise<void> {
  const res = await api(ruta);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ------------------------- Boletas -------------------------

export function abrirBoleta(periodoId: string, personaId: string): Promise<void> {
  return abrir(`/periodos/${periodoId}/boletas/${personaId}`);
}

export function abrirBoletasMasivas(periodoId: string): Promise<void> {
  return abrir(`/periodos/${periodoId}/boletas`);
}

// ------------------------- Reportes del periodo -------------------------

export function descargarPlanillaExcel(periodoId: string): Promise<void> {
  return descargar(`/periodos/${periodoId}/reporte/planilla`, 'planilla.xlsx');
}

export function resumenAportes(periodoId: string): Promise<ResumenAportesDto> {
  return apiJson(`/periodos/${periodoId}/reporte/aportes`);
}

export function descargarAportesExcel(periodoId: string): Promise<void> {
  return descargar(`/periodos/${periodoId}/reporte/aportes.xlsx`, 'aportes.xlsx');
}

// ------------------------- Telecrédito -------------------------

export function resumenTelecredito(
  periodoId: string,
  banco: BancoTelecredito,
): Promise<ResumenTelecreditoDto> {
  return apiJson(`/periodos/${periodoId}/telecredito/resumen?banco=${banco}`);
}

export function descargarTelecredito(
  periodoId: string,
  banco: BancoTelecredito,
): Promise<void> {
  return descargar(`/periodos/${periodoId}/telecredito?banco=${banco}`, `telecredito-${banco.toLowerCase()}.txt`);
}

// ------------------------- AFPnet (S20) -------------------------

export function resumenAfpnet(periodoId: string): Promise<ResumenAfpnetDto> {
  return apiJson(`/periodos/${periodoId}/afpnet/resumen`);
}

export function descargarAfpnet(
  periodoId: string,
  formato: FormatoAfpnet,
): Promise<void> {
  const extension = formato === 'TXT' ? 'txt' : 'xlsx';
  return descargar(
    `/periodos/${periodoId}/afpnet?formato=${formato}`,
    `afpnet.${extension}`,
  );
}

// ------------------------- Resumen PLAME (S20) -------------------------

export function resumenPlame(periodoId: string): Promise<ResumenPlameDto> {
  return apiJson(`/periodos/${periodoId}/plame/resumen`);
}

export function descargarPlameExcel(periodoId: string): Promise<void> {
  return descargar(`/periodos/${periodoId}/plame/resumen.xlsx`, 'plame-resumen.xlsx');
}

// ------------------------- Archivos .txt del PLAME (S23.7) -------------------------

export function archivosPlame(periodoId: string): Promise<ArchivosPlameDto> {
  return apiJson(`/periodos/${periodoId}/plame/archivos`);
}

export function descargarPlameZip(periodoId: string, nombre: string): Promise<void> {
  return descargar(`/periodos/${periodoId}/plame/archivos.zip`, nombre);
}

export function descargarPlameArchivo(
  periodoId: string,
  estructura: EstructuraPlame,
  nombre: string,
): Promise<void> {
  return descargar(`/periodos/${periodoId}/plame/archivos/${estructura}`, nombre);
}

// ------------------------- T-Registro (S20) -------------------------

export function reporteTRegistro(
  empresaId: string,
  movimiento: MovimientoTRegistro,
  desde: string,
  hasta: string,
): Promise<ReporteTRegistroDto> {
  return apiJson(
    `/empresas/${empresaId}/t-registro/${movimiento}?desde=${desde}&hasta=${hasta}`,
  );
}

export function descargarTRegistroExcel(
  empresaId: string,
  movimiento: MovimientoTRegistro,
  desde: string,
  hasta: string,
): Promise<void> {
  return descargar(
    `/empresas/${empresaId}/t-registro/${movimiento}/excel?desde=${desde}&hasta=${hasta}`,
    `t-registro-${movimiento.toLowerCase()}.xlsx`,
  );
}

// ------------------------- Comparativo -------------------------

export function comparativoMensual(
  empresaId: string,
  meses = 6,
): Promise<ComparativoMensualDto> {
  return apiJson(`/empresas/${empresaId}/comparativo?meses=${meses}`);
}
