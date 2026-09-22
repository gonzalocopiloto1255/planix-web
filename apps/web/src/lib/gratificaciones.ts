import type {
  CalcularGratiInput,
  CalculoGratiDto,
  GratificacionDto,
  MesGratificacion,
  RegistrarGratiInput,
} from '@planix/shared-types';
import { api, apiJson } from './api';

export function calcularGratificaciones(
  empresaId: string,
  input: CalcularGratiInput,
): Promise<CalculoGratiDto> {
  return apiJson(`/empresas/${empresaId}/gratificaciones/calcular`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function registrarGratificaciones(
  empresaId: string,
  input: RegistrarGratiInput,
): Promise<GratificacionDto[]> {
  return apiJson(`/empresas/${empresaId}/gratificaciones/registrar`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listarGratificaciones(
  empresaId: string,
  anio: number,
  mes: MesGratificacion,
): Promise<GratificacionDto[]> {
  return apiJson(`/empresas/${empresaId}/gratificaciones?anio=${anio}&mes=${mes}`);
}

async function abrirPdf(ruta: string): Promise<void> {
  const res = await api(ruta);
  const url = URL.createObjectURL(await res.blob());
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function abrirPlanillaGrati(
  empresaId: string,
  anio: number,
  mes: MesGratificacion,
): Promise<void> {
  return abrirPdf(`/empresas/${empresaId}/gratificaciones/planilla/${anio}/${mes}`);
}

export function abrirBoletaGrati(gratificacionId: string): Promise<void> {
  return abrirPdf(`/gratificaciones/${gratificacionId}/boleta`);
}
