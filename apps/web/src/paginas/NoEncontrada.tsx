import { Link } from 'react-router-dom';

/**
 * Página 404 (S23.8, hallazgo BAJO-1 de la auditoría).
 *
 * Antes, una URL mal escrita dejaba la pantalla en blanco: ningún
 * mensaje, ninguna forma de volver. Es de las cosas que más desconciertan
 * porque el usuario no sabe si se rompió el sistema o se equivocó él.
 *
 * Va DENTRO del layout, así que el menú lateral sigue visible: casi
 * siempre lo que quiere quien llega aquí es ir a otro sitio, y el menú ya
 * es esa lista. El enlace al panel es para quien entró por un marcador
 * viejo y no tiene contexto.
 */
export function NoEncontrada() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-texto-tenue">
        Error 404
      </p>
      <h1 className="mt-2 text-titulo font-semibold text-texto">
        Esta página no existe
      </h1>
      <p className="mt-3 text-cuerpo text-texto-suave">
        La dirección no corresponde a ninguna pantalla de Planix. Puede que el
        enlace esté mal escrito, o que sea de una versión anterior del sistema.
      </p>
      <p className="mt-2 text-apoyo text-texto-suave">
        Tus datos están bien: esto no afecta a nada de lo que tengas guardado.
      </p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-control bg-primario px-5 py-2.5 text-cuerpo font-semibold text-white hover:bg-primario-oscuro"
      >
        Ir al panel
      </Link>
    </div>
  );
}
