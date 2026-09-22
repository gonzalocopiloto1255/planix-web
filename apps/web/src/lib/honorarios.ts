import type {
  CrearReciboInput,
  HonorariosAnualDto,
  HonorariosMesDto,
  RespuestaReciboDto,
} from '@planix/shared-types';
import { apiJson } from './api';

export function honorariosDelMes(
  empresaId: string,
  anio: number,
  mes: number,
): Promise<HonorariosMesDto> {
  return apiJson(`/empresas/${empresaId}/honorarios/${anio}/${mes}`);
}

export function honorariosAnual(
  empresaId: string,
  anio: number,
): Promise<HonorariosAnualDto> {
  return apiJson(`/empresas/${empresaId}/honorarios/anual/${anio}`);
}

export function crearRecibo(
  empresaId: string,
  personaId: string,
  input: CrearReciboInput,
): Promise<RespuestaReciboDto> {
  return apiJson(`/empresas/${empresaId}/personas/${personaId}/recibos`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
