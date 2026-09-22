interface PlaceholderProps {
  titulo: string;
}

/** Página provisional de un módulo cuya construcción llega en su sesión del plan. */
export function Placeholder({ titulo }: PlaceholderProps) {
  return (
    <div className="rounded-tarjeta bg-superficie p-8 shadow-tarjeta">
      <h1 className="text-subtitulo font-semibold text-texto">{titulo}</h1>
      <p className="mt-2 text-cuerpo text-texto-suave">
        Este módulo estará disponible próximamente.
      </p>
    </div>
  );
}
