import type {
  RegistrarSubvencionInput,
  SubvencionDto,
  SubvencionesMesDto,
} from '@planix/shared-types';
import { api, apiJson } from './api';

export function subvencionesDelMes(
  empresaId: string,
  anio: number,
  mes: number,
): Promise<SubvencionesMesDto> {
  return apiJson(`/empresas/${empresaId}/subvenciones/${anio}/${mes}`);
}

export function registrarSubvencion(
  empresaId: string,
  personaId: string,
  input: RegistrarSubvencionInput,
): Promise<{ subvencion: SubvencionDto; advertencias: string[] }> {
  return apiJson(`/empresas/${empresaId}/personas/${personaId}/subvenciones`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function abrirConstanciaSubvencion(id: string): Promise<void> {
  const res = await api(`/subvenciones/${id}/constancia`);
  const url = URL.createObjectURL(await res.blob());
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
