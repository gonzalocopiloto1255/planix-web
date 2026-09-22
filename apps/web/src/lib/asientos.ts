import type {
  AsientoCtsInput,
  AsientoDto,
  AsientoGratificacionInput,
  AsientoResumenDto,
  AsientoUtilidadesInput,
  ConfigAsientosDto,
  ConfigAsientosGuardar,
  CuentaContableDto,
  CuentaContableInput,
  CuentaContableUpdate,
  FormatoExportAsiento,
} from '@planix/shared-types';
import { api, apiJson } from './api';

// ------------------------- Plan de cuentas (PCGE) -------------------------

export function listarCuentas(empresaId: string): Promise<CuentaContableDto[]> {
  return apiJson(`/empresas/${empresaId}/cuentas-contables`);
}

export function crearCuenta(
  empresaId: string,
  input: CuentaContableInput,
): Promise<CuentaContableDto> {
  return apiJson(`/empresas/${empresaId}/cuentas-contables`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function actualizarCuenta(
  cuentaId: string,
  input: CuentaContableUpdate,
): Promise<CuentaContableDto> {
  return apiJson(`/cuentas-contables/${cuentaId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function eliminarCuenta(cuentaId: string): Promise<void> {
  await api(`/cuentas-contables/${cuentaId}`, { method: 'DELETE' });
}

// ------------------------- Configuración de mapeos -------------------------

export function configuracionAsientos(
  empresaId: string,
): Promise<ConfigAsientosDto> {
  return apiJson(`/empresas/${empresaId}/asientos/configuracion`);
}

export function guardarConfiguracionAsientos(
  empresaId: string,
  input: ConfigAsientosGuardar,
): Promise<ConfigAsientosDto> {
  return apiJson(`/empresas/${empresaId}/asientos/configuracion`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

// ------------------------- Asientos -------------------------

export function listarAsientos(empresaId: string): Promise<AsientoResumenDto[]> {
  return apiJson(`/empresas/${empresaId}/asientos`);
}

export function obtenerAsiento(asientoId: string): Promise<AsientoDto> {
  return apiJson(`/asientos/${asientoId}`);
}

export async function asientoDePeriodo(
  periodoId: string,
): Promise<AsientoDto | null> {
  const res = await apiJson<{ asiento: AsientoDto | null }>(
    `/periodos/${periodoId}/asiento`,
  );
  return res.asiento;
}

export function generarAsientoPeriodo(periodoId: string): Promise<AsientoDto> {
  return apiJson(`/periodos/${periodoId}/asiento`, { method: 'POST' });
}

export function generarAsientoCts(
  empresaId: string,
  input: AsientoCtsInput,
): Promise<AsientoDto> {
  return apiJson(`/empresas/${empresaId}/asientos/cts`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function generarAsientoGratificacion(
  empresaId: string,
  input: AsientoGratificacionInput,
): Promise<AsientoDto> {
  return apiJson(`/empresas/${empresaId}/asientos/gratificaciones`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function generarAsientoUtilidades(
  empresaId: string,
  input: AsientoUtilidadesInput,
): Promise<AsientoDto> {
  return apiJson(`/empresas/${empresaId}/asientos/utilidades`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function generarAsientoLiquidacion(
  liquidacionId: string,
): Promise<AsientoDto> {
  return apiJson(`/asientos/liquidaciones/${liquidacionId}`, { method: 'POST' });
}

/** Descarga el archivo y deja el asiento marcado como exportado (inmutable). */
export async function exportarAsiento(
  asientoId: string,
  formato: FormatoExportAsiento,
): Promise<void> {
  const res = await api(`/asientos/${asientoId}/exportar?formato=${formato}`);
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const nombre =
    /filename="([^"]+)"/.exec(disposition)?.[1] ??
    `asiento.${formato === 'CSV' ? 'csv' : 'xlsx'}`;
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
