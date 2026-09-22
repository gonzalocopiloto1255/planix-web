import type {
  ConceptoT22Dto,
  AbrirPeriodoInput,
  PeriodoDto,
  PlanillaPeriodoDto,
  VariablesBatchInput,
} from '@planix/shared-types';
import { apiJson } from './api';

export function listarPeriodos(empresaId: string): Promise<PeriodoDto[]> {
  return apiJson(`/empresas/${empresaId}/periodos`);
}

export function abrirPeriodo(
  empresaId: string,
  input: AbrirPeriodoInput,
): Promise<{ periodo: PeriodoDto; advertencias: string[] }> {
  return apiJson(`/empresas/${empresaId}/periodos`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function obtenerPlanilla(periodoId: string): Promise<PlanillaPeriodoDto> {
  return apiJson(`/periodos/${periodoId}`);
}

export function guardarVariables(
  periodoId: string,
  input: VariablesBatchInput,
): Promise<PlanillaPeriodoDto> {
  return apiJson(`/periodos/${periodoId}/variables`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function cerrarPeriodo(periodoId: string): Promise<PlanillaPeriodoDto> {
  return apiJson(`/periodos/${periodoId}/cerrar`, { method: 'POST' });
}

export const NOMBRE_MES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export function etiquetaPeriodo(p: PeriodoDto): string {
  const tipo =
    p.tipo === 'MENSUAL'
      ? 'Mensual'
      : p.tipo === 'PRIMERA_QUINCENA'
        ? '1.ª quincena'
        : '2.ª quincena';
  return `${NOMBRE_MES[p.mes - 1]} ${p.anio} · ${tipo}`;
}

/** Formato de moneda peruano: S/ 1,234.56 (CLAUDE.md §13) */
export function soles(monto: string | number): string {
  const n = typeof monto === 'string' ? Number(monto) : monto;
  return `S/ ${n.toLocaleString('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Catálogo de la tabla 22 de SUNAT (S23.7). Es dato nacional y cambia
 * poco, así que la query se cachea con su propia clave y no por periodo.
 */
export function conceptosT22(): Promise<ConceptoT22Dto[]> {
  return apiJson<ConceptoT22Dto[]>('/conceptos-t22');
}
