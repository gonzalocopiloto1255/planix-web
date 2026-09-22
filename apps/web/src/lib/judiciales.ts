import type {
  ReporteJudicialDto,
  RetencionJudicialDto,
  RetencionJudicialInput,
} from '@planix/shared-types';
import { apiJson } from './api';

export function listarRetenciones(
  empresaId: string,
  personaId: string,
): Promise<RetencionJudicialDto[]> {
  return apiJson(`/empresas/${empresaId}/personas/${personaId}/retenciones-judiciales`);
}

export function crearRetencion(
  empresaId: string,
  personaId: string,
  input: RetencionJudicialInput,
): Promise<RetencionJudicialDto> {
  return apiJson(`/empresas/${empresaId}/personas/${personaId}/retenciones-judiciales`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function desactivarRetencion(id: string): Promise<RetencionJudicialDto> {
  return apiJson(`/retenciones-judiciales/${id}`, { method: 'DELETE' });
}

export function reporteJudicial(
  empresaId: string,
  anio: number,
  mes: number,
): Promise<ReporteJudicialDto> {
  return apiJson(`/empresas/${empresaId}/retenciones-judiciales/${anio}/${mes}`);
}
