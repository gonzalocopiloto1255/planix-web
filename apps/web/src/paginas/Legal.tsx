import { VERSION_DOCUMENTOS_LEGALES } from '@planix/shared-types';
import { Link } from 'react-router-dom';

// =====================================================================
// Términos de Servicio y Aviso de Privacidad.
// Ley 29733 de Protección de Datos Personales y su Reglamento
// (D.S. 003-2013-JUS). Revisados en la S23.5.
//
// ⚠️ TEXTO BASE, NO REVISADO POR UN ABOGADO COLEGIADO. Cubre lo que la
// norma exige nombrar, pero antes de comercializar Planix tiene que
// revisarlo un abogado peruano. El aviso está en el README y visible en
// la propia página: nadie debe confundirlo con asesoría legal.
//
// PUNTO CLAVE DE REDACCIÓN (S23.5): el rol jurídico del suscriptor
// DEPENDE de qué clase de cliente sea, y los textos contemplan los dos:
//
//   · Un ESTUDIO CONTABLE trata datos de trabajadores de sus empresas
//     cliente. El titular del banco de datos es la empresa cliente; el
//     estudio es ENCARGADO del tratamiento y Planix, SUBENCARGADO.
//   · Una EMPRESA trata los datos de sus propios trabajadores. Ella es
//     la TITULAR del banco de datos y Planix su ENCARGADO.
//
// Confundirlos no es un matiz: cambia quién inscribe el banco de datos,
// quién responde ante la Autoridad y a quién reclama el trabajador.
// =====================================================================

function AvisoBorrador() {
  return (
    <p className="rounded-control border border-advertencia bg-advertencia-suave px-4 py-3 text-cuerpo text-advertencia">
      <strong>Texto base pendiente de revisión legal.</strong> Este documento
      cubre los puntos que exigen la Ley 29733 y el D.S. 003-2013-JUS, pero
      debe ser revisado por un <strong>abogado colegiado</strong> antes de la
      comercialización de Planix. No constituye asesoría legal. Versión{' '}
      {VERSION_DOCUMENTOS_LEGALES}.
    </p>
  );
}

function Marco({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-6 py-10">
      <Link to="/login" className="text-cuerpo text-primario underline">
        ← Volver
      </Link>
      <h1 className="text-titulo font-semibold text-texto">{titulo}</h1>
      <AvisoBorrador />
      <article className="space-y-5 text-cuerpo leading-relaxed text-texto">
        {children}
      </article>
      <p className="border-t border-borde pt-4 text-apoyo text-texto-tenue">
        Versión {VERSION_DOCUMENTOS_LEGALES} · Planix
      </p>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-seccion font-semibold text-texto">{titulo}</h2>
      {children}
    </section>
  );
}

function Lista({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-6">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function Terminos() {
  return (
    <Marco titulo="Términos de Servicio">
      <Seccion titulo="1. Qué es Planix y quién puede contratarlo">
        <p>
          Planix es un servicio web de gestión de planillas de sueldos conforme
          a la legislación laboral peruana. Permite registrar trabajadores,
          periodos de planilla, beneficios sociales, contratos y las
          declaraciones asociadas.
        </p>
        <p>Puede contratarlo:</p>
        <Lista
          items={[
            <>
              un <strong>estudio contable</strong>, que lleva las planillas de
              varias empresas cliente; o
            </>,
            <>
              una <strong>empresa</strong>, que lleva la planilla de sus propios
              trabajadores.
            </>,
          ]}
        />
        <p>
          La modalidad se elige al registrarse y determina obligaciones legales
          distintas en materia de protección de datos, descritas en el Aviso de
          Privacidad.
        </p>
      </Seccion>

      <Seccion titulo="2. Cuenta, usuarios y responsabilidad de los accesos">
        <p>
          Quien contrata el servicio es el <strong>Titular de la cuenta</strong>{' '}
          y es responsable de los accesos que conceda. Puede invitar a otros
          usuarios y asignarles roles con distintos permisos. Cada usuario
          responde por la confidencialidad de sus credenciales y debe comunicar
          de inmediato cualquier uso no autorizado.
        </p>
        <p>
          El Titular se obliga a retirar el acceso de las personas que dejen de
          necesitarlo. Planix ofrece la desactivación de usuarios y el registro
          de auditoría para hacerlo verificable, pero la decisión es suya.
        </p>
      </Seccion>

      <Seccion titulo="3. Exactitud de la información y responsabilidad del cálculo">
        <p>
          Planix calcula sobre los datos que el suscriptor introduce y sobre los
          parámetros legales vigentes cargados en el sistema. La{' '}
          <strong>revisión y presentación</strong> de planillas, boletas y
          declaraciones ante SUNAT, AFPnet y demás entidades corresponde al
          suscriptor y a los profesionales que designe.
        </p>
        <p>
          Planix no presta servicios de asesoría contable, laboral ni tributaria,
          y no sustituye el criterio profesional de un contador colegiado.
        </p>
      </Seccion>

      <Seccion titulo="4. Suscripción, pagos y periodo de prueba">
        <p>
          El servicio se contrata por suscripción con renovación periódica. El
          alta incluye un periodo de prueba sin necesidad de tarjeta. Los cobros
          se procesan a través de una pasarela de pagos; Planix no almacena
          números de tarjeta.
        </p>
        <p>
          La falta de pago suspende la creación y modificación de información,
          pero <strong>nunca la lectura ni la descarga</strong>: la información
          registrada pertenece al suscriptor y permanece accesible y exportable.
        </p>
      </Seccion>

      <Seccion titulo="5. Disponibilidad, respaldos y terminación">
        <p>
          Planix realiza respaldos periódicos y ofrece la exportación de la
          información en formatos abiertos. El servicio puede interrumpirse por
          mantenimiento o por causas ajenas razonablemente imprevisibles.
        </p>
        <p>
          El suscriptor puede terminar la relación en cualquier momento. Antes
          de la baja definitiva dispondrá de un plazo razonable para exportar su
          información, sin perjuicio de los plazos de conservación legal
          descritos en el Aviso de Privacidad.
        </p>
      </Seccion>

      <Seccion titulo="6. Ley aplicable">
        <p>
          Estos Términos se rigen por la legislación peruana. Cualquier
          controversia se someterá a los jueces y tribunales del domicilio del
          prestador del servicio, salvo norma imperativa en contrario,
          incluidas las de protección al consumidor cuando resulten aplicables.
        </p>
      </Seccion>
    </Marco>
  );
}

export function Privacidad() {
  return (
    <Marco titulo="Aviso de Privacidad">
      <Seccion titulo="1. Qué rol tiene cada parte">
        <p>
          La Ley 29733 distingue entre quien <em>decide</em> sobre un banco de
          datos y quien lo <em>trata por encargo</em>. En Planix esa distinción
          depende de la modalidad contratada:
        </p>
        <Lista
          items={[
            <>
              <strong>Empresa que lleva su propia planilla:</strong> la empresa
              es <strong>titular del banco de datos</strong> de sus trabajadores
              y Planix actúa como <strong>encargado del tratamiento</strong>.
            </>,
            <>
              <strong>Estudio contable:</strong> el titular del banco de datos
              es cada <strong>empresa cliente</strong>; el estudio actúa como{' '}
              <strong>encargado</strong> por cuenta de ella y Planix como{' '}
              <strong>subencargado</strong>. El estudio debe contar con la
              habilitación de sus clientes para servirse de un proveedor
              tecnológico.
            </>,
          ]}
        />
        <p>
          En ambos casos <strong>Planix no decide</strong> sobre los datos:
          los trata siguiendo las instrucciones del suscriptor y para prestar el
          servicio contratado.
        </p>
      </Seccion>

      <Seccion titulo="2. Qué datos se tratan">
        <p>De los usuarios de la cuenta: nombre, correo, rol y registros de acceso.</p>
        <p>De los trabajadores registrados por el suscriptor:</p>
        <Lista
          items={[
            'Identificación: nombres, apellidos, tipo y número de documento, nacionalidad, fecha de nacimiento.',
            'Laborales: cargo, categoría, fechas de ingreso y cese, régimen laboral, contratos, jornada, asistencia.',
            'Económicos: remuneraciones, beneficios, préstamos, retenciones y cuentas bancarias.',
            <>
              Previsionales y de seguridad social: sistema pensionario, CUSPP,
              afiliación a EPS.
            </>,
            <>
              <strong>Datos sensibles</strong>: los días de incapacidad y los
              certificados médicos (CITT) constituyen datos de salud, y los
              descuentos por mandato judicial pueden revelar situación
              familiar. Reciben protección reforzada.
            </>,
          ]}
        />
        <p>
          Planix <strong>no solicita ni requiere</strong> datos de origen étnico,
          convicciones religiosas, afiliación política ni vida sexual. El
          suscriptor no debe introducirlos en campos de texto libre.
        </p>
      </Seccion>

      <Seccion titulo="3. Para qué se tratan y con qué base">
        <p>
          Los datos se tratan <strong>únicamente</strong> para prestar el
          servicio: calcular y emitir planillas, boletas y beneficios sociales;
          generar los archivos de declaración ante las entidades competentes;
          conservar el historial que la propia normativa laboral exige; y
          administrar la cuenta y su facturación.
        </p>
        <p>
          La base del tratamiento es la <strong>ejecución de la relación
          laboral</strong> y el <strong>cumplimiento de obligaciones legales</strong>{' '}
          del empleador en materia laboral, tributaria y de seguridad social,
          supuestos en los que la Ley 29733 no exige consentimiento del
          trabajador. No se usan los datos con fines publicitarios ni se
          elaboran perfiles comerciales.
        </p>
      </Seccion>

      <Seccion titulo="4. Por cuánto tiempo se conservan">
        <p>
          Mientras la cuenta esté activa y, después, durante los plazos que
          impone la normativa peruana: la conservación de planillas y boletas
          por <strong>cinco (5) años</strong> desde el pago o desde el cese, y
          los plazos de prescripción tributaria y laboral que resulten
          aplicables.
        </p>
        <p>
          Cumplidos esos plazos, y si el suscriptor no solicitó antes la
          supresión, la información se elimina o se anonimiza de forma
          irreversible.
        </p>
      </Seccion>

      <Seccion titulo="5. Encargados y transferencias">
        <p>
          Para prestar el servicio Planix se apoya en proveedores que actúan
          como encargados y solo tratan los datos conforme a instrucciones:
          alojamiento de la aplicación y de la base de datos, envío de correo
          transaccional, procesamiento de pagos de la suscripción y monitoreo de
          errores.
        </p>
        <p>
          Algunos de estos proveedores pueden estar ubicados{' '}
          <strong>fuera del Perú</strong>, lo que constituye un{' '}
          <strong>flujo transfronterizo</strong> sujeto a los artículos 15 de la
          Ley y 26 de su Reglamento. Se seleccionan proveedores que ofrezcan
          niveles de protección adecuados y cláusulas contractuales que los
          obliguen a mantenerlos. La relación actualizada de proveedores puede
          solicitarse por el canal de contacto.
        </p>
        <p>
          Fuera de estos casos, los datos <strong>no se ceden a terceros</strong>,
          salvo requerimiento de autoridad competente.
        </p>
      </Seccion>

      <Seccion titulo="6. Derechos ARCO y cómo ejercerlos">
        <p>
          Todo trabajador cuyos datos figuren en el sistema tiene derecho de{' '}
          <strong>acceso, rectificación, cancelación y oposición</strong>, además
          de los derechos de información y de tratamiento objetivo previstos en
          la Ley.
        </p>
        <p>
          <strong>Ante quién se ejercen:</strong> ante el titular del banco de
          datos, que es su empleador —la empresa—. Planix, como encargado, no
          puede atender directamente estas solicitudes; si recibe una, la
          traslada sin demora al suscriptor y le presta la asistencia técnica
          necesaria para responderla.
        </p>
        <p>
          <strong>Plazos legales para responder</strong> (Reglamento,
          D.S. 003-2013-JUS):
        </p>
        <Lista
          items={[
            <>
              Derecho de <strong>acceso</strong>: veinte (20) días hábiles desde
              la recepción de la solicitud, prorrogables una sola vez y de forma
              justificada.
            </>,
            <>
              Derechos de <strong>rectificación, cancelación y oposición</strong>:
              diez (10) días hábiles.
            </>,
            <>
              Si la solicitud no se atiende o se deniega, el titular puede
              iniciar el <strong>procedimiento de tutela</strong> ante la
              Autoridad Nacional de Protección de Datos Personales, dentro de
              los quince (15) días hábiles siguientes al vencimiento del plazo.
            </>,
          ]}
        />
        <p>
          Hay derechos que no pueden ejercerse sin más: la cancelación no procede
          cuando los datos deben conservarse por mandato legal, como ocurre con
          las planillas durante los cinco años señalados.
        </p>
      </Seccion>

      <Seccion titulo="7. Inscripción del banco de datos">
        <p>
          El artículo 34 de la Ley 29733 obliga al{' '}
          <strong>titular del banco de datos</strong> a inscribirlo en el
          Registro Nacional de Protección de Datos Personales. Esa obligación
          corresponde al empleador —la empresa— y{' '}
          <strong>no la asume Planix</strong>, que actúa como encargado.
        </p>
        <p>
          Si el suscriptor es un estudio contable, la obligación recae sobre cada
          empresa cliente respecto de su propio banco de datos de personal. Se
          recomienda verificar su cumplimiento: la falta de inscripción es
          sancionable con independencia de la herramienta utilizada.
        </p>
      </Seccion>

      <Seccion titulo="8. Medidas de seguridad">
        <p>
          Planix aplica medidas técnicas y organizativas acordes con la Directiva
          de Seguridad de la Información de la Autoridad:
        </p>
        <Lista
          items={[
            'Contraseñas almacenadas con argon2id; nunca en texto legible.',
            'Verificación en dos pasos (TOTP) disponible para todos los usuarios.',
            'Sesiones con token de vida corta y renovación rotativa con detección de reutilización.',
            <>
              <strong>Cifrado en reposo</strong> (AES-256-GCM) del segundo factor
              y de los números de cuenta bancaria y CCI.
            </>,
            <>
              <strong>Aislamiento entre suscriptores</strong> en dos capas: filtro
              en la aplicación y seguridad a nivel de fila en la propia base de
              datos.
            </>,
            'Control de acceso por roles, con la gestión de usuarios reservada al Titular de la cuenta.',
            'Registro de auditoría de las operaciones relevantes, con usuario, fecha y dirección IP, y sin volcar datos sensibles.',
            'Transporte cifrado (HTTPS), cabeceras de seguridad, límites de peticiones y respaldos periódicos.',
          ]}
        />
        <p>
          Ninguna medida elimina por completo el riesgo. Ante un incidente que
          pueda afectar a los datos, Planix informará al suscriptor sin demora
          para que este cumpla sus propias obligaciones de comunicación.
        </p>
      </Seccion>

      <Seccion titulo="9. Contacto">
        <p>
          Las consultas sobre este Aviso pueden dirigirse al canal de contacto
          publicado por el prestador del servicio. Las solicitudes de ejercicio
          de derechos deben dirigirse al empleador titular del banco de datos,
          según lo indicado en la sección 6.
        </p>
      </Seccion>
    </Marco>
  );
}
