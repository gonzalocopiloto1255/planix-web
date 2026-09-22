import { z } from 'zod';

/**
 * Respuesta del endpoint GET /health de la API.
 * Schema de ejemplo para verificar la cadena de tipos compartidos front/back.
 */
/**
 * `/health` dice también QUÉ BUILD está vivo.
 *
 * Sin esto, comprobar un despliegue era adivinar: el endpoint respondía
 * `{status, db}` idéntico antes y después, así que la única forma de
 * saber si Render ya servía el código nuevo era deducirlo de relojes
 * ajenos —y el reloj del CI no es el de Render—. Pasó dos veces, y la
 * primera hubo que corregir una afirmación publicada.
 *
 * Un hash corto de commit no es un secreto y el endpoint ya era público,
 * así que no se autentica. `desconocido` cuando las variables no están:
 * en local no hay build, y eso es una respuesta legítima, no un error.
 */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  db: z.boolean(),
  /** Commit corto (7) del código que está sirviendo, o `desconocido`. */
  commit: z.string(),
  /** ISO-8601 del arranque del proceso, o `desconocido`. */
  desplegado: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

// =====================================================================
// Parámetros legales versionados (Sesión 2)
// =====================================================================

/** Código de parámetro legal, p.ej. "RMV", "UIT", "ONP_TASA" */
export const codigoParametroSchema = z
  .string()
  .min(1)
  .max(60)
  .regex(/^[A-Z][A-Z0-9_]*$/, 'Código inválido: solo mayúsculas, dígitos y _');

export const afpAdministradoraSchema = z.enum([
  'HABITAT',
  'INTEGRA',
  'PRIMA',
  'PROFUTURO',
]);

export type AfpAdministradora = z.infer<typeof afpAdministradoraSchema>;

/** Query opcional ?fecha=YYYY-MM-DD para consultar vigencia histórica */
export const fechaVigenciaQuerySchema = z.object({
  fecha: z.iso.date().optional(),
});

export type FechaVigenciaQuery = z.infer<typeof fechaVigenciaQuerySchema>;

// =====================================================================
// Escritura de parámetros legales (Sesión 7) — solo SUPERADMIN
// =====================================================================

/** Monto/tasa como string decimal (el dinero jamás viaja como number — CLAUDE.md §4.1) */
export const decimalStringSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, 'Debe ser un número decimal no negativo, ej. 1130.00');

export const crearParametroSchema = z.object({
  codigo: codigoParametroSchema,
  valor: decimalStringSchema,
  vigenteDesde: z.iso.date(),
  vigenteHasta: z.iso.date().optional(),
  normaLegal: z.string().max(120).optional(),
});

export type CrearParametroInput = z.infer<typeof crearParametroSchema>;

export const crearTasaAfpSchema = z.object({
  administradora: afpAdministradoraSchema,
  fondo: decimalStringSchema,
  primaSeguro: decimalStringSchema,
  comisionFlujo: decimalStringSchema,
  comisionSaldo: decimalStringSchema,
  vigenteDesde: z.iso.date(),
  vigenteHasta: z.iso.date().optional(),
});

export type CrearTasaAfpInput = z.infer<typeof crearTasaAfpSchema>;

/** RUC peruano: 11 dígitos que empiezan en 10 (natural) o 20 (jurídica). BLOQUEANTE. */
export const rucSchema = z
  .string()
  .regex(/^(10|20)\d{9}$/, 'El RUC debe tener 11 dígitos y empezar en 10 o 20');

// =====================================================================
// Auth (Sesión 7)
// =====================================================================

export const rolSchema = z.enum([
  'SUPERADMIN',
  'TITULAR',
  'ADMINISTRADOR',
  'OPERADOR',
  'PERSONAL',
  'SOLO_LECTURA',
]);
export type Rol = z.infer<typeof rolSchema>;

/** Roles que un TITULAR puede asignar dentro de su tenant (§12). */
export const rolAsignableSchema = z.enum([
  'TITULAR',
  'ADMINISTRADOR',
  'OPERADOR',
  'PERSONAL',
  'SOLO_LECTURA',
]);
export type RolAsignable = z.infer<typeof rolAsignableSchema>;

/** Etiquetas y descripción de cada rol, para no repetirlas en la UI. */
/**
 * Etiqueta y descripción de cada rol. Se muestran EN LA PANTALLA de alta
 * de usuarios: el titular elige con criterio y no adivinando por el
 * nombre, que es justo lo que pasaba cuando el rol se llamaba "RRHH" y
 * parecía el del jefe del área.
 */
export const DESCRIPCION_ROL: Record<RolAsignable, { etiqueta: string; detalle: string }> = {
  TITULAR: {
    etiqueta: 'Titular de la cuenta',
    detalle:
      'Acceso total. Gestiona usuarios, suscripción y toda la operación. Es quien contrató Planix.',
  },
  ADMINISTRADOR: {
    etiqueta: 'Administrador',
    detalle:
      'Acceso total a la operación: planillas, beneficios, cierres, liquidaciones y reportes. No gestiona usuarios ni la suscripción.',
  },
  OPERADOR: {
    etiqueta: 'Operador',
    detalle:
      'Registra y digita todo el trabajo del día a día. No puede ejecutar actos irreversibles (cerrar periodos, liquidar, depositar CTS, registrar gratificaciones o utilidades).',
  },
  PERSONAL: {
    etiqueta: 'Personal',
    detalle:
      'Gestiona trabajadores, contratos, vacaciones y préstamos. Ve las planillas en solo lectura.',
  },
  SOLO_LECTURA: {
    etiqueta: 'Solo lectura',
    detalle: 'Consulta y descarga información, sin modificar nada.',
  },
};

// =====================================================================
// GRUPOS DE ROLES — una sola definición para los dos lados.
//
// Nacieron en `apps/api/src/auth/permisos.ts` (S23.5) para que los 117
// decoradores no enumeraran roles a mano. Viven aquí desde que se vio
// que el frontend estaba repitiendo ese mismo problema por su cuenta:
// ocho sitios comparando roles a mano, y tres de ellos con una lista
// distinta de la que el backend permite de verdad.
//
// La diferencia entre los dos lados no es de grado: en el backend un rol
// de más ABRE una puerta y se nota; en el frontend un rol de menos
// ESCONDE una función y no se nota nada —ni un error en consola—, así
// que el defecto sobrevive hasta que alguien echa de menos algo. Es lo
// que pasó con el banner de suscripción y el titular.
//
// La documentación de cada grupo y la regla del operador siguen en
// `apps/api/src/auth/permisos.ts`, que reexporta esto sin cambiar nada.
// La matriz completa por módulo está en el README.
// =====================================================================

/** Todo el que entra al tenant: consultas y descargas. */
export const LECTURA: Rol[] = [
  'TITULAR',
  'ADMINISTRADOR',
  'OPERADOR',
  'PERSONAL',
  'SOLO_LECTURA',
];

/** Lectura de lo CONTABLE. PERSONAL queda fuera, también de la lectura. */
export const LECTURA_CONTABLE: Rol[] = [
  'TITULAR',
  'ADMINISTRADOR',
  'OPERADOR',
  'SOLO_LECTURA',
];

/** El día a día, todo REHACIBLE. */
export const OPERACION_DIARIA: Rol[] = ['TITULAR', 'ADMINISTRADOR', 'OPERADOR'];

/** Alta y edición del ciclo de vida de las personas. Las BAJAS no. */
export const GESTION_PERSONAS: Rol[] = [
  'TITULAR',
  'ADMINISTRADOR',
  'OPERADOR',
  'PERSONAL',
];

/** Lo que NO TIENE VUELTA ATRÁS o compromete responsabilidad legal. */
export const ACTO_IRREVERSIBLE: Rol[] = ['TITULAR', 'ADMINISTRADOR'];

/** La CUENTA: usuarios, suscripción, auditoría y exportación de datos. */
export const CUENTA: Rol[] = ['TITULAR'];

/** Plataforma: parámetros nacionales, tasas SBS, cronograma, tenants. */
export const PLATAFORMA: Rol[] = ['SUPERADMIN'];

/** La PROPIA cuenta: contraseña y segundo factor. Todos, superadmin incluido. */
export const CUENTA_PROPIA: Rol[] = [
  'SUPERADMIN',
  'TITULAR',
  'ADMINISTRADOR',
  'OPERADOR',
  'PERSONAL',
  'SOLO_LECTURA',
];

/** Lectura de los catálogos NACIONALES: RMV, UIT, tasas AFP, feriados. */
export const CATALOGO_NACIONAL: Rol[] = CUENTA_PROPIA;

/**
 * Roles que un TITULAR puede asignar dentro de su tenant. Se deriva del
 * schema para que no haya una segunda lista que mantener: había tres
 * copias de esto (la del backend, este schema y una suelta en la
 * pantalla de usuarios).
 */
export const ROLES_ASIGNABLES: RolAsignable[] = rolAsignableSchema.options;

/**
 * ¿Este rol pertenece al grupo? Es la comprobación que el frontend
 * necesita en cada guarda; el backend usa los grupos desde `@Roles`.
 * Acepta `undefined` porque mientras se recupera la sesión no hay rol,
 * y en ese momento la respuesta correcta es «todavía no».
 */
export function puede(rol: Rol | undefined | null, grupo: Rol[]): boolean {
  return Boolean(rol && grupo.includes(rol));
}

export const tipoTenantSchema = z.enum(['ESTUDIO_CONTABLE', 'EMPRESA']);
export type TipoTenant = z.infer<typeof tipoTenantSchema>;

export const tipoContribuyenteSchema = z.enum(['NATURAL', 'JURIDICA']);
export type TipoContribuyente = z.infer<typeof tipoContribuyenteSchema>;

/**
 * Tipo de contribuyente según el prefijo del RUC (SUNAT): 10 = persona
 * natural con negocio, 20 = persona jurídica. Devuelve null para los
 * demás prefijos, que el schema rechaza antes de llegar aquí.
 */
export function tipoContribuyenteDeRuc(ruc: string): TipoContribuyente | null {
  if (ruc.startsWith('10')) return 'NATURAL';
  if (ruc.startsWith('20')) return 'JURIDICA';
  return null;
}

export const passwordSchema = z
  .string()
  .min(10, 'La contraseña debe tener al menos 10 caracteres')
  .regex(/[a-zA-Z]/, 'La contraseña debe incluir letras')
  .regex(/[0-9]/, 'La contraseña debe incluir números');

export const registroSchema = z.object({
  email: z.email('Correo electrónico inválido'),
  password: passwordSchema,
  nombres: z.string().min(1, 'Ingresa tus nombres').max(80),
  apellidos: z.string().min(1, 'Ingresa tus apellidos').max(80),
  /**
   * Cómo usará Planix (S23.5). No es un detalle de formulario: si es
   * EMPRESA, el alta le crea su única empresa cliente con estos mismos
   * datos y nunca se le habla de "empresas cliente".
   */
  tipo: tipoTenantSchema,
  /** Nombre del estudio contable, o razón social si el tenant es EMPRESA. */
  nombreEstudio: z.string().min(3, 'Ingresa el nombre').max(120),
  /**
   * RUC OBLIGATORIO desde la S23.5: sin él no se puede declarar nada ante
   * SUNAT, y si el tenant es EMPRESA es además el RUC de la empresa que
   * se crea sola. Se valida el tipo (10 natural / 20 jurídica); el dígito
   * verificador se avisa pero NO bloquea, igual que en empresas.
   */
  rucEstudio: rucSchema,
  /**
   * Consentimiento informado (Ley 29733, S23). Es OBLIGATORIO y tiene que
   * ser un `true` explícito: sin aceptación no hay base legal para tratar
   * datos personales de terceros, que es justo lo que hace Planix.
   */
  aceptaTerminos: z.literal(true, {
    message: 'Debes aceptar los Términos y el Aviso de Privacidad para registrarte',
  }),
});

export type RegistroInput = z.infer<typeof registroSchema>;

export const loginSchema = z.object({
  email: z.email('Correo electrónico inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// =====================================================================
// Empresas cliente (Sesión 8)
// =====================================================================

export const regimenLaboralSchema = z.enum([
  'GENERAL',
  'PEQUENA_EMPRESA',
  'MICROEMPRESA',
]);
export type RegimenLaboral = z.infer<typeof regimenLaboralSchema>;

export const bancoHaberesSchema = z.enum([
  'BCP',
  'BBVA',
  'INTERBANK',
  'SCOTIABANK',
  'BANBIF',
  'PICHINCHA',
  'OTRO',
]);
export type BancoHaberes = z.infer<typeof bancoHaberesSchema>;

/**
 * Dígito verificador del RUC (algoritmo estándar SUNAT, factores
 * 5,4,3,2,7,6,5,4,3,2 sobre los primeros 10 dígitos, módulo 11).
 * NO bloqueante: si no cuadra, la API acepta pero devuelve una
 * advertencia y la UI la muestra (puede ser un RUC antiguo o un typo).
 */
export function validarDigitoVerificadorRuc(ruc: string): boolean {
  if (!/^\d{11}$/.test(ruc)) {
    return false;
  }
  const factores = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = factores.reduce(
    (acc, factor, i) => acc + factor * Number(ruc[i]),
    0,
  );
  const resto = 11 - (suma % 11);
  const verificador = resto === 10 ? 0 : resto === 11 ? 1 : resto;
  return verificador === Number(ruc[10]);
}

/** Tasa SCTR: decimal string entre 0 y 0.05 (5%) */
const tasaSctrSchema = decimalStringSchema.refine(
  (v) => Number(v) <= 0.05,
  'La tasa SCTR debe estar entre 0 y 0.05',
);

/**
 * Cómo paga la empresa las QUINCENAS (§7.1, confirmado por la contadora en
 * la S20): MITAD_DE_TODO = 50% de TODO el sueldo en cada quincena (incluidas
 * asignación familiar, EsSalud y retención de 5ta, prorrateadas) — es el
 * flujo del estudio y el DEFAULT; ADELANTO_BASICO = la primera quincena es
 * un adelanto del básico y los conceptos mensuales se pagan íntegros al
 * cerrar el mes (esquema que usan otros estudios contables).
 */
export const modalidadPrimeraQuincenaSchema = z.enum([
  'MITAD_DE_TODO',
  'ADELANTO_BASICO',
]);

export const redondeoRetencion5taSchema = z.enum([
  'SIN_REDONDEO',
  'ENTERO_NORMAL',
  'ENTERO_ARRIBA',
]);
export type RedondeoRetencion5ta = z.infer<typeof redondeoRetencion5taSchema>;
export type ModalidadPrimeraQuincena = z.infer<
  typeof modalidadPrimeraQuincenaSchema
>;

export const empresaInputSchema = z
  .object({
    ruc: rucSchema,
    razonSocial: z.string().min(1, 'La razón social es obligatoria').max(200),
    nombreComercial: z.string().max(200).optional(),
    direccion: z.string().max(250).optional(),
    regimenLaboral: regimenLaboralSchema,
    // Salud y seguros
    tieneEps: z.boolean().default(false),
    epsNombre: z.string().max(120).optional(),
    tasaSctrSalud: tasaSctrSchema.optional(),
    tasaSctrPension: tasaSctrSchema.optional(),
    primaVidaLey: decimalStringSchema.optional(),
    aportaSenati: z.boolean().default(false),
    // Configuración
    porcentajeUtilidades: z
      .enum(['0.05', '0.08', '0.10'], {
        message: 'El porcentaje de utilidades solo puede ser 5%, 8% o 10%',
      })
      .optional(),
    jornadaDiariaHoras: z
      .number()
      .min(4, 'La jornada mínima es de 4 horas')
      .max(12, 'La jornada máxima es de 12 horas')
      .default(8),
    bancoHaberes: bancoHaberesSchema.optional(),
    modalidadPrimeraQuincena: modalidadPrimeraQuincenaSchema.default('MITAD_DE_TODO'),
    /**
     * Cómo redondea la empresa la retención mensual de 5.ª. NINGUNA norma
     * lo impone: SUNAT define el método —proyección, 7 UIT, tramos,
     * divisores— pero no el redondeo. Lo que sí ocurre es que el PDT
     * declara los tributos en soles enteros, y de ahí la práctica de
     * muchos estudios. **Por defecto ENTERO_ARRIBA desde la S24**, confirmado
     * por la contadora del estudio —«lo redondeo el de arriba»— y respaldado
     * por sus tres retenciones de enero 2026: 369, 655 y 1607 solo salen con
     * CEIL, y ninguna otra regla las reproduce las tres. Antes el defecto era
     * SIN_REDONDEO, elegido cuando no se sabía qué hacía ella. Sigue siendo
     * CONFIGURACIÓN: quien prefiera los dos decimales o el entero más cercano
     * los tiene ahí.
     */
    redondeoRetencion5ta: redondeoRetencion5taSchema.default('ENTERO_ARRIBA'),
    /**
     * Días laborables por semana (S23.6). Determina en qué proporción se
     * pierde el dominical por falta injustificada. 6 por defecto —lo más
     * frecuente en planillas de obreros—, pero la semana de lunes a
     * viernes es común en oficinas, comercio y servicios.
     */
    diasLaborablesSemana: z
      .number()
      .int()
      .min(5, 'La semana laboral es de 5 o 6 días')
      .max(6, 'La semana laboral es de 5 o 6 días')
      .default(6),
    /**
     * Día de descanso semanal, en la convención de `Date.getUTCDay()`
     * (0 = domingo). Un feriado que cae en este día queda absorbido y no
     * genera pago triple: no se acumulan dos descansos sobre el mismo día.
     */
    diaDescansoSemanal: z.number().int().min(0).max(6).default(0),
    /**
     * Condición de BUEN CONTRIBUYENTE (S22): SUNAT le concede fechas de
     * vencimiento distintas, que el cronograma trae en columna aparte.
     */
    buenContribuyente: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.tieneEps && !v.epsNombre) {
      ctx.addIssue({
        code: 'custom',
        path: ['epsNombre'],
        message: 'Indica el nombre de la EPS',
      });
    }
  });

export type EmpresaInput = z.infer<typeof empresaInputSchema>;

export const listarEmpresasQuerySchema = z.object({
  buscar: z.string().max(120).optional(),
  /** query param: llega como string */
  incluirInactivas: z.enum(['true', 'false']).optional(),
});
export type ListarEmpresasQuery = z.infer<typeof listarEmpresasQuerySchema>;

/** Empresa tal como la serializa la API (los Decimal viajan como string) */
export interface EmpresaDto {
  id: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  direccion: string | null;
  regimenLaboral: RegimenLaboral;
  tieneEps: boolean;
  epsNombre: string | null;
  tasaSctrSalud: string | null;
  tasaSctrPension: string | null;
  primaVidaLey: string | null;
  aportaSenati: boolean;
  porcentajeUtilidades: string | null;
  jornadaDiariaHoras: string;
  bancoHaberes: string | null;
  modalidadPrimeraQuincena: ModalidadPrimeraQuincena;
  /** S23.8: criterio de la empresa, ninguna norma lo impone. */
  redondeoRetencion5ta: RedondeoRetencion5ta;
  /** S23.6: 5 o 6. Base del prorrateo de la pérdida del dominical. */
  diasLaborablesSemana: number;
  /** S23.6: 0 = domingo. Los feriados que caen aquí quedan absorbidos. */
  diaDescansoSemanal: number;
  /** S22: decide qué columna del cronograma SUNAT le aplica */
  buenContribuyente: boolean;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

/** Respuesta de crear/editar: advertencias NO bloqueantes (p.ej. dígito verificador) */
export interface EmpresaConAdvertencias {
  empresa: EmpresaDto;
  advertencias: string[];
}

// =====================================================================
// Personas (Sesión 9) — validación DISCRIMINADA por tipo de vínculo
// =====================================================================

export const tipoVinculoSchema = z.enum(['PLANILLA', 'LOCADOR', 'PRACTICANTE']);
export type TipoVinculo = z.infer<typeof tipoVinculoSchema>;

export const sistemaPensionSchema = z.enum(['ONP', 'AFP', 'JUBILADO_AFP', 'JUBILADO_ONP']);
export type SistemaPension = z.infer<typeof sistemaPensionSchema>;

export const tipoComisionAfpSchema = z.enum(['FLUJO', 'MIXTA']);
export const categoriaTrabajadorSchema = z.enum(['OBRERO', 'EMPLEADO']);
export const periodicidadPagoSchema = z.enum(['QUINCENAL', 'FIN_DE_MES']);

/** Monto positivo (> 0) como string decimal */
const montoPositivoSchema = decimalStringSchema.refine(
  (v) => Number(v) > 0,
  'El monto debe ser mayor que cero',
);

/** Campos comunes a los tres tipos de vínculo */
const personaBase = {
  tipoDocumento: z.enum(['DNI', 'CE']).default('DNI'),
  numeroDocumento: z.string().min(1, 'Ingresa el número de documento').max(12),
  nombres: z.string().min(1, 'Ingresa los nombres').max(80),
  apellidos: z.string().min(1, 'Ingresa los apellidos').max(80),
  fechaNacimiento: z.iso.date().optional(),
  /** Dato que pide el T-Registro (S20); por defecto peruana */
  nacionalidad: z.string().max(60).optional(),
  direccion: z.string().max(250).optional(),
  email: z.email('Correo inválido').optional(),
  telefono: z.string().max(20).optional(),
  /**
   * SOLO en updates: fecha efectiva del cambio (§4.5). Si es futura, el
   * valor actual NO cambia todavía: queda programado en el historial.
   */
  vigenteDesde: z.iso.date().optional(),
};

/** Trabajador de planilla (§5.1). strictObject: campos ajenos al vínculo se rechazan. */
const trabajadorPlanillaSchema = z.strictObject({
  tipoVinculo: z.literal('PLANILLA'),
  ...personaBase,
  cargo: z.string().max(80).optional(),
  categoria: categoriaTrabajadorSchema,
  periodicidadPago: periodicidadPagoSchema,
  fechaIngreso: z.iso.date(),
  /** Default: el de la empresa. El del trabajador MANDA (§6). */
  regimenLaboral: regimenLaboralSchema.optional(),
  sueldoBasico: montoPositivoSchema,
  asignacionFamiliar: z.boolean().default(false),
  jornadaNocturna: z.boolean().default(false),
  /**
   * Override de los días laborables por semana de SU empresa (S23.6).
   * `null` = hereda. Existe porque es habitual que una misma empresa
   * tenga administrativos de lunes a viernes y operarios de lunes a
   * sábado: obligar a partir la empresa en dos para eso sería peor.
   */
  diasLaborablesSemana: z.number().int().min(5).max(6).nullish(),
  sistemaPension: sistemaPensionSchema,
  afp: afpAdministradoraSchema.optional(),
  cuspp: z
    .string()
    .regex(/^[A-Za-z0-9]{12}$/, 'El CUSPP tiene 12 caracteres alfanuméricos')
    .optional(),
  tipoComision: tipoComisionAfpSchema.optional(),
  afiliadoEps: z.boolean().default(false),
  essaludVida: z.boolean().default(false),
  aporteEpsTrabajador: decimalStringSchema.optional(),
  ingresosTercerosAnual: decimalStringSchema.optional(),
  ingresosAcumuladosAnual: decimalStringSchema.optional(),
  /**
   * Horas extras ESPERADAS al mes, en importe, para la proyección de 5.ª.
   * Opcional y sin valor por defecto: omitirlo es el comportamiento
   * normado, porque la proyección del art. 40.° del Reglamento LIR va
   * sobre la remuneración ordinaria y las horas extras no se presumen.
   * Se digita solo para quien las hace todos los meses.
   */
  proyeccionHorasExtrasMes: decimalStringSchema.optional(),
  /**
   * Sufijo del auxiliar contable del neto por pagar (S20, CASO 13:
   * 41111<xxx> empleados / 41112<xxx> operarios). Si se deja vacío el
   * sistema asigna el siguiente correlativo de la categoría al generar
   * el primer asiento y ya no lo cambia.
   */
  codigoContable: z
    .string()
    .regex(/^\d{1,6}$/, 'El código contable es un correlativo numérico')
    .optional(),
});

/** Locador de servicios 4ta (§5.3): sin campos de planilla (strict los rechaza). */
const locadorSchema = z.strictObject({
  tipoVinculo: z.literal('LOCADOR'),
  ...personaBase,
  /** Inicio de la prestación de servicios */
  fechaIngreso: z.iso.date(),
  rucLocador: z
    .string()
    .regex(/^10\d{9}$/, 'El RUC de persona natural tiene 11 dígitos y empieza en 10'),
  suspensionRetencion: z.boolean().default(false),
  suspensionConstancia: z.string().max(40).optional(),
  suspensionVigenteHasta: z.iso.date().optional(),
});

/** Practicante Ley 28518 (§5.4) */
const practicanteSchema = z.strictObject({
  tipoVinculo: z.literal('PRACTICANTE'),
  ...personaBase,
  /** Default: convenioInicio (lo resuelve la API) */
  fechaIngreso: z.iso.date().optional(),
  subvencionMensual: montoPositivoSchema,
  convenioInicio: z.iso.date(),
  convenioFin: z.iso.date(),
});

export const personaInputSchema = z
  .discriminatedUnion('tipoVinculo', [
    trabajadorPlanillaSchema,
    locadorSchema,
    practicanteSchema,
  ])
  .superRefine((v, ctx) => {
    // Documento según tipo
    if (v.tipoDocumento === 'DNI' && !/^\d{8}$/.test(v.numeroDocumento)) {
      ctx.addIssue({
        code: 'custom',
        path: ['numeroDocumento'],
        message: 'El DNI tiene 8 dígitos',
      });
    }
    if (v.tipoDocumento === 'CE' && !/^[A-Za-z0-9]{9,12}$/.test(v.numeroDocumento)) {
      ctx.addIssue({
        code: 'custom',
        path: ['numeroDocumento'],
        message: 'El carné de extranjería tiene de 9 a 12 caracteres alfanuméricos',
      });
    }
    // AFP: administradora, CUSPP, tipo de comisión y fecha de nacimiento
    // (la regla de la prima ≥65 depende de la edad — CLAUDE.md §5.2)
    if (v.tipoVinculo === 'PLANILLA' && v.sistemaPension === 'AFP') {
      if (!v.afp) {
        ctx.addIssue({ code: 'custom', path: ['afp'], message: 'Indica la AFP' });
      }
      if (!v.cuspp) {
        ctx.addIssue({ code: 'custom', path: ['cuspp'], message: 'El CUSPP es obligatorio si es AFP' });
      }
      if (!v.tipoComision) {
        ctx.addIssue({ code: 'custom', path: ['tipoComision'], message: 'Indica el tipo de comisión' });
      }
      if (!v.fechaNacimiento) {
        ctx.addIssue({
          code: 'custom',
          path: ['fechaNacimiento'],
          message: 'La fecha de nacimiento es obligatoria si es AFP (la prima cesa a los 65 años)',
        });
      }
    }
    // Suspensión de retenciones 4ta: constancia y vigencia (Form. 1609)
    if (v.tipoVinculo === 'LOCADOR' && v.suspensionRetencion) {
      if (!v.suspensionConstancia) {
        ctx.addIssue({
          code: 'custom',
          path: ['suspensionConstancia'],
          message: 'Indica el número de constancia (Formulario 1609)',
        });
      }
      if (!v.suspensionVigenteHasta) {
        ctx.addIssue({
          code: 'custom',
          path: ['suspensionVigenteHasta'],
          message: 'Indica hasta cuándo rige la suspensión (caduca cada 31 de diciembre)',
        });
      }
    }
    // Convenio del practicante coherente
    if (v.tipoVinculo === 'PRACTICANTE' && v.convenioFin <= v.convenioInicio) {
      ctx.addIssue({
        code: 'custom',
        path: ['convenioFin'],
        message: 'El fin del convenio debe ser posterior al inicio',
      });
    }
  });

export type PersonaInput = z.infer<typeof personaInputSchema>;

export const listarPersonasQuerySchema = z.object({
  tipoVinculo: tipoVinculoSchema.optional(),
  buscar: z.string().max(120).optional(),
  incluirCesados: z.enum(['true', 'false']).optional(),
});
export type ListarPersonasQuery = z.infer<typeof listarPersonasQuerySchema>;

// ------------------- Cuentas bancarias -------------------

export const tipoCuentaBancariaSchema = z.enum(['HABERES', 'CTS']);
export type TipoCuentaBancaria = z.infer<typeof tipoCuentaBancariaSchema>;

/** La cuenta CTS puede ser USD; la de haberes se paga en PEN (la API lo valida). */
export const cuentaBancariaInputSchema = z.object({
  banco: z.string().min(1, 'Indica el banco').max(60),
  numero: z.string().min(4, 'Número de cuenta inválido').max(30),
  cci: z.string().regex(/^\d{20}$/, 'El CCI tiene 20 dígitos').optional(),
  moneda: z.enum(['PEN', 'USD']).default('PEN'),
});
export type CuentaBancariaInput = z.infer<typeof cuentaBancariaInputSchema>;

// ------------------- DTOs de personas -------------------

export interface PersonaDto {
  id: string;
  empresaId: string;
  tipoVinculo: TipoVinculo;
  tipoDocumento: string;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  fechaNacimiento: string | null;
  nacionalidad: string;
  direccion: string | null;
  email: string | null;
  telefono: string | null;
  cargo: string | null;
  categoria: 'OBRERO' | 'EMPLEADO' | null;
  periodicidadPago: 'QUINCENAL' | 'FIN_DE_MES' | null;
  fechaIngreso: string;
  regimenLaboral: RegimenLaboral | null;
  sueldoBasico: string | null;
  asignacionFamiliar: boolean;
  jornadaNocturna: boolean;
  /** S23.6: null = hereda la jornada semanal de su empresa. */
  diasLaborablesSemana: number | null;
  sistemaPension: SistemaPension | null;
  afp: AfpAdministradora | null;
  cuspp: string | null;
  tipoComision: 'FLUJO' | 'MIXTA' | null;
  afiliadoEps: boolean;
  aporteEpsTrabajador: string | null;
  essaludVida: boolean;
  ingresosTercerosAnual: string | null;
  ingresosAcumuladosAnual: string | null;
  /** Horas extras esperadas al mes para la proyección de 5.ª; null = no se proyectan. */
  proyeccionHorasExtrasMes: string | null;
  rucLocador: string | null;
  suspensionRetencion: boolean;
  suspensionConstancia: string | null;
  suspensionVigenteHasta: string | null;
  subvencionMensual: string | null;
  convenioInicio: string | null;
  convenioFin: string | null;
  estadoCese: 'ACTIVO' | 'CESADO';
  fechaCese: string | null;
  motivoCese: string | null;
  /** Correlativo del auxiliar contable (41111xxx / 41112xxx), S20 */
  codigoContable: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface PersonaConAdvertencias {
  persona: PersonaDto;
  advertencias: string[];
}

export interface CuentaBancariaDto {
  id: string;
  tipo: TipoCuentaBancaria;
  banco: string;
  numero: string;
  cci: string | null;
  moneda: 'PEN' | 'USD';
  activa: boolean;
}

export interface PersonaHistorialDto {
  id: string;
  campo: string;
  valorAnterior: string | null;
  valorNuevo: string;
  vigenteDesde: string;
  registradoPor: string;
  /** Nombre del usuario que registró el cambio (para la línea de tiempo) */
  registradoPorNombre: string | null;
  creadoEn: string;
}

// ------------------- Importador Excel -------------------

export interface ErrorImportacion {
  hoja: string;
  fila: number;
  columna?: string;
  mensaje: string;
}

export interface ResultadoImportacion {
  creados: number;
  /** Filas válidas cuya persona ya existía (upsert por documento: no duplica) */
  omitidos: number;
  errores: ErrorImportacion[];
  /** No bloqueantes: "ya existía", subvención bajo RMV, dígito RUC, etc. */
  avisos: ErrorImportacion[];
}

// =====================================================================
// Planillas: periodos, digitación y cierre (Sesión 10)
// =====================================================================

export const tipoPeriodoSchema = z.enum([
  'PRIMERA_QUINCENA',
  'SEGUNDA_QUINCENA',
  'MENSUAL',
]);
export type TipoPeriodo = z.infer<typeof tipoPeriodoSchema>;

export const abrirPeriodoSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12),
  tipo: tipoPeriodoSchema,
});
export type AbrirPeriodoInput = z.infer<typeof abrirPeriodoSchema>;

/**
 * Variables que DIGITA el contador (§7.1); el resto lo calcula el engine.
 * Las tres últimas son MONTOS en soles (ingresos/descuentos extraordinarios
 * puntuales): ING_AFECTO entra a la base de AFP/ONP y EsSalud;
 * ING_NO_AFECTO no (movilidad supeditada a asistencia, canasta…) y se suma
 * después del neto afecto; DSCTO_VOLUNTARIO es el último del orden §7.3.
 */
export const CLAVES_VARIABLES = [
  'DIAS_LABORADOS',
  'FALTAS',
  'TARDANZA_MIN',
  'HE25_HORAS',
  'HE35_HORAS',
  'FERIADO_TRABAJADO_DIAS',
  'DIAS_VACACIONES',
  'DIAS_CITT',
  'DIAS_LSGH',
  'ING_AFECTO',
  'ING_NO_AFECTO',
  'DSCTO_VOLUNTARIO',
  'ADELANTO_Q1',
] as const;
export type ClaveVariable = (typeof CLAVES_VARIABLES)[number];

/** Claves que son montos en soles (las demás son días, horas o minutos) */
export const CLAVES_MONTO: ClaveVariable[] = [
  'ING_AFECTO',
  'ING_NO_AFECTO',
  'DSCTO_VOLUNTARIO',
  'ADELANTO_Q1',
];

export const claveVariableSchema = z.enum(CLAVES_VARIABLES);

/** Batch de digitación: varias personas y sus variables a la vez */
/**
 * Claves cuyo código de la tabla 22 NO puede deducir el sistema (S23.7):
 * depende de qué se pagó o descontó, y eso solo lo sabe quien lo digitó.
 * El resto de conceptos los emite el motor con su código fijo.
 */
export const CLAVES_CON_CODIGO_T22: ClaveVariable[] = [
  'ING_AFECTO',
  'ING_NO_AFECTO',
  'DSCTO_VOLUNTARIO',
];

export const variablesBatchSchema = z.object({
  filas: z
    .array(
      z.object({
        personaId: z.uuid(),
        // partialRecord: el contador digita solo las claves que cambian
        // (z.record con enum exigiría TODAS las claves)
        variables: z.partialRecord(
          claveVariableSchema,
          z.number().min(0).max(999999),
        ),
        /**
         * Código de la T22 por clave, para las tres de arriba. Sin él la
         * línea se omite del PLAME con aviso; nunca se adivina uno.
         */
        codigosT22: z.partialRecord(claveVariableSchema, z.string().nullable()).optional(),
      }),
    )
    .min(1),
});
export type VariablesBatchInput = z.infer<typeof variablesBatchSchema>;

export interface LineaConceptoDto {
  codigo: string;
  tipo: 'INGRESO' | 'DESCUENTO' | 'APORTE_EMPLEADOR';
  monto: string;
  cantidad?: string;
}

export interface TotalesDto {
  totalIngresos: string;
  totalDescuentos: string;
  totalAportesEmpleador: string;
  netoPagar: string;
}

/** Una fila de la grilla de digitación: persona + variables + resultado del engine */
export interface FilaPlanillaDto {
  personaId: string;
  nombres: string;
  apellidos: string;
  numeroDocumento: string;
  cargo: string | null;
  /** Valores VIGENTES en la fecha del periodo (§4.5), no los actuales */
  sueldoBasico: string;
  regimenLaboral: RegimenLaboral;
  sistemaPension: SistemaPension;
  afp: AfpAdministradora | null;
  /** Indicadores para el contador (badges de la grilla) */
  tienePrestamo: boolean;
  tieneRetencionJudicial: boolean;
  tieneSubsidio: boolean;
  esJubilado: boolean;
  variables: Record<string, number>;
  /** Código de la T22 elegido por clave (S23.7); vacío si aún no eligió. */
  codigosT22?: Record<string, string | null>;
  lineas: LineaConceptoDto[];
  remuneracionAfecta: string;
  totales: TotalesDto;
}

export interface PeriodoDto {
  id: string;
  empresaId: string;
  anio: number;
  mes: number;
  tipo: TipoPeriodo;
  estado: 'ABIERTO' | 'CERRADO';
  fechaInicio: string;
  fechaFin: string;
  cerradoEn: string | null;
}

export interface PlanillaPeriodoDto {
  periodo: PeriodoDto;
  filas: FilaPlanillaDto[];
  totales: TotalesDto;
  /** Advertencias detectadas (se muestran en el resumen de cierre) */
  advertencias: string[];
  /**
   * Retenciones judiciales del periodo: cuánto retener y a qué
   * beneficiario/cuenta depositar (el contador deposita manualmente; el
   * resumen de cierre le da el dato exacto — Sesión 16).
   */
  retencionesJudiciales: RetencionJudicialAplicadaDto[];
}

export interface ResumenCierreDto {
  totalTrabajadores: number;
  totales: TotalesDto;
  advertencias: string[];
}

// =====================================================================
// CTS (Sesión 11) — §8.1
// =====================================================================

/** Semestres de CTS: nov-abr (deposita hasta el 15-may) y may-oct (hasta el 15-nov) */
export const semestreCtsSchema = z.enum(['NOV_ABR', 'MAY_OCT']);
export type SemestreCts = z.infer<typeof semestreCtsSchema>;

export const calcularCtsSchema = z.object({
  /** Año de INICIO del semestre (NOV_ABR 2025 = nov-2025 a abr-2026) */
  anio: z.number().int().min(2000).max(2100),
  semestre: semestreCtsSchema,
});
export type CalcularCtsInput = z.infer<typeof calcularCtsSchema>;

export const depositarCtsSchema = calcularCtsSchema.extend({
  fechaDeposito: z.iso.date(),
  /** Solo si hay cuentas en USD y la consulta a SUNAT falló */
  tipoCambioManual: decimalStringSchema.optional(),
  /** Personas a depositar (las de microempresa no entran) */
  personaIds: z.array(z.uuid()).min(1),
});
export type DepositarCtsInput = z.infer<typeof depositarCtsSchema>;

export interface DesgloseCtsDto {
  sueldoBasico: string;
  asignacionFamiliar: string;
  sextoGratificacion: string;
  promedioHorasExtras: string;
  mesesConHorasExtras: number;
  aplicaRegla3De6: boolean;
  remComputable: string;
}

export interface FilaCtsDto {
  personaId: string;
  nombres: string;
  apellidos: string;
  numeroDocumento: string;
  regimenLaboral: RegimenLaboral;
  desglose: DesgloseCtsDto;
  mesesCompletos: number;
  diasAdicionales: number;
  montoSoles: string;
  /** Cuenta CTS registrada (null = falta registrarla: la UI lo alerta en rojo) */
  banco: string | null;
  cuenta: string | null;
  moneda: 'PEN' | 'USD';
  /** Nota legal: microempresa sin derecho, tope de pequeña empresa… */
  nota?: string;
  /** Ya tiene depósito registrado en este semestre */
  yaDepositado: boolean;
}

export interface CalculoCtsDto {
  semestre: string;
  fechaInicio: string;
  fechaFin: string;
  /** Fecha límite legal del depósito (15-may / 15-nov) */
  fechaLimite: string;
  filas: FilaCtsDto[];
  totalSoles: string;
  /** Advertencias: sin cuenta CTS, sin periodos cerrados en el semestre… */
  advertencias: string[];
}

export interface DepositoCtsDto {
  id: string;
  personaId: string;
  semestre: string;
  remComputable: string;
  montoSoles: string;
  moneda: 'PEN' | 'USD';
  tipoCambio: string | null;
  montoDepositado: string;
  banco: string;
  cuenta: string;
  fechaDeposito: string;
}

// =====================================================================
// Gratificaciones (Sesión 12) — §8.2
// =====================================================================

/** Mes de pago: julio (semestre ene-jun) o diciembre (semestre jul-dic) */
export const mesGratificacionSchema = z.union([z.literal(7), z.literal(12)]);
export type MesGratificacion = z.infer<typeof mesGratificacionSchema>;

export const calcularGratiSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  mes: mesGratificacionSchema,
});
export type CalcularGratiInput = z.infer<typeof calcularGratiSchema>;

export const registrarGratiSchema = calcularGratiSchema.extend({
  personaIds: z.array(z.uuid()).min(1),
});
export type RegistrarGratiInput = z.infer<typeof registrarGratiSchema>;

export interface DesgloseGratiDto {
  sueldoBasico: string;
  asignacionFamiliar: string;
  promedioHorasExtras: string;
  mesesConHorasExtras: number;
  aplicaRegla3De6: boolean;
  remComputable: string;
}

export interface FilaGratiDto {
  personaId: string;
  nombres: string;
  apellidos: string;
  numeroDocumento: string;
  regimenLaboral: RegimenLaboral;
  afiliadoEps: boolean;
  desglose: DesgloseGratiDto;
  mesesCompletos: number;
  diasAdicionales: number;
  gratificacion: string;
  /** 0.09 (9%) o 0.0675 (6.75% con EPS) — Ley 29351 */
  tasaBonificacion: string;
  bonificacion: string;
  total: string;
  nota?: string;
  yaRegistrada: boolean;
}

export interface CalculoGratiDto {
  anio: number;
  mes: MesGratificacion;
  /** Semestre computado: "ENE-JUN 2025" o "JUL-DIC 2025" */
  semestre: string;
  fechaInicio: string;
  fechaFin: string;
  /** Fecha límite legal de pago (15-jul / 15-dic) */
  fechaLimite: string;
  filas: FilaGratiDto[];
  totalGratificaciones: string;
  totalBonificaciones: string;
  totalPagar: string;
  advertencias: string[];
}

export interface GratificacionDto {
  id: string;
  personaId: string;
  anio: number;
  mes: number;
  remComputable: string;
  mesesComputables: string;
  montoGratificacion: string;
  tasaBonificacion: string;
  montoBonificacion: string;
  total: string;
}

// =====================================================================
// Vacaciones (Sesión 13) — §8.3
// =====================================================================

export const estadoPeriodoVacacionalSchema = z.enum([
  'VIGENTE',
  'POR_VENCER', // vence en menos de 90 días sin goce completo
  'VENCIDO', // riesgo de indemnización (salvo gerente)
]);
export type EstadoPeriodoVacacional = z.infer<typeof estadoPeriodoVacacionalSchema>;

export const registrarGoceSchema = z.object({
  periodoVacacionalId: z.uuid(),
  dias: z.number().positive().max(60),
  fechaInicio: z.iso.date(),
  fechaFin: z.iso.date(),
  glosa: z.string().max(200).optional(),
});
export type RegistrarGoceInput = z.infer<typeof registrarGoceSchema>;

export const cuotaVentaSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12),
  tipoPeriodo: tipoPeriodoSchema.optional(),
  monto: decimalStringSchema,
});
export type CuotaVentaInput = z.infer<typeof cuotaVentaSchema>;

export const ventaVacacionesSchema = z.object({
  periodoVacacionalId: z.uuid(),
  diasVendidos: z.number().int().positive().max(60),
  /** Si no viene, se calcula: remuneración diaria computable × días */
  montoTotal: decimalStringSchema.optional(),
  fechaAcuerdo: z.iso.date(),
  /** Cronograma de pago: una cuota o varias (espejo de préstamos, a favor del trabajador) */
  cuotas: z.array(cuotaVentaSchema).min(1),
  /** Obligatorio si la venta excede el máximo legal (override consciente §8.3) */
  confirmarOverride: z.boolean().optional(),
  documentoRef: z.string().max(120).optional(),
});
export type VentaVacacionesInput = z.infer<typeof ventaVacacionesSchema>;

export interface MovimientoVacacionalDto {
  id: string;
  tipo: 'DEVENGO' | 'GOCE' | 'VENTA' | 'TRUNCA_CESE' | 'AJUSTE';
  dias: string;
  fecha: string;
  glosa: string | null;
}

export interface PeriodoVacacionalDto {
  id: string;
  etiqueta: string;
  inicio: string;
  fin: string;
  diasDerecho: number;
  diasGozados: string;
  diasVendidos: string;
  /** derecho − gozados − vendidos */
  saldoPendiente: string;
  estado: EstadoPeriodoVacacional;
  /** Fecha en la que vence el derecho a gozarlo (1 año después del fin) */
  venceEl: string;
  /** Días que faltan para el vencimiento (negativo si ya venció) */
  diasParaVencer: number;
  indemnizacionPagada: boolean;
  movimientos: MovimientoVacacionalDto[];
}

export interface VentaVacacionesCuotaDto {
  id: string;
  numero: number;
  monto: string;
  anio: number;
  mes: number;
  pagadaEn: string | null;
}

export interface VentaVacacionesDto {
  id: string;
  periodoVacacionalEtiqueta: string;
  diasVendidos: string;
  montoTotal: string;
  saldoPorPagar: string;
  fechaAcuerdo: string;
  excedeLimiteLegal: boolean;
  cuotas: VentaVacacionesCuotaDto[];
}

export interface VacacionesPersonaDto {
  personaId: string;
  nombres: string;
  apellidos: string;
  numeroDocumento: string;
  regimenLaboral: RegimenLaboral;
  /** Gerente/representante que decide su descanso: no se indemniza (§8.3) */
  gerenteDecideVacaciones: boolean;
  /** Máximo de días vendibles según su régimen */
  maximoVenta: number;
  remuneracionComputable: string;
  periodos: PeriodoVacacionalDto[];
  ventas: VentaVacacionesDto[];
  saldoTotal: string;
  /** Saldo pendiente de pago de sus ventas fraccionadas */
  saldoVentasPorPagar: string;
  /** Indemnización si tiene periodos vencidos sin goce (0 si es gerente) */
  indemnizacionEstimada: string;
}

/** Respuesta de la venta: el override queda explícito */
export interface RespuestaVentaDto {
  venta: VentaVacacionesDto;
  advertencias: string[];
}

// =====================================================================
// Liquidación al cese (Sesión 14) — §8.4
// =====================================================================

export const motivoCeseSchema = z.enum([
  'RENUNCIA',
  'DESPIDO',
  'MUTUO_ACUERDO',
  'VENCIMIENTO_CONTRATO',
  'JUBILACION',
  'FALLECIMIENTO',
  'OTRO',
]);
export type MotivoCese = z.infer<typeof motivoCeseSchema>;

export const cesarPersonaSchema = z.object({
  fechaCese: z.iso.date(),
  motivoCese: motivoCeseSchema,
  observacion: z.string().max(200).optional(),
});
export type CesarPersonaInput = z.infer<typeof cesarPersonaSchema>;

export interface ConceptoLiquidacionDto {
  codigo: string;
  descripcion: string;
  tipo: 'INGRESO' | 'DESCUENTO';
  monto: string;
  detalle?: string;
}

export interface LiquidacionPreviewDto {
  personaId: string;
  nombres: string;
  apellidos: string;
  numeroDocumento: string;
  regimenLaboral: RegimenLaboral;
  fechaIngreso: string;
  fechaCese: string;
  motivoCese: string;
  /** "3 años, 5 meses y 12 días" */
  tiempoServicios: string;
  remuneracionComputable: string;
  conceptos: ConceptoLiquidacionDto[];
  subtotales: {
    vacacionesPendientes: string;
    indemnizacionVacacional: string;
    vacacionesTruncas: string;
    ctsTrunca: string;
    gratificacionTrunca: string;
    bonificacionGratificacion: string;
    saldosAFavor: string;
  };
  totalIngresos: string;
  totalDescuentos: string;
  netoPagar: string;
  /** Notas legales (microempresa sin CTS/grati, gerente sin indemnización…) */
  notas: string[];
  /** Advertencias para el contador (préstamo pendiente, periodo vencido…) */
  advertencias: string[];
  /** Ya fue emitida (no se puede volver a emitir) */
  yaEmitida: boolean;
}

export interface LiquidacionDto {
  id: string;
  personaId: string;
  fechaCese: string;
  motivoCese: string;
  vacacionesTruncas: string;
  ctsTrunca: string;
  gratiTrunca: string;
  otrosIngresos: string;
  descuentos: string;
  netoPagar: string;
  creadoEn: string;
}

// =====================================================================
// Utilidades (Sesión 15) — D.Leg. 892, §8.5
// =====================================================================

export const calcularUtilidadesSchema = z.object({
  ejercicio: z.number().int().min(2000).max(2100),
  /** Renta neta anual del ejercicio (debe ser positiva para que haya reparto) */
  rentaNeta: decimalStringSchema.refine(
    (v) => Number(v) > 0,
    'La renta neta debe ser mayor que cero',
  ),
});
export type CalcularUtilidadesInput = z.infer<typeof calcularUtilidadesSchema>;

export const registrarUtilidadesSchema = calcularUtilidadesSchema.extend({
  /** Vencimiento de la DJ anual + 30 días; editable si aún no se conoce el cronograma SUNAT */
  fechaLimitePago: z.iso.date().optional(),
  /** Periodo de planilla del mes de pago: el ingreso UTILIDADES se inyecta ahí */
  anioPago: z.number().int().min(2000).max(2100).optional(),
  mesPago: z.number().int().min(1).max(12).optional(),
  /** Registrar aunque el promedio no alcance el umbral (override informado del contador) */
  confirmarNoObligada: z.boolean().optional(),
});
export type RegistrarUtilidadesInput = z.infer<typeof registrarUtilidadesSchema>;

export interface ObligacionUtilidadesDto {
  ejercicio: number;
  obligada: boolean;
  /** Promedio exacto ("19.42"); el redondeado decide contra el umbral */
  promedioTrabajadores: string;
  promedioRedondeado: number;
  umbral: number;
  /** Conteo de trabajadores en planilla por mes (de los periodos cerrados) */
  trabajadoresPorMes: number[];
  regimenLaboral: RegimenLaboral;
  /** % del sector configurado en la empresa (null si falta configurarlo) */
  porcentajeSector: string | null;
  motivo: string;
}

export interface FilaUtilidadesDto {
  personaId: string;
  nombres: string;
  apellidos: string;
  numeroDocumento: string;
  /** Cesado del ejercicio: participa proporcionalmente (§8.5) */
  cesado: boolean;
  fechaCese: string | null;
  diasLaborados: number;
  remuneracionAnual: string;
  /** Remuneración mensual vigente (base del tope de 18) */
  remuneracionMensual: string;
  montoPorDias: string;
  montoPorRemuneracion: string;
  montoSinTope: string;
  tope: string;
  topeAplicado: boolean;
  excedenteFondoempleo: string;
  montoTotal: string;
}

export interface CalculoUtilidadesDto {
  ejercicio: number;
  rentaNeta: string;
  porcentajeSector: string;
  montoARepartir: string;
  totalDias: number;
  totalRemuneraciones: string;
  filas: FilaUtilidadesDto[];
  /** Suma de los montos individuales ya topados */
  totalRepartido: string;
  /** Excedente sobre topes individuales: va al Fondoempleo, no se redistribuye */
  excedenteFondoempleo: string;
  obligacion: ObligacionUtilidadesDto;
  yaRegistrada: boolean;
  advertencias: string[];
}

export interface UtilidadEjercicioDto {
  id: string;
  ejercicio: number;
  rentaNeta: string;
  porcentaje: string;
  montoARepartir: string;
  excedenteFondoempleo: string;
  promedioTrabajadores: string;
  fechaLimitePago: string | null;
  anioPago: number | null;
  mesPago: number | null;
  creadoEn: string;
  detalles: {
    id: string;
    personaId: string;
    nombres: string;
    apellidos: string;
    numeroDocumento: string;
    diasLaborados: number;
    remuneracionAnual: string;
    montoPorDias: string;
    montoPorRem: string;
    montoTotal: string;
    topeAplicado: boolean;
    excedenteFondoempleo: string;
    pagadaEn: string | null;
  }[];
}

// =====================================================================
// Préstamos y adelantos (Sesión 16) — §7.3.5
// =====================================================================

/** Monto positivo (> 0) como string decimal (reutilizable) */
export const montoPositivoStringSchema = decimalStringSchema.refine(
  (v) => Number(v) > 0,
  'El monto debe ser mayor que cero',
);

export const cuotaPrestamoInputSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12),
  monto: montoPositivoStringSchema,
});
export type CuotaPrestamoInput = z.infer<typeof cuotaPrestamoInputSchema>;

/**
 * Constructor de cronograma: cuota fija mensual (el sistema calcula el
 * número de cuotas y el residuo en la última — préstamo de Martín:
 * 390 en 15×25 + 15) o cronograma MANUAL editable (Bravo: 150/150/150/50).
 */
export const crearPrestamoSchema = z.object({
  monto: montoPositivoStringSchema,
  esAdelanto: z.boolean().default(false),
  fechaOtorgado: z.iso.date(),
  glosa: z.string().max(200).optional(),
  cronograma: z.discriminatedUnion('modo', [
    z.object({
      modo: z.literal('CUOTA_FIJA'),
      cuotaMensual: montoPositivoStringSchema,
      anioInicio: z.number().int().min(2000).max(2100),
      mesInicio: z.number().int().min(1).max(12),
    }),
    z.object({
      modo: z.literal('MANUAL'),
      cuotas: z.array(cuotaPrestamoInputSchema).min(1),
    }),
  ]),
});
export type CrearPrestamoInput = z.infer<typeof crearPrestamoSchema>;

/** Amortización extraordinaria: pago directo fuera de planilla (auditado) */
export const amortizarPrestamoSchema = z.object({
  monto: montoPositivoStringSchema,
  fecha: z.iso.date(),
  glosa: z.string().max(200).optional(),
});
export type AmortizarPrestamoInput = z.infer<typeof amortizarPrestamoSchema>;

export interface PrestamoCuotaDto {
  id: string;
  numero: number;
  anio: number;
  mes: number;
  monto: string;
  pagadaEn: string | null;
  /** Periodo de planilla donde se descontó (null si fue amortización directa) */
  periodoId: string | null;
}

export interface PrestamoDto {
  id: string;
  personaId: string;
  nombres: string;
  apellidos: string;
  numeroDocumento: string;
  esAdelanto: boolean;
  montoTotal: string;
  saldo: string;
  fechaOtorgado: string;
  estado: 'ACTIVO' | 'CANCELADO';
  glosa: string | null;
  cuotasPagadas: number;
  cuotasTotales: number;
  /** La próxima cuota pendiente agota el saldo (badge "se cancela este periodo") */
  seCancelaProximoPeriodo: boolean;
  cuotas: PrestamoCuotaDto[];
}

// =====================================================================
// Retenciones judiciales (Sesión 16) — §7.3.1
// =====================================================================

export const retencionJudicialSchema = z
  .object({
    expediente: z.string().min(1, 'Indica el expediente').max(60),
    juzgado: z.string().min(1, 'Indica el juzgado').max(120),
    beneficiario: z.string().min(1, 'Indica al beneficiario').max(120),
    bancoDeposito: z.string().max(60).optional(),
    cuentaDeposito: z.string().max(30).optional(),
    /** Porcentaje O monto fijo: excluyentes (uno y solo uno) */
    porcentaje: decimalStringSchema.optional(),
    montoFijo: montoPositivoStringSchema.optional(),
    vigenteDesde: z.iso.date(),
    vigenteHasta: z.iso.date().optional(),
  })
  .superRefine((v, ctx) => {
    const tienePorcentaje = v.porcentaje !== undefined;
    const tieneMontoFijo = v.montoFijo !== undefined;
    if (tienePorcentaje === tieneMontoFijo) {
      ctx.addIssue({
        code: 'custom',
        path: ['porcentaje'],
        message: 'Indica el porcentaje O el monto fijo (uno y solo uno)',
      });
    }
    // Embargo por alimentos: hasta el 60% de la remuneración (§7.3)
    if (tienePorcentaje && (Number(v.porcentaje) <= 0 || Number(v.porcentaje) > 0.6)) {
      ctx.addIssue({
        code: 'custom',
        path: ['porcentaje'],
        message: 'El porcentaje debe ser mayor que 0 y como máximo 0.60 (60% por alimentos)',
      });
    }
  });
export type RetencionJudicialInput = z.infer<typeof retencionJudicialSchema>;

export interface RetencionJudicialDto {
  id: string;
  personaId: string;
  expediente: string;
  juzgado: string;
  beneficiario: string;
  bancoDeposito: string | null;
  cuentaDeposito: string | null;
  porcentaje: string | null;
  montoFijo: string | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
  activa: boolean;
}

/** Fila del reporte mensual de depósitos judiciales (y del resumen de cierre) */
export interface RetencionJudicialAplicadaDto {
  personaId: string;
  nombres: string;
  apellidos: string;
  numeroDocumento: string;
  expediente: string;
  juzgado: string;
  beneficiario: string;
  bancoDeposito: string | null;
  cuentaDeposito: string | null;
  monto: string;
}

export interface ReporteJudicialDto {
  anio: number;
  mes: number;
  filas: RetencionJudicialAplicadaDto[];
  total: string;
}

// =====================================================================
// Honorarios — locadores 4ta (Sesión 16) — §5.3
// =====================================================================

export const crearReciboSchema = z.object({
  numero: z.string().min(1, 'Indica el número del recibo').max(20),
  fechaEmision: z.iso.date(),
  monto: montoPositivoStringSchema,
  glosa: z.string().max(200).optional(),
});
export type CrearReciboInput = z.infer<typeof crearReciboSchema>;

export interface ReciboHonorarioDto {
  id: string;
  personaId: string;
  numero: string;
  fechaEmision: string;
  monto: string;
  retencion8: string;
  netoPagado: string;
  glosa: string | null;
}

export interface RespuestaReciboDto {
  recibo: ReciboHonorarioDto;
  /** No bloqueantes: "la suspensión venció el 31/12/XXXX — se aplicará retención" */
  advertencias: string[];
}

export interface LocadorMesDto {
  personaId: string;
  nombres: string;
  apellidos: string;
  numeroDocumento: string;
  rucLocador: string | null;
  suspensionVigente: boolean;
  suspensionVigenteHasta: string | null;
  recibos: ReciboHonorarioDto[];
  totalMonto: string;
  totalRetencion: string;
  totalNeto: string;
}

/** Tabla mensual de /honorarios (insumo del resumen para PLAME) */
export interface HonorariosMesDto {
  anio: number;
  mes: number;
  filas: LocadorMesDto[];
  totalMonto: string;
  totalRetencion: string;
  totalNeto: string;
}

/** Reporte anual por locador: total pagado y retenido del año */
export interface HonorariosAnualDto {
  anio: number;
  filas: {
    personaId: string;
    nombres: string;
    apellidos: string;
    rucLocador: string | null;
    cantidadRecibos: number;
    totalMonto: string;
    totalRetencion: string;
    totalNeto: string;
  }[];
  totalMonto: string;
  totalRetencion: string;
  totalNeto: string;
}

// =====================================================================
// Subvenciones de practicantes (Sesión 16) — §5.4, Ley 28518
// =====================================================================

export const registrarSubvencionSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12),
  diasDescontados: z.number().int().min(0).max(30).optional(),
  /**
   * La MEDIA SUBVENCIÓN del semestre cumplido la propone el sistema y la
   * CONFIRMA el contador: solo se paga si llega en true.
   */
  incluirMediaSubvencion: z.boolean().optional(),
  glosa: z.string().max(200).optional(),
});
export type RegistrarSubvencionInput = z.infer<typeof registrarSubvencionSchema>;

export interface SubvencionDto {
  id: string;
  personaId: string;
  anio: number;
  mes: number;
  diasDescontados: number;
  montoBase: string;
  mediaSubvencion: string;
  total: string;
  glosa: string | null;
  creadoEn: string;
}

export interface PracticanteMesDto {
  personaId: string;
  nombres: string;
  apellidos: string;
  numeroDocumento: string;
  subvencionMensual: string;
  convenioInicio: string | null;
  convenioFin: string | null;
  /** Meses continuos de convenio cumplidos al fin del mes consultado */
  mesesCumplidos: number;
  /** Este mes se cumple un semestre: el sistema PROPONE la media subvención */
  proponeMediaSubvencion: boolean;
  mediaSubvencionMonto: string;
  pago: SubvencionDto | null;
}

export interface SubvencionesMesDto {
  anio: number;
  mes: number;
  filas: PracticanteMesDto[];
  totalPagado: string;
}

// =====================================================================
// Contratos y convenios (Sesión 17) — CLAUDE.md § Grupo 9
// =====================================================================

export const tipoContratoSchema = z.enum([
  'INDETERMINADO',
  'PLAZO_FIJO',
  'PART_TIME',
  'CONVENIO_PRACTICAS',
]);
export type TipoContrato = z.infer<typeof tipoContratoSchema>;

/**
 * Modalidad contractual exacta que se declara en el T-Registro (S20). Son
 * las modalidades del TUO de la Ley de Productividad y Competitividad
 * Laboral (D.S. 003-97-TR, arts. 53-83) más el plazo indeterminado y el
 * convenio de modalidad formativa (Ley 28518). La contadora usa hoy
 * INDETERMINADO y NECESIDAD_DE_MERCADO; el catálogo completo queda
 * disponible para los demás estudios.
 * NOTA: son las denominaciones legales, no los códigos numéricos de las
 * tablas SUNAT (esos se agregan cuando se validen con el portal).
 */
export const MODALIDADES_CONTRATO: {
  codigo: string;
  etiqueta: string;
  tipo: TipoContrato;
}[] = [
  { codigo: 'INDETERMINADO', etiqueta: 'Plazo indeterminado', tipo: 'INDETERMINADO' },
  { codigo: 'NECESIDAD_DE_MERCADO', etiqueta: 'Por necesidad de mercado', tipo: 'PLAZO_FIJO' },
  {
    codigo: 'INICIO_INCREMENTO_ACTIVIDAD',
    etiqueta: 'Por inicio o incremento de actividad',
    tipo: 'PLAZO_FIJO',
  },
  { codigo: 'RECONVERSION_EMPRESARIAL', etiqueta: 'Por reconversión empresarial', tipo: 'PLAZO_FIJO' },
  { codigo: 'OCASIONAL', etiqueta: 'Ocasional', tipo: 'PLAZO_FIJO' },
  { codigo: 'SUPLENCIA', etiqueta: 'De suplencia', tipo: 'PLAZO_FIJO' },
  { codigo: 'EMERGENCIA', etiqueta: 'De emergencia', tipo: 'PLAZO_FIJO' },
  {
    codigo: 'OBRA_O_SERVICIO',
    etiqueta: 'Para obra determinada o servicio específico',
    tipo: 'PLAZO_FIJO',
  },
  { codigo: 'INTERMITENTE', etiqueta: 'Intermitente', tipo: 'PLAZO_FIJO' },
  { codigo: 'TEMPORADA', etiqueta: 'De temporada', tipo: 'PLAZO_FIJO' },
  { codigo: 'TIEMPO_PARCIAL', etiqueta: 'A tiempo parcial (part time)', tipo: 'PART_TIME' },
  {
    codigo: 'CONVENIO_MODALIDAD_FORMATIVA',
    etiqueta: 'Convenio de modalidad formativa (Ley 28518)',
    tipo: 'CONVENIO_PRACTICAS',
  },
];

export const modalidadContratoSchema = z.enum(
  MODALIDADES_CONTRATO.map((m) => m.codigo) as [string, ...string[]],
);

/**
 * Modalidad implícita de un tipo de contrato cuando es unívoca
 * (indeterminado, part time, convenio formativo). El plazo fijo tiene
 * varias modalidades, así que devuelve null: la elige el contador.
 */
export function modalidadPorDefecto(tipo: TipoContrato): string | null {
  const candidatas = MODALIDADES_CONTRATO.filter((m) => m.tipo === tipo);
  return candidatas.length === 1 ? candidatas[0].codigo : null;
}

export function etiquetaModalidadContrato(codigo: string | null): string | null {
  if (!codigo) {
    return null;
  }
  return MODALIDADES_CONTRATO.find((m) => m.codigo === codigo)?.etiqueta ?? codigo;
}

/**
 * Estado calculado del contrato: VIGENTE / POR_VENCER (fin en <30 días) /
 * VENCIDO (fin pasado SIN renovación) / SIN_FIN (indeterminado) /
 * RENOVADO (tiene un contrato sucesor: ya no vence ni alerta).
 */
export type EstadoContrato =
  | 'VIGENTE'
  | 'POR_VENCER'
  | 'VENCIDO'
  | 'SIN_FIN'
  | 'RENOVADO';

/**
 * Variables disponibles en las plantillas ({{variable}}); la lista se
 * muestra en el editor. El contenido es MARKDOWN LIGERO: `#`/`##` para
 * títulos, `**negrita**` y `- ` para listas (decisión S17: es el formato
 * más simple que cubre títulos, negritas y listas, y se edita en un
 * textarea sin dependencias).
 */
export const VARIABLES_CONTRATO: { variable: string; descripcion: string }[] = [
  { variable: 'nombres', descripcion: 'Nombres del trabajador/practicante' },
  { variable: 'apellidos', descripcion: 'Apellidos' },
  { variable: 'tipoDocumento', descripcion: 'DNI / CE / Pasaporte' },
  { variable: 'numeroDocumento', descripcion: 'Número de documento' },
  { variable: 'direccion', descripcion: 'Domicilio de la persona' },
  { variable: 'cargo', descripcion: 'Cargo o puesto' },
  {
    variable: 'sueldoBasico',
    descripcion:
      'Remuneración en números Y letras: "S/ 2,500.00 (DOS MIL QUINIENTOS Y 00/100 SOLES)". En practicantes usa la subvención mensual.',
  },
  { variable: 'fechaInicio', descripcion: 'Inicio del contrato (dd/mm/aaaa)' },
  { variable: 'fechaFin', descripcion: 'Fin del contrato (dd/mm/aaaa; vacío si es indeterminado)' },
  { variable: 'empresaRazonSocial', descripcion: 'Razón social de la empresa' },
  { variable: 'empresaRuc', descripcion: 'RUC de la empresa' },
  { variable: 'empresaDireccion', descripcion: 'Domicilio fiscal de la empresa' },
  { variable: 'fechaHoy', descripcion: 'Fecha de generación en letras: "17 de julio de 2026"' },
];

export const plantillaContratoInputSchema = z.object({
  nombre: z.string().min(1, 'Indica el nombre de la plantilla').max(120),
  contenido: z.string().min(1, 'La plantilla no puede estar vacía').max(30000),
  activo: z.boolean().optional(),
});
export type PlantillaContratoInput = z.infer<typeof plantillaContratoInputSchema>;

export interface PlantillaContratoDto {
  id: string;
  empresaId: string;
  nombre: string;
  contenido: string;
  activo: boolean;
  actualizadoEn: string;
}

export const crearContratoSchema = z
  .object({
    plantillaId: z.uuid().optional(),
    tipo: tipoContratoSchema,
    /** Modalidad exacta para el T-Registro (catálogo MODALIDADES_CONTRATO) */
    modalidad: modalidadContratoSchema.optional(),
    inicio: z.iso.date(),
    fin: z.iso.date().optional(),
    /** Datos adicionales: variables extra {{clave}} propias de la plantilla */
    datos: z.record(z.string().max(60), z.string().max(500)).optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.tipo === 'PLAZO_FIJO' || v.tipo === 'CONVENIO_PRACTICAS') && !v.fin) {
      ctx.addIssue({
        code: 'custom',
        path: ['fin'],
        message: 'La fecha de fin es obligatoria en plazo fijo y convenios de prácticas',
      });
    }
    if (v.fin && v.fin <= v.inicio) {
      ctx.addIssue({
        code: 'custom',
        path: ['fin'],
        message: 'La fecha de fin debe ser posterior al inicio',
      });
    }
  });
export type CrearContratoInput = z.infer<typeof crearContratoSchema>;

export const renovarContratoSchema = z
  .object({
    nuevoInicio: z.iso.date(),
    nuevoFin: z.iso.date(),
  })
  .refine((v) => v.nuevoFin > v.nuevoInicio, {
    path: ['nuevoFin'],
    message: 'La fecha de fin debe ser posterior al inicio',
  });
export type RenovarContratoInput = z.infer<typeof renovarContratoSchema>;

export interface ContratoDto {
  id: string;
  personaId: string;
  nombres: string;
  apellidos: string;
  numeroDocumento: string;
  tipoVinculo: TipoVinculo;
  plantillaId: string | null;
  plantillaNombre: string | null;
  tipo: TipoContrato;
  /** Modalidad declarada en el T-Registro (null = se usa el tipo) */
  modalidad: string | null;
  inicio: string;
  fin: string | null;
  renovadoDe: string | null;
  estado: EstadoContrato;
  /** Hay contenido congelado: el PDF se puede generar */
  pdfDisponible: boolean;
  creadoEn: string;
}

export interface RespuestaContratoDto {
  contrato: ContratoDto;
  /** No bloqueantes: variables sin valor, cadena de plazo fijo > 5 años, etc. */
  advertencias: string[];
}

/** Insumo del motor de alertas de la S22 (umbrales 30/15/5 sobre porVencer) */
export interface VencimientosContratosDto {
  porVencer: ContratoDto[];
  vencidos: ContratoDto[];
}

// =====================================================================
// Reportes y documentos (Sesión 18) — boletas, telecrédito, resumen de
// aportes y comparativo mensual.
//
// El ENVÍO de boletas por correo se retiró del alcance (S24): Planix las
// genera y las descarga, y la contadora las manda desde su propia
// cuenta. Con él se fueron sus DTOs de estado y constancia.
// =====================================================================

/** Bancos con adaptador de telecrédito (strategy; BCP primero) */
export const bancoTelecreditoSchema = z.enum(['BCP']);
export type BancoTelecredito = z.infer<typeof bancoTelecreditoSchema>;

/** Resumen de tributos y aportes del periodo (insumo del asiento y las declaraciones) */
export interface ResumenAportesDto {
  periodoId: string;
  anio: number;
  mes: number;
  tipo: TipoPeriodo;
  totalOnp: string;
  /** AFP por administradora (para AFPnet): fondo + prima + comisión */
  afps: {
    administradora: string;
    fondo: string;
    prima: string;
    comision: string;
    total: string;
  }[];
  totalAfp: string;
  totalEssalud: string;
  totalCreditoEps: string;
  totalRenta5ta: string;
  /** Retenciones judiciales por beneficiario (depósito manual) */
  judiciales: RetencionJudicialAplicadaDto[];
  totalJudiciales: string;
  totalSctrSalud: string;
  totalSctrPension: string;
  totalVidaLey: string;
  totalSenati: string;
  /**
   * Aviso para la PANTALLA cuando el periodo se cerró antes de que el
   * cierre guardara las tasas de empresa (S24), y por eso sus aportes
   * salen en la boleta sin porcentaje. `null` cuando no aplica.
   *
   * Va en la pantalla y NO en el PDF a propósito: el PDF es el documento
   * que firma el trabajador y no debe llevar notas sobre nuestras
   * versiones. Mismo criterio que las `omisiones` del PLAME — se avisa
   * antes de descargar.
   */
  avisoTasasEmpresa: string | null;
}

export interface FilaTelecreditoDto {
  personaId: string;
  nombres: string;
  apellidos: string;
  numeroDocumento: string;
  banco: string | null;
  cuenta: string | null;
  neto: string;
}

/** Resumen del archivo de pago de haberes (la descarga TXT va aparte) */
export interface ResumenTelecreditoDto {
  banco: BancoTelecredito;
  incluidos: FilaTelecreditoDto[];
  totalIncluido: string;
  /** Otros bancos o sin cuenta HABERES: pago manual */
  pagoManual: FilaTelecreditoDto[];
  totalPagoManual: string;
}

export interface MesComparativoDto {
  anio: number;
  mes: number;
  /** Costo laboral = ingresos + aportes del empleador (periodos CERRADOS del mes) */
  costoLaboral: string;
  netoPagado: string;
  horasExtras: string;
  headcount: number;
  /** Variación % del costo laboral vs el mes anterior (null en el primero) */
  variacionPorcentaje: string | null;
}

export interface VariacionTrabajadorDto {
  personaId: string;
  nombres: string;
  apellidos: string;
  netoAnterior: string;
  netoActual: string;
  variacion: string;
  variacionPorcentaje: string | null;
}

export interface ComparativoMensualDto {
  empresaId: string;
  meses: MesComparativoDto[];
  /** Top 5 por variación absoluta de neto: último mes cerrado vs anterior */
  variacionesTrabajador: VariacionTrabajadorDto[];
  /** Umbral de alerta visual de variación (0.15 = 15%) */
  umbralAlerta: string;
}

// =====================================================================
// SESIÓN 19 — Asientos contables: plan de cuentas PCGE, plantillas de
// mapeo concepto→cuentas y asientos con exportadores
// =====================================================================

export const formatoExportAsientoSchema = z.enum([
  'EXCEL_GENERICO',
  'CONCAR',
  'CSV',
]);
export type FormatoExportAsiento = z.infer<typeof formatoExportAsientoSchema>;

export const origenAsientoSchema = z.enum([
  'PLANILLA',
  'CTS_PROVISION',
  'CTS_DEPOSITO',
  'GRATIFICACION',
  'LIQUIDACION',
  'UTILIDADES',
]);
export type OrigenAsiento = z.infer<typeof origenAsientoSchema>;

/** Cuenta del plan contable de la empresa (PCGE, editable) */
export const cuentaContableInputSchema = z.object({
  codigo: z
    .string()
    .regex(/^\d{2,8}$/, 'El código PCGE son de 2 a 8 dígitos'),
  nombre: z.string().min(3).max(120),
});
export type CuentaContableInput = z.infer<typeof cuentaContableInputSchema>;

export const cuentaContableUpdateSchema = z.object({
  nombre: z.string().min(3).max(120).optional(),
  activa: z.boolean().optional(),
});
export type CuentaContableUpdate = z.infer<typeof cuentaContableUpdateSchema>;

export interface CuentaContableDto {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
}

/** Tipo de comprobante del asiento CONCAR (S20): propio / SUNAT / banco-AFP */
export const tipoComprobanteAsientoSchema = z.enum(['S', 'T', 'B']);
export type TipoComprobanteAsiento = z.infer<typeof tipoComprobanteAsientoSchema>;

const cuentaContableCodigoSchema = z.string().regex(/^\d{2,10}$/);

/** Un mapeo concepto → cuentas (lado ausente = null; aportes llevan ambos) */
export const mapeoAsientoSchema = z.object({
  concepto: z.string().min(2).max(40),
  cuentaCargo: cuentaContableCodigoSchema.nullable(),
  cuentaAbono: cuentaContableCodigoSchema.nullable(),
  /** Cuentas alternativas de OBRERO/operarios (S20): null = misma cuenta */
  cuentaCargoObrero: cuentaContableCodigoSchema.nullable().optional(),
  cuentaAbonoObrero: cuentaContableCodigoSchema.nullable().optional(),
  centroCosto: cuentaContableCodigoSchema.nullable(),
  auxiliarPorTrabajador: z.boolean(),
  /** Datos del tercero para el CONCAR real (S20) */
  tipoComprobante: tipoComprobanteAsientoSchema.nullable().optional(),
  rucTercero: z.string().max(11).nullable().optional(),
  razonSocialTercero: z.string().max(150).nullable().optional(),
});
export type MapeoAsientoInput = z.infer<typeof mapeoAsientoSchema>;

/** Guardado de la configuración de asientos de la empresa (pantalla única) */
export const configAsientosGuardarSchema = z.object({
  generarAsientoDestino: z.boolean(),
  mapeos: z.array(mapeoAsientoSchema).min(1),
});
export type ConfigAsientosGuardar = z.infer<typeof configAsientosGuardarSchema>;

export interface PlantillaAsientoDto {
  concepto: string;
  /** Nombre legible del concepto ("AFP (fondo + prima + comisión)") */
  etiqueta: string;
  cuentaCargo: string | null;
  cuentaAbono: string | null;
  cuentaCargoObrero: string | null;
  cuentaAbonoObrero: string | null;
  centroCosto: string | null;
  auxiliarPorTrabajador: boolean;
  tipoComprobante: TipoComprobanteAsiento | null;
  rucTercero: string | null;
  razonSocialTercero: string | null;
}

export interface ConfigAsientosDto {
  generarAsientoDestino: boolean;
  mapeos: PlantillaAsientoDto[];
}

/** Generación de asientos de beneficios ya registrados */
export const asientoCtsInputSchema = z.object({
  semestre: z.string().min(6).max(20), // "NOV2025-ABR2026"
  tipo: z.enum(['PROVISION', 'DEPOSITO']),
});
export type AsientoCtsInput = z.infer<typeof asientoCtsInputSchema>;

export const asientoGratificacionInputSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  mes: z.union([z.literal(7), z.literal(12)]),
});
export type AsientoGratificacionInput = z.infer<
  typeof asientoGratificacionInputSchema
>;

export const asientoUtilidadesInputSchema = z.object({
  ejercicio: z.number().int().min(2000).max(2100),
});
export type AsientoUtilidadesInput = z.infer<typeof asientoUtilidadesInputSchema>;

export interface AsientoLineaDto {
  cuenta: string;
  cuentaNombre: string | null;
  auxiliar: string | null;
  glosa: string | null;
  debe: string;
  haber: string;
  centroCosto: string | null;
  /** Datos del comprobante del formato CONCAR real (S20, CASO 13) */
  tipoComprobante: TipoComprobanteAsiento | null;
  codigoComprobante: string | null;
  razonSocial: string | null;
}

export interface AsientoResumenDto {
  id: string;
  origen: OrigenAsiento;
  origenRef: string;
  glosa: string;
  fecha: string; // dd/mm/aaaa
  totalDebe: string;
  totalHaber: string;
  exportadoEn: string | null;
  formatoExport: FormatoExportAsiento | null;
  periodoId: string | null;
}

export interface AsientoDto extends AsientoResumenDto {
  lineas: AsientoLineaDto[];
}

// =====================================================================
// Declaraciones: AFPnet, PLAME y T-Registro (Sesión 20) — CLAUDE.md §9
// Estructuras del CASO 13 de docs/FIXTURES_EXCEL.md (archivos reales del
// estudio). El T-Registro y el PLAME NO generan archivo de importación:
// la contadora los sube/digita a mano, así que el sistema entrega el
// insumo ordenado (pantalla + Excel).
// =====================================================================

/** Formatos que acepta el portal AFPnet para la carga del archivo */
export const formatoAfpnetSchema = z.enum(['EXCEL', 'TXT']);
export type FormatoAfpnet = z.infer<typeof formatoAfpnetSchema>;

/**
 * Códigos de excepción de aporte del AFPnet (col. 10 del archivo real):
 * "O" jubilado/pensionista que ya no aporta, "P" suspensión perfecta de
 * labores, "L" licencia sin goce, vacío = aporta normal.
 */
export type ExcepcionAfpnet = 'O' | 'P' | 'L' | '';

/** Una fila del archivo AFPnet (17 columnas, sin encabezados) */
export interface FilaAfpnetDto {
  secuencia: number;
  cuspp: string;
  /** 0 = DNI, 1 = CE, 4 = Pasaporte, 6 = PTP */
  tipoDocumento: string;
  numeroDocumento: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombres: string;
  /** S/N — hubo relación laboral en el mes */
  relacionLaboral: 'S' | 'N';
  /** S/N — la relación laboral INICIÓ en el periodo */
  inicioRelacion: 'S' | 'N';
  /** S/N — la relación laboral CESÓ en el periodo */
  ceseRelacion: 'S' | 'N';
  excepcion: ExcepcionAfpnet;
  /** Remuneración asegurable: la misma base afecta del fondo AFP */
  remuneracionAsegurable: string;
  aporteVoluntario1: string;
  aporteVoluntario2: string;
  aporteVoluntario3: string;
  /** N = normal, C = construcción, M = minería, P = pesquero */
  tipoTrabajo: string;
  /** Se envía vacío: el portal determina la AFP por el CUSPP */
  afp: string;
  // --- Contexto para la pantalla (no va en el archivo) ---
  administradora: AfpAdministradora | null;
  esJubilado: boolean;
}

export interface ResumenAfpnetDto {
  periodoId: string;
  anio: number;
  mes: number;
  tipo: TipoPeriodo;
  filas: FilaAfpnetDto[];
  /** Suma de las remuneraciones asegurables del archivo */
  totalRemuneracionAsegurable: string;
  /** Trabajadores del periodo que NO van al archivo (ONP y jubilados ONP) */
  excluidos: {
    personaId: string;
    nombres: string;
    apellidos: string;
    numeroDocumento: string;
    motivo: string;
  }[];
}

// ------------------------- Resumen PLAME -------------------------

/** Concepto del PLAME con su monto del periodo (ingreso/descuento/tributo) */
export interface ConceptoPlameDto {
  codigo: string;
  nombre: string;
  tipo: 'INGRESO' | 'DESCUENTO' | 'APORTE_EMPLEADOR';
  monto: string;
  /**
   * Código de la T22 que eligió el contador (S23.7). Solo lo llevan los
   * conceptos que el sistema no puede clasificar solo; para el resto, el
   * código sale del mapeo fijo.
   */
  codigoT22?: string | null;
}

export interface FilaPlameDto {
  personaId: string;
  tipoDocumento: string;
  numeroDocumento: string;
  apellidos: string;
  nombres: string;
  fechaNacimiento: string | null;
  nacionalidad: string;
  /** Trabajador / pensionista / practicante — según el vínculo y su régimen */
  tipoTrabajador: string;
  regimenLaboral: string;
  regimenPensionario: string;
  /**
   * Si ese régimen es el Sistema Privado de Pensiones. Va aparte de la
   * etiqueta porque la etiqueta es para leer ("AFP INTEGRA", "Jubilado
   * ONP (sin aporte)") y esto decide qué se declara: la nota al pie de
   * la E18 del Anexo 3 condiciona los códigos 0601/0606/0608/0609 al
   * SPP, y adivinarlo del texto sería frágil.
   */
  enSpp: boolean;
  cuspp: string | null;
  regimenSalud: string;
  situacion: string;
  ocupacion: string | null;
  fechaIngreso: string;
  fechaCese: string | null;
  /** Días efectivamente laborados del periodo */
  diasLaborados: number;
  /** Días subsidiados (CITT / maternidad) */
  diasSubsidiados: number;
  /** Días no laborados ni subsidiados (faltas, licencias sin goce) */
  diasNoLaborados: number;
  /** Horas y minutos de jornada ordinaria del periodo */
  horasOrdinarias: number;
  minutosOrdinarios: number;
  /** Horas extras declarables (25% + 35%) */
  horasExtras: number;
  conceptos: ConceptoPlameDto[];
  totalIngresos: string;
  totalDescuentos: string;
  totalAportesEmpleador: string;
  netoPagar: string;
}

export interface ResumenPlameDto {
  periodoId: string;
  anio: number;
  mes: number;
  tipo: TipoPeriodo;
  empresa: { ruc: string; razonSocial: string };
  filas: FilaPlameDto[];
  /** Totales por concepto para cuadrar con el PDT */
  totalesPorConcepto: ConceptoPlameDto[];
  /**
   * Aviso obligatorio en pantalla y en el Excel: el archivo .txt de
   * importación del PLAME queda pendiente de validación con las tablas de
   * códigos oficiales de SUNAT.
   */
  avisoArchivoImportacion: string;
}

// ------------------------- Catálogo de la tabla 22 -------------------------

export interface ConceptoT22Dto {
  id: string;
  codigo: string;
  descripcion: string;
  tipo: 'INGRESO' | 'DESCUENTO';
  essalud: boolean;
  snp: boolean;
  spp: boolean;
  renta5ta: boolean;
  activo: boolean;
  /** Afecto a EsSalud o a cualquiera de las pensiones. */
  afecto: boolean;
}

export const conceptoT22Schema = z.object({
  codigo: z.string().regex(/^\d{3,4}$/, 'El código de la T22 tiene 3 o 4 dígitos'),
  descripcion: z.string().min(3).max(200),
  tipo: z.enum(['INGRESO', 'DESCUENTO']),
  essalud: z.boolean().default(false),
  snp: z.boolean().default(false),
  spp: z.boolean().default(false),
  renta5ta: z.boolean().default(false),
  activo: z.boolean().default(true),
});
export type ConceptoT22Input = z.infer<typeof conceptoT22Schema>;

// ------------------------- Archivos .txt del PLAME -------------------------

/**
 * Las TRES estructuras del Anexo 3 que Planix genera. Eran cuatro
 * contra la Ver1.2: la E15 `.sub` y la E16 `.not` se fusionaron en la
 * E15 `.snl` de la versión JUL2023, y la E16 desapareció del Anexo.
 */
export const ESTRUCTURAS_PLAME = ['jor', 'snl', 'rem'] as const;
export type EstructuraPlame = (typeof ESTRUCTURAS_PLAME)[number];

export const estructuraPlameSchema = z.enum(ESTRUCTURAS_PLAME);

export interface ArchivoPlameDto {
  estructura: EstructuraPlame;
  /** E14, E15 o E18: como los nombra el Anexo 3. */
  codigoAnexo: string;
  nombreArchivo: string;
  titulo: string;
  /** Qué lleva y para qué sirve, en una frase. */
  descripcion: string;
  lineas: number;
  /** Primeras líneas, para que el contador vea qué va a descargar. */
  muestra: string[];
}

/** Una línea que NO se pudo declarar, con el motivo en lenguaje llano. */
export interface OmisionPlameDto {
  concepto: string;
  motivo: string;
  /** Qué tiene que hacer el contador con ella en el PDT. */
  queHacer: string;
}

export interface ArchivosPlameDto {
  periodoId: string;
  anio: number;
  mes: number;
  empresa: { ruc: string; razonSocial: string };
  archivos: ArchivoPlameDto[];
  omisiones: OmisionPlameDto[];
  /**
   * Aviso OBLIGATORIO en pantalla: las estructuras siguen el Anexo 3
   * pero ningún archivo se ha importado todavía en el PDT real.
   */
  avisoVerificacion: string;
}

// ------------------------- T-Registro -------------------------

export const movimientoTRegistroSchema = z.enum(['ALTAS', 'BAJAS']);
export type MovimientoTRegistro = z.infer<typeof movimientoTRegistroSchema>;

export const rangoFechasQuerySchema = z
  .object({
    desde: z.iso.date(),
    hasta: z.iso.date(),
  })
  .refine((v) => v.hasta >= v.desde, {
    path: ['hasta'],
    message: 'La fecha final no puede ser anterior a la inicial',
  });
export type RangoFechasQuery = z.infer<typeof rangoFechasQuerySchema>;

/** Fila del reporte T-Registro: los campos que pide el portal, en orden */
export interface FilaTRegistroDto {
  personaId: string;
  tipoDocumento: string;
  numeroDocumento: string;
  apellidos: string;
  nombres: string;
  fechaNacimiento: string | null;
  nacionalidad: string;
  sexo: string | null;
  tipoTrabajador: string;
  regimenLaboral: string;
  regimenPensionario: string;
  cuspp: string | null;
  regimenSalud: string;
  ocupacion: string | null;
  periodicidadPago: string | null;
  /** Alta: fecha de ingreso · Baja: fecha de cese */
  fechaMovimiento: string;
  fechaIngreso: string;
  fechaCese: string | null;
  motivoCese: string | null;
  tipoContrato: string;
  /** Vigencia del contrato registrado (si tiene uno) */
  contratoInicio: string | null;
  contratoFin: string | null;
  remuneracion: string | null;
  /** Datos que faltan para completar el alta en el portal */
  faltantes: string[];
}

export interface ReporteTRegistroDto {
  empresa: { ruc: string; razonSocial: string };
  movimiento: MovimientoTRegistro;
  desde: string;
  hasta: string;
  filas: FilaTRegistroDto[];
  /** El portal no acepta carga masiva del estudio: se declara uno por uno */
  aviso: string;
}

// =====================================================================
// Billing — Mercado Pago Suscripciones (Sesión 21) — CLAUDE.md §11
// La suscripción bloquea ESCRITURA, jamás LECTURA (§4.9): los datos son
// del contador siempre.
// =====================================================================

export const estadoSuscripcionSchema = z.enum([
  'TRIAL',
  'ACTIVE',
  'PAST_DUE',
  'SUSPENDED',
  'CANCELED',
  'COMPLIMENTARY',
]);
export type EstadoSuscripcion = z.infer<typeof estadoSuscripcionSchema>;

export const codigoPlanSchema = z.enum([
  'TRIAL',
  'BASICO',
  'PROFESIONAL',
  'ILIMITADO',
]);
export type CodigoPlan = z.infer<typeof codigoPlanSchema>;

/** Estados que PERMITEN escritura (§4.9: la lectura nunca se bloquea) */
export const ESTADOS_CON_ESCRITURA: readonly EstadoSuscripcion[] = [
  'TRIAL',
  'ACTIVE',
  'PAST_DUE', // periodo de gracia: MP reintenta el cobro
  'COMPLIMENTARY',
];

export function permiteEscritura(estado: EstadoSuscripcion): boolean {
  return ESTADOS_CON_ESCRITURA.includes(estado);
}

/** Estados sin límites de plan: cortesía, ilimitado y el trial de 30 días */
export function tieneLimites(
  estado: EstadoSuscripcion,
  codigoPlan: string,
): boolean {
  return (
    estado !== 'COMPLIMENTARY' &&
    estado !== 'TRIAL' &&
    codigoPlan !== 'ILIMITADO' &&
    codigoPlan !== 'TRIAL'
  );
}

export interface PlanDto {
  id: string;
  codigo: CodigoPlan;
  nombre: string;
  /** Monto con 2 decimales, en soles ("79.00") */
  precio: string;
  moneda: 'PEN' | 'USD';
  frecuencia: 'MENSUAL' | 'ANUAL';
  maxEmpresas: number | null;
  maxTrabajadores: number | null;
  /** Usuarios incluidos en el plan; no se cobran aparte (S23.5). */
  maxUsuarios: number | null;
  /** Descripción corta de los límites para las cards de la UI */
  descripcion: string;
}

export interface PagoDto {
  id: string;
  mpPaymentId: string;
  monto: string;
  moneda: 'PEN' | 'USD';
  estado: string; // approved | rejected | ... (estado tal cual de MP)
  fechaPago: string; // dd/mm/aaaa
}

export interface UsoPlanDto {
  empresas: number;
  trabajadores: number;
  /** Usuarios activos MÁS invitaciones vivas: lo que ocupa plaza (S23.5). */
  usuarios: number;
  maxEmpresas: number | null;
  maxTrabajadores: number | null;
  maxUsuarios: number | null;
}

export interface SuscripcionDto {
  estado: EstadoSuscripcion;
  /** Plan EFECTIVO: el que otorga los límites de `uso`. */
  plan: PlanDto | null;
  /**
   * Plan elegido en el checkout que Mercado Pago todavía no confirmó. No
   * otorga límites: hasta que llega el webhook, el plan vigente es `plan`.
   */
  planPendiente: PlanDto | null;
  /** Días que faltan para que termine el trial (0 si ya venció o no aplica) */
  diasTrialRestantes: number;
  trialFin: string | null; // dd/mm/aaaa
  vigenteHasta: string | null; // dd/mm/aaaa
  canceladaEn: string | null;
  /** false → los POST/PUT/PATCH/DELETE de negocio responden 402 */
  puedeEscribir: boolean;
  uso: UsoPlanDto;
  /** Últimos pagos registrados por el webhook (más recientes primero) */
  pagos: PagoDto[];
  /** Texto del banner global; null cuando no hay nada que avisar */
  banner: string | null;
}

export const suscribirSchema = z.object({
  planId: z.uuid('Plan inválido'),
});
export type SuscribirInput = z.infer<typeof suscribirSchema>;

export interface SuscribirRespuestaDto {
  /** URL del checkout de Mercado Pago a la que redirige el frontend */
  initPoint: string;
  preapprovalId: string;
}

/** Cuerpo del 402 de gating: la UI lo muestra y ofrece el CTA */
export interface BloqueoSuscripcionDto {
  mensaje: string;
  accion: string;
}

// ------------------------- Panel de superadmin -------------------------

export interface AdminTenantDto {
  id: string;
  nombre: string;
  ruc: string | null;
  estado: EstadoSuscripcion | null;
  plan: string | null;
  creadoEn: string; // dd/mm/aaaa
  trialFin: string | null;
  vigenteHasta: string | null;
  empresas: number;
  trabajadores: number;
}

// =====================================================================
// SESIÓN 22 — ALERTAS, CALENDARIO SUNAT Y TASAS SBS (CLAUDE.md §10)
// =====================================================================

export const tipoAlertaSchema = z.enum([
  'CONTRATO_POR_VENCER',
  'CTS_POR_DEPOSITAR',
  'GRATIFICACION_POR_PAGAR',
  'VENCIMIENTO_SUNAT',
  'PRESTAMO_POR_CANCELAR',
  'SUSPENSION_4TA_CADUCA',
  'VACACIONES_POR_VENCER',
  'REEMBOLSO_SUBSIDIO_POR_VENCER',
  'UTILIDADES_EMPRESA_OBLIGADA',
  'RMV_NOCTURNA_INCUMPLIDA',
  'TASAS_SBS_PENDIENTES',
]);
export type TipoAlerta = z.infer<typeof tipoAlertaSchema>;

export const estadoAlertaSchema = z.enum(['PENDIENTE', 'VISTA', 'RESUELTA']);
export type EstadoAlerta = z.infer<typeof estadoAlertaSchema>;

/** Nombre en pantalla de cada tipo (agrupación de la bandeja). */
export const NOMBRE_TIPO_ALERTA: Record<TipoAlerta, string> = {
  CONTRATO_POR_VENCER: 'Contratos por vencer',
  CTS_POR_DEPOSITAR: 'CTS por depositar',
  GRATIFICACION_POR_PAGAR: 'Gratificaciones por pagar',
  VENCIMIENTO_SUNAT: 'Vencimientos SUNAT',
  PRESTAMO_POR_CANCELAR: 'Préstamos que se cancelan',
  SUSPENSION_4TA_CADUCA: 'Suspensiones de 4ta que caducan',
  VACACIONES_POR_VENCER: 'Vacaciones por vencer (indemnización)',
  REEMBOLSO_SUBSIDIO_POR_VENCER: 'Reembolsos de subsidio por vencer',
  UTILIDADES_EMPRESA_OBLIGADA: 'Empresas obligadas a utilidades',
  RMV_NOCTURNA_INCUMPLIDA: 'Jornada nocturna bajo el mínimo',
  TASAS_SBS_PENDIENTES: 'Tasas AFP pendientes de aprobación',
};

/**
 * Módulo al que lleva cada alerta (la de CTS va a /beneficios/cts, etc.).
 * Es un mapa PURO en el contrato compartido: el backend no guarda rutas
 * del frontend y la UI no inventa destinos.
 */
export const RUTA_POR_TIPO_ALERTA: Record<TipoAlerta, string> = {
  CONTRATO_POR_VENCER: '/contratos',
  CTS_POR_DEPOSITAR: '/beneficios/cts',
  GRATIFICACION_POR_PAGAR: '/beneficios/gratificaciones',
  VENCIMIENTO_SUNAT: '/reportes',
  PRESTAMO_POR_CANCELAR: '/prestamos',
  SUSPENSION_4TA_CADUCA: '/personal-externo',
  VACACIONES_POR_VENCER: '/beneficios/vacaciones',
  REEMBOLSO_SUBSIDIO_POR_VENCER: '/planillas',
  UTILIDADES_EMPRESA_OBLIGADA: '/beneficios/utilidades',
  RMV_NOCTURNA_INCUMPLIDA: '/personas',
  TASAS_SBS_PENDIENTES: '/configuracion',
};

export type UrgenciaAlerta = 'VENCIDA' | 'CRITICA' | 'PROXIMA' | 'INFORMATIVA';

/**
 * Urgencia por proximidad de la fecha objetivo (badge de la bandeja):
 * vencida (la fecha pasó), crítica (≤5 días), próxima (≤15) e
 * informativa (más lejos o sin fecha). Función pura: la usan la API y la UI.
 */
export function urgenciaAlerta(diasRestantes: number | null): UrgenciaAlerta {
  if (diasRestantes === null) {
    return 'INFORMATIVA';
  }
  if (diasRestantes < 0) {
    return 'VENCIDA';
  }
  if (diasRestantes <= 5) {
    return 'CRITICA';
  }
  return diasRestantes <= 15 ? 'PROXIMA' : 'INFORMATIVA';
}

export interface AlertaDto {
  id: string;
  tipo: TipoAlerta;
  estado: EstadoAlerta;
  titulo: string;
  detalle: string | null;
  empresaId: string | null;
  empresaNombre: string | null;
  personaId: string | null;
  personaNombre: string | null;
  fechaObjetivo: string | null; // dd/mm/aaaa
  /** Días que faltan para la fecha objetivo (negativo = ya venció) */
  diasRestantes: number | null;
  urgencia: UrgenciaAlerta;
  /** Ruta del módulo donde se atiende (RUTA_POR_TIPO_ALERTA) */
  enlace: string;
  creadoEn: string; // dd/mm/aaaa
}

export interface GrupoAlertasDto {
  tipo: TipoAlerta;
  nombre: string;
  pendientes: number;
  alertas: AlertaDto[];
}

export interface BandejaAlertasDto {
  /** Total PENDIENTE del tenant (el número de la campana) */
  pendientes: number;
  grupos: GrupoAlertasDto[];
}

/** Lo que consumen la campana del header y la tarjeta del dashboard. */
export interface ResumenAlertasDto {
  pendientes: number;
  /** Las 5 más urgentes (vencidas primero, luego por fecha objetivo) */
  masUrgentes: AlertaDto[];
  /** Última vez que el job recalculó las alertas de este tenant */
  ultimaRevision: string | null; // dd/mm/aaaa
}

export const filtroAlertasSchema = z.object({
  empresaId: z.uuid('Empresa inválida').optional(),
  estado: estadoAlertaSchema.optional(),
  tipo: tipoAlertaSchema.optional(),
});
export type FiltroAlertas = z.infer<typeof filtroAlertasSchema>;

/** El contador solo puede marcar VISTA o RESUELTA (PENDIENTE lo pone el job) */
export const marcarAlertaSchema = z.object({
  estado: z.enum(['VISTA', 'RESUELTA']),
});
export type MarcarAlertaInput = z.infer<typeof marcarAlertaSchema>;

// ------------------------- Preferencias de alertas -------------------------

export const MAX_DIAS_ANTICIPACION = 180;

export const preferenciasAlertasSchema = z.object({
  diasAnticipacion: z
    .number()
    .int('Los días deben ser un número entero')
    .min(1, 'La anticipación mínima es 1 día')
    .max(
      MAX_DIAS_ANTICIPACION,
      `La anticipación máxima es ${MAX_DIAS_ANTICIPACION} días`,
    ),
  /** Escalones de los contratos; vacío = un solo aviso con la anticipación */
  escalonesContrato: z
    .array(z.number().int().min(1).max(MAX_DIAS_ANTICIPACION))
    .max(5, 'Como máximo 5 escalones')
    .default([]),
});
export type PreferenciasAlertasInput = z.infer<typeof preferenciasAlertasSchema>;

export interface PreferenciasAlertasDto {
  diasAnticipacion: number;
  escalonesContrato: number[];
}

// ------------------------- Feriados -------------------------

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Feriado NACIONAL. Es dato de plataforma, como el cronograma SUNAT: lo
 * carga el SUPERADMIN porque vale para todo el Perú y cambia por ley
 * (la 31794 añadió cuatro días en 2024).
 */
export const feriadoNacionalSchema = z.object({
  fecha: z.string().regex(FECHA_ISO, 'Fecha AAAA-MM-DD'),
  descripcion: z.string().min(3).max(120),
  normaLegal: z.string().max(120).nullish(),
});
export type FeriadoNacionalInput = z.infer<typeof feriadoNacionalSchema>;

export interface FeriadoNacionalDto {
  id: string;
  fecha: string; // AAAA-MM-DD
  fechaTexto: string; // dd/mm/aaaa
  descripcion: string;
  normaLegal: string | null;
}

/**
 * Feriado propio de la empresa: el aniversario de la ciudad, el día del
 * sector, el paro regional. También sirve para declarar que se dio
 * DESCANSO SUSTITUTORIO por un feriado nacional: se registra la misma
 * fecha con la marca puesta y la entrada de la empresa manda.
 */
export const feriadoEmpresaSchema = z.object({
  fecha: z.string().regex(FECHA_ISO, 'Fecha AAAA-MM-DD'),
  descripcion: z.string().min(3).max(120),
  descansoSustitutorio: z.boolean().default(false),
});
export type FeriadoEmpresaInput = z.infer<typeof feriadoEmpresaSchema>;

export interface FeriadoEmpresaDto {
  id: string;
  fecha: string;
  fechaTexto: string;
  descripcion: string;
  descansoSustitutorio: boolean;
  /** true si esa fecha también es feriado nacional (la empresa la matiza) */
  esNacional: boolean;
}

/** Un feriado del periodo, ya resuelto contra la configuración de la empresa. */
export interface FeriadoDelPeriodoDto {
  fecha: string;
  fechaTexto: string;
  descripcion: string;
  origen: 'NACIONAL' | 'EMPRESA';
  /** Cayó en el día de descanso semanal de la empresa: queda absorbido. */
  enDiaDescanso: boolean;
  descansoSustitutorio: boolean;
  /** Solo estos generan pago triple si se trabajaron. */
  generaPagoTriple: boolean;
}

// ------------------------- Calendario tributario SUNAT -------------------------

export const filaCronogramaSchema = z.object({
  anio: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12),
  digitoRuc: z.number().int().min(0).max(9),
  fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha AAAA-MM-DD'),
  fechaBuenContribuyente: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha AAAA-MM-DD')
    .nullish(),
  normaLegal: z.string().max(120).nullish(),
});
export type FilaCronogramaInput = z.infer<typeof filaCronogramaSchema>;

export interface FilaCronogramaDto {
  id: string;
  anio: number;
  mes: number;
  digitoRuc: number;
  fechaVencimiento: string; // dd/mm/aaaa
  fechaBuenContribuyente: string | null;
  normaLegal: string | null;
}

export interface CronogramaAnioDto {
  anio: number;
  filas: FilaCronogramaDto[];
  /** Meses del año sin cronograma cargado (no se inventan fechas) */
  mesesFaltantes: number[];
  aviso: string | null;
}

export interface VencimientoSunatDto {
  empresaId: string;
  ruc: string;
  digitoRuc: number;
  buenContribuyente: boolean;
  anio: number;
  mes: number;
  fechaVencimiento: string | null; // dd/mm/aaaa; null = sin cronograma cargado
  diasRestantes: number | null;
  aviso: string | null;
}

export interface ResultadoCargaCronogramaDto {
  anio: number | null;
  creadas: number;
  actualizadas: number;
  errores: { fila: number; mensaje: string }[];
}

// ------------------------- Tasas SBS (aprobación humana) -------------------------

export interface TasasAfpDto {
  administradora: AfpAdministradora;
  fondo: string;
  primaSeguro: string;
  comisionFlujo: string;
  comisionSaldo: string;
  vigenteDesde: string; // dd/mm/aaaa
  vigenteHasta: string | null;
}

export interface ActualizacionTasaDto {
  id: string;
  administradora: AfpAdministradora;
  /** Tasas que la SBS publica hoy (propuesta, NUNCA aplicada sola) */
  propuesto: {
    fondo: string;
    primaSeguro: string;
    comisionFlujo: string;
    comisionSaldo: string;
    vigenteDesde: string; // AAAA-MM-DD (fecha desde la que regiría)
  };
  /** Tasas vigentes hoy en el sistema, para la comparativa lado a lado */
  vigente: TasasAfpDto | null;
  /** Campos que cambian (fondo | primaSeguro | comisionFlujo | comisionSaldo) */
  camposDistintos: string[];
  fuenteUrl: string;
  detectadaEn: string; // dd/mm/aaaa
}

export interface PanelTasasSbsDto {
  pendientes: ActualizacionTasaDto[];
  vigentes: TasasAfpDto[];
  /** Último intento del job: la SBS puede cambiar su página sin avisar */
  ultimaRevision: string | null;
  ultimoFallo: { fecha: string; motivo: string } | null;
  fuenteUrl: string;
}

export const revisionTasaSchema = z.object({
  /** Fecha desde la que regirían las tasas aprobadas (AAAA-MM-DD) */
  vigenteDesde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha AAAA-MM-DD')
    .optional(),
  motivo: z.string().max(300).optional(),
});
export type RevisionTasaInput = z.infer<typeof revisionTasaSchema>;

// =====================================================================
// SESIÓN 23 — 2FA, CONSENTIMIENTO Y AUDITORÍA (CLAUDE.md §12)
// =====================================================================

/** Versión vigente de los documentos legales (Ley 29733). */
/**
 * Versión de los documentos legales que el usuario acepta al registrarse.
 * SUBIRLA cada vez que cambie el CONTENIDO: la tabla de aceptaciones
 * guarda esta cadena, y si no cambia queda constancia de que alguien
 * aceptó un texto que en realidad nunca vio.
 *  · 2026-08   — texto base de la S23.
 *  · 2026-08.2 — revisión Ley 29733 / D.S. 003-2013-JUS (S23.5): roles
 *    jurídicos según tipo de suscriptor, plazos ARCO, transferencias
 *    internacionales, conservación e inscripción del banco de datos.
 */
export const VERSION_DOCUMENTOS_LEGALES = '2026-08.2';

export const codigo2faSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(6, 'Ingresa el código de 6 dígitos o uno de respaldo')
    .max(20, 'Código demasiado largo'),
});
export type Codigo2faInput = z.infer<typeof codigo2faSchema>;

export const desactivar2faSchema = z.object({
  password: z.string().min(1, 'Ingresa tu contraseña'),
  codigo: z.string().trim().min(6, 'Ingresa el código de verificación').max(20),
});
export type Desactivar2faInput = z.infer<typeof desactivar2faSchema>;

export interface Estado2faDto {
  habilitado: boolean;
  /** Hay un secreto generado esperando el primer código */
  pendienteDeConfirmar: boolean;
  codigosRespaldoDisponibles: number;
}

export interface Inicio2faDto {
  /** otpauth://totp/... para la app de autenticación */
  otpauthUri: string;
  /** El mismo URI como imagen PNG en data URL, para escanear */
  qrDataUrl: string;
  /** Secreto en bloques, para quien no pueda escanear el QR */
  secretoManual: string;
}

export interface RespuestaActivacion2faDto {
  /** Se muestran UNA sola vez: después solo existen hasheados */
  codigosRespaldo: string[];
}

/**
 * Login con 2FA: el primer paso NO emite tokens. Devuelve un desafío de
 * vida corta que el segundo paso canjea junto con el código.
 */
export interface DesafioLoginDto {
  requiere2fa: true;
  desafio: string;
  /** Segundos que dura el desafío antes de exigir la contraseña otra vez */
  expiraEnSegundos: number;
}

export const login2faSchema = z.object({
  desafio: z.string().min(10, 'Desafío inválido'),
  codigo: z.string().trim().min(6, 'Ingresa el código').max(20),
});
export type Login2faInput = z.infer<typeof login2faSchema>;

/** El login responde una sesión completa o el desafío de segundo factor. */
export type RespuestaLogin = Sesion | DesafioLoginDto;

export function exigeSegundoFactor(
  respuesta: RespuestaLogin,
): respuesta is DesafioLoginDto {
  return (respuesta as DesafioLoginDto).requiere2fa === true;
}

// ------------------------- Auditoría -------------------------

export interface RegistroAuditoriaDto {
  id: string;
  entidad: string;
  entidadId: string | null;
  accion: string;
  usuarioId: string | null;
  usuarioNombre: string | null;
  ip: string | null;
  creadoEn: string; // dd/mm/aaaa HH:MM
  antes: unknown;
  despues: unknown;
}

export interface PaginaAuditoriaDto {
  registros: RegistroAuditoriaDto[];
  total: number;
  pagina: number;
  porPagina: number;
  /** Entidades y acciones presentes, para poblar los filtros */
  entidades: string[];
  acciones: string[];
}

export const filtroAuditoriaSchema = z.object({
  entidad: z.string().max(60).optional(),
  accion: z.string().max(60).optional(),
  usuarioId: z.uuid('Usuario inválido').optional(),
  desde: z.iso.date().optional(),
  hasta: z.iso.date().optional(),
  pagina: z.coerce.number().int().min(1).default(1),
});
export type FiltroAuditoria = z.infer<typeof filtroAuditoriaSchema>;

// ------------------------- Exportación de datos -------------------------

export const exportCifradoSchema = z.object({
  /** Clave con la que se cifra el archivo; no se guarda en ningún lado */
  clave: z
    .string()
    .min(12, 'Usa una clave de al menos 12 caracteres')
    .max(200),
});
export type ExportCifradoInput = z.infer<typeof exportCifradoSchema>;

export interface ResumenExportDto {
  tenantId: string;
  estudio: string;
  generadoEn: string;
  empresas: number;
  personas: number;
  periodos: number;
}

/** Respuesta de login/refresh: el accessToken viaja en el body (se guarda solo en memoria) */
export const sesionSchema = z.object({
  accessToken: z.string(),
  usuario: z.object({
    id: z.uuid(),
    email: z.email(),
    nombres: z.string(),
    apellidos: z.string(),
    rol: rolSchema,
    tenantId: z.uuid().nullable(),
    nombreEstudio: z.string().nullable(),
    /**
     * Alta con contraseña temporal (S23.5): hasta que la cambie, la API
     * rechaza sus peticiones de negocio y la UI lo lleva a la pantalla de
     * cambio. Viaja en la sesión para que el front lo sepa sin preguntar.
     */
    debeCambiarPassword: z.boolean().default(false),
  }),
});

export type Sesion = z.infer<typeof sesionSchema>;

// =====================================================================
// Gestión de usuarios del tenant (Sesión 23.5)
// =====================================================================

export const invitarUsuarioSchema = z.object({
  email: z.email('Correo electrónico inválido'),
  nombres: z.string().min(1, 'Ingresa los nombres').max(80),
  apellidos: z.string().min(1, 'Ingresa los apellidos').max(80),
  rol: rolAsignableSchema,
});
export type InvitarUsuarioInput = z.infer<typeof invitarUsuarioSchema>;

export const cambiarRolSchema = z.object({ rol: rolAsignableSchema });
export type CambiarRolInput = z.infer<typeof cambiarRolSchema>;

export const aceptarInvitacionSchema = z.object({
  token: z.string().min(20, 'Enlace de invitación inválido'),
  password: passwordSchema,
});
export type AceptarInvitacionInput = z.infer<typeof aceptarInvitacionSchema>;

export const cambiarPasswordSchema = z
  .object({
    passwordActual: z.string().min(1, 'Ingresa tu contraseña actual'),
    passwordNueva: passwordSchema,
  })
  .refine((v) => v.passwordActual !== v.passwordNueva, {
    path: ['passwordNueva'],
    message: 'La contraseña nueva tiene que ser distinta de la actual',
  });
export type CambiarPasswordInput = z.infer<typeof cambiarPasswordSchema>;

export interface UsuarioTenantDto {
  id: string;
  email: string;
  nombres: string;
  apellidos: string;
  rol: Rol;
  activo: boolean;
  ultimoLogin: string | null;
  debeCambiarPassword: boolean;
  /** true para el usuario que está mirando la pantalla. */
  esUnoMismo: boolean;
}

export interface InvitacionPendienteDto {
  id: string;
  email: string;
  nombres: string;
  apellidos: string;
  rol: Rol;
  expiraEn: string;
  /** Ya pasó su fecha: sigue en la lista para poder reenviarla. */
  vencida: boolean;
}

export interface PanelUsuariosDto {
  usuarios: UsuarioTenantDto[];
  invitaciones: InvitacionPendienteDto[];
  /** Activos + invitaciones vivas: lo que consume el plan. */
  ocupados: number;
  /** null = sin límite. */
  maxUsuarios: number | null;
}

export interface InvitacionCreadaDto {
  invitacionId: string;
  /**
   * Solo cuando NO hay correo configurado: la contraseña temporal que el
   * titular tiene que entregar en mano. Con SMTP real va por correo y
   * este campo no viaja nunca.
   */
  passwordTemporal?: string;
  /** true si el correo salió de verdad. */
  correoEnviado: boolean;
}

/**
 * Motivo por el que la API rechaza una petición de negocio aunque la
 * sesión sea válida. La UI lo usa para saber a dónde llevar al usuario.
 */
export const CODIGO_CAMBIO_PASSWORD = 'DEBE_CAMBIAR_PASSWORD';
