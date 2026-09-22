import type {
  CalcularCtsInput,
  CalculoCtsDto,
  DepositarCtsInput,
  DepositoCtsDto,
} from '@planix/shared-types';
import { api, apiJson } from './api';

export function calcularCts(
  empresaId: string,
  input: CalcularCtsInput,
): Promise<CalculoCtsDto> {
  return apiJson(`/empresas/${empresaId}/cts/calcular`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function depositarCts(
  empresaId: string,
  input: DepositarCtsInput,
): Promise<DepositoCtsDto[]> {
  return apiJson(`/empresas/${empresaId}/cts/depositar`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listarDepositosCts(
  empresaId: string,
  anio: number,
  semestre: string,
): Promise<(DepositoCtsDto & { persona: { nombres: string; apellidos: string } })[]> {
  return apiJson(
    `/empresas/${empresaId}/cts/depositos?anio=${anio}&semestre=${semestre}`,
  );
}

/** Abre la constancia en una pestaña nueva (PDF). */
export async function abrirConstanciaCts(depositoId: string): Promise<void> {
  const res = await api(`/cts/${depositoId}/constancia`);
  const url = URL.createObjectURL(await res.blob());
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
