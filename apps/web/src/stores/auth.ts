import type { Sesion } from '@planix/shared-types';
import { create } from 'zustand';

/**
 * Sesión en MEMORIA únicamente (§12): el accessToken jamás toca
 * localStorage. Al recargar la página se recupera con el refresh token
 * de la cookie httpOnly (bootstrap en RutaProtegida).
 */
interface AuthState {
  sesion: Sesion | null;
  /** true mientras se intenta recuperar la sesión al cargar la app */
  bootstrapPendiente: boolean;
  setSesion: (sesion: Sesion) => void;
  terminarBootstrap: () => void;
  limpiar: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  sesion: null,
  bootstrapPendiente: true,
  setSesion: (sesion) => set({ sesion, bootstrapPendiente: false }),
  terminarBootstrap: () => set({ bootstrapPendiente: false }),
  limpiar: () => set({ sesion: null, bootstrapPendiente: false }),
}));
