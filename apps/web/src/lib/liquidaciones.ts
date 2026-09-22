import type {
  CesarPersonaInput,
  LiquidacionDto,
  LiquidacionPreviewDto,
} from '@planix/shared-types';
import { api, apiJson } from './api';

export function cesarPersona(
  empresaId: string,
  personaId: string,
  input: CesarPersonaInput,
): Promise<unknown> {
  return apiJson(`/empresas/${empresaId}/personas/${personaId}/cesar`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function previewLiquidacion(
  empresaId: string,
  personaId: string,
): Promise<LiquidacionPreviewDto> {
  return apiJson(`/empresas/${empresaId}/personas/${personaId}/liquidacion/preview`);
}

export function emitirLiquidacion(
  empresaId: string,
  personaId: string,
): Promise<LiquidacionDto> {
  return apiJson(`/empresas/${empresaId}/personas/${personaId}/liquidacion`, {
    method: 'POST',
  });
}

export function listarLiquidaciones(empresaId: string): Promise<LiquidacionDto[]> {
  return apiJson(`/empresas/${empresaId}/liquidaciones`);
}

async function abrirPdf(ruta: string): Promise<void> {
  const res = await api(ruta);
  const url = URL.createObjectURL(await res.blob());
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function abrirLiquidacionPdf(id: string): Promise<void> {
  return abrirPdf(`/liquidaciones/${id}/pdf`);
}

export function abrirCertificado5ta(
  empresaId: string,
  personaId: string,
  anio: number,
): Promise<void> {
  return abrirPdf(`/empresas/${empresaId}/personas/${personaId}/certificado-5ta/${anio}`);
}
