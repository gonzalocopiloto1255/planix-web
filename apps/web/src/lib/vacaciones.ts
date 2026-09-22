import type {
  RegistrarGoceInput,
  RespuestaVentaDto,
  VacacionesPersonaDto,
  VentaVacacionesInput,
} from '@planix/shared-types';
import { apiJson } from './api';

export function vacacionesEmpresa(empresaId: string): Promise<VacacionesPersonaDto[]> {
  return apiJson(`/empresas/${empresaId}/vacaciones`);
}

export function vacacionesPersona(
  empresaId: string,
  personaId: string,
): Promise<VacacionesPersonaDto> {
  return apiJson(`/empresas/${empresaId}/personas/${personaId}/vacaciones`);
}

export function generarPeriodos(empresaId: string): Promise<{ creados: number }> {
  return apiJson(`/empresas/${empresaId}/vacaciones/generar-periodos`, {
    method: 'POST',
  });
}

export function registrarGoce(
  empresaId: string,
  personaId: string,
  input: RegistrarGoceInput,
): Promise<unknown> {
  return apiJson(`/empresas/${empresaId}/personas/${personaId}/vacaciones/goce`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function registrarVenta(
  empresaId: string,
  personaId: string,
  input: VentaVacacionesInput,
): Promise<RespuestaVentaDto> {
  return apiJson(`/empresas/${empresaId}/personas/${personaId}/vacaciones/venta`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
