import type {
  FeriadoDelPeriodoDto,
  FeriadoEmpresaDto,
  FeriadoEmpresaInput,
  FeriadoNacionalDto,
  FeriadoNacionalInput,
} from '@planix/shared-types';
import { apiJson } from './api';

// Feriados (§7.2). Los nacionales los administra el superadmin; los de
// empresa, el contador. Ver `apps/api/src/modules/feriados`.

export function obtenerFeriadosNacionales(anio: number): Promise<FeriadoNacionalDto[]> {
  return apiJson<FeriadoNacionalDto[]>(`/feriados-nacionales?anio=${anio}`);
}

export function guardarFeriadoNacional(input: FeriadoNacionalInput) {
  return apiJson<FeriadoNacionalDto>('/admin/feriados-nacionales', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function borrarFeriadoNacional(id: string) {
  return apiJson(`/admin/feriados-nacionales/${id}`, { method: 'DELETE' });
}

export function obtenerFeriadosEmpresa(
  empresaId: string,
  anio: number,
): Promise<FeriadoEmpresaDto[]> {
  return apiJson<FeriadoEmpresaDto[]>(`/empresas/${empresaId}/feriados?anio=${anio}`);
}

export function guardarFeriadoEmpresa(empresaId: string, input: FeriadoEmpresaInput) {
  return apiJson<FeriadoEmpresaDto>(`/empresas/${empresaId}/feriados`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function borrarFeriadoEmpresa(empresaId: string, id: string) {
  return apiJson(`/empresas/${empresaId}/feriados/${id}`, { method: 'DELETE' });
}

/** Feriados del rango ya resueltos: cuáles generan pago triple y cuáles no. */
export function obtenerFeriadosDelRango(
  empresaId: string,
  desde: string,
  hasta: string,
): Promise<FeriadoDelPeriodoDto[]> {
  return apiJson<FeriadoDelPeriodoDto[]>(
    `/empresas/${empresaId}/feriados/rango?desde=${desde}&hasta=${hasta}`,
  );
}
