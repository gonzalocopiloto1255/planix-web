import { create } from 'zustand';

export interface Toast {
  id: number;
  tipo: 'exito' | 'error' | 'advertencia';
  texto: string;
}

interface ToastState {
  toasts: Toast[];
  agregar: (tipo: Toast['tipo'], texto: string) => void;
  quitar: (id: number) => void;
}

let siguienteId = 1;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  agregar: (tipo, texto) => {
    const id = siguienteId++;
    set((s) => ({ toasts: [...s.toasts, { id, tipo, texto }] }));
    // Las advertencias (p.ej. dígito verificador del RUC) duran más
    const duracion = tipo === 'advertencia' ? 9000 : 4500;
    setTimeout(() => {
      useToasts.getState().quitar(id);
    }, duracion);
  },
  quitar: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
