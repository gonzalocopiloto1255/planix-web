import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Estado del sidebar (colapsado a solo iconos o no). Persiste en
 * localStorage —no en sessionStorage como la empresa activa— porque es
 * una preferencia de la persona, no de la sesión: quien lo colapsó una
 * vez lo quiere colapsado mañana también.
 */
interface SidebarState {
  colapsado: boolean;
  alternar: () => void;
}

export const useSidebar = create<SidebarState>()(
  persist(
    (set) => ({
      colapsado: false,
      alternar: () => set((s) => ({ colapsado: !s.colapsado })),
    }),
    {
      name: 'planix-sidebar',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
