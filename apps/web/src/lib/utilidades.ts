import type {
  CalcularUtilidadesInput,
  CalculoUtilidadesDto,
  ObligacionUtilidadesDto,
  RegistrarUtilidadesInput,
  UtilidadEjercicioDto,
} from '@planix/shared-types';
import { api, apiJson } from './api';

export function obligacionUtilidades(
  empresaId: string,
  ejercicio: number,
): Promise<ObligacionUtilidadesDto> {
  return apiJson(`/empresas/${empresaId}/utilidades/${ejercicio}/obligacion`);
}

export function calcularUtilidades(
  empresaId: string,
  input: CalcularUtilidadesInput,
): Promise<CalculoUtilidadesDto> {
  return apiJson(`/empresas/${empresaId}/utilidades/calcular`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function registrarUtilidades(
  empresaId: string,
  input: RegistrarUtilidadesInput,
): Promise<{ id: string }> {
  return apiJson(`/empresas/${empresaId}/utilidades/registrar`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function obtenerUtilidades(
  empresaId: string,
  ejercicio: number,
): Promise<UtilidadEjercicioDto> {
  return apiJson(`/empresas/${empresaId}/utilidades/${ejercicio}`);
}

async function abrirPdf(ruta: string): Promise<void> {
  const res = await api(ruta);
  const url = URL.createObjectURL(await res.blob());
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function abrirHojaUtilidades(
  utilidadEjercicioId: string,
  personaId: string,
): Promise<void> {
  return abrirPdf(`/utilidades/${utilidadEjercicioId}/hoja/${personaId}`);
}
