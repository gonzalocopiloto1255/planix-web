import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Empresa activa del estudio: los módulos (personas, planillas, ...)
 * operan "sobre la empresa activa". Persiste durante la sesión del
 * navegador (sessionStorage) — no es un dato sensible.
 */
interface EmpresaActivaState {
  id: string | null;
  razonSocial: string | null;
  seleccionar: (id: string, razonSocial: string) => void;
  limpiar: () => void;
}

export const useEmpresaActiva = create<EmpresaActivaState>()(
  persist(
    (set) => ({
      id: null,
      razonSocial: null,
      seleccionar: (id, razonSocial) => set({ id, razonSocial }),
      limpiar: () => set({ id: null, razonSocial: null }),
    }),
    {
      name: 'planix-empresa-activa',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
