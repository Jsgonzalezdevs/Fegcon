"use client";

import { ArrowRight, BookOpen, CircleHelp, ShieldCheck } from "lucide-react";

export const moduleGuides = {
  inicio: {
    purpose: "Tu jornada en FEGCON",
    description:
      "Consulta los pendientes y elige la operación que necesitas realizar.",
    steps: [
      "Revisa la bandeja de atención.",
      "Abre el módulo de la tarea pendiente.",
      "Consulta el resultado en su historial.",
    ],
    tip: "Los indicadores se consultan en el sistema. Un guion significa que el dato todavía no está disponible.",
  },
  asociados: {
    purpose: "Encuentra a la persona antes de operar",
    description:
      "Busca por nombre o documento y abre su ficha para consultar su información y sus movimientos.",
    steps: [
      "Busca el documento para evitar duplicados.",
      "Abre la ficha o registra un nuevo asociado.",
      "Verifica sus datos antes de guardar.",
    ],
    tip: "Retirar a un asociado conserva su historial. Una afiliación es la solicitud previa a su vinculación.",
  },
  afiliaciones: {
    purpose: "Acompaña una nueva vinculación",
    description:
      "Registra y revisa las solicitudes de personas que quieren hacer parte del fondo.",
    steps: [
      "Registra los datos del solicitante.",
      "Verifica que los documentos estén completos.",
      "Aprueba o rechaza con la autorización correspondiente.",
    ],
    tip: "Una afiliación aprobada crea el asociado activo. Revisa primero si la persona ya está registrada.",
  },
  empresas: {
    purpose: "Organiza las empresas vinculadas",
    description:
      "Mantén los datos de contacto y la información necesaria para los cobros por nómina.",
    steps: [
      "Busca la empresa antes de crearla.",
      "Completa la identificación y el contacto.",
      "Vincúlala al asociado correspondiente.",
    ],
    tip: "La empresa es necesaria para agrupar los cobros de libranza. Un independiente puede quedar sin empresa.",
  },
  ahorros: {
    purpose: "Registra cada movimiento con claridad",
    description:
      "Consulta saldos y registra aportes o retiros del asociado seleccionado.",
    steps: [
      "Selecciona el asociado y consulta su saldo.",
      "Elige aporte o retiro e ingresa el valor.",
      "Verifica la distribución y confirma el movimiento.",
    ],
    tip: "Los aportes se distribuyen en 30% de ahorro a la vista y 70% de aportes. La disponibilidad de un retiro se valida con los saldos registrados.",
  },
  creditos: {
    purpose: "Del estudio al seguimiento del crédito",
    description:
      "Reúne los soportes, revisa la capacidad y gestiona la solicitud en un mismo recorrido.",
    steps: [
      "Selecciona el asociado y la modalidad.",
      "Completa monto, plazo y soportes requeridos.",
      "Revisa la decisión y el plan de cuotas.",
    ],
    tip: "Libranza requiere dos desprendibles y certificación laboral. La modalidad independiente requiere declaración de renta y los codeudores definidos para el caso.",
  },
  pagares: {
    purpose: "Mantén cada pagaré localizable",
    description:
      "Gestiona los documentos de respaldo del crédito y su estado de firma y custodia.",
    steps: [
      "Identifica el asociado y el crédito.",
      "Revisa número, valor y estado del pagaré.",
      "Carga el soporte y confirma su custodia.",
    ],
    tip: "Registrar el pagaré no equivale a tenerlo firmado. Mantén el estado acorde con el documento realmente recibido.",
  },
  cartera: {
    purpose: "Anticípate a los vencimientos",
    description:
      "Consulta obligaciones, cuotas y mora para priorizar el seguimiento del fondo.",
    steps: [
      "Localiza al asociado o la obligación.",
      "Revisa vencimiento, capital y estado.",
      "Registra los recaudos desde Pagos.",
    ],
    tip: "La mora mostrada es estimada y depende de la tasa configurada para el período. Verifica la tasa antes de usar el cálculo.",
  },
  cobros: {
    purpose: "Prepara el cobro de nómina por empresa",
    description:
      "Reúne los valores del período y conserva la relación de cobro para su seguimiento.",
    steps: [
      "Selecciona empresa y período.",
      "Revisa los asociados y valores incluidos.",
      "Genera la relación y consulta su estado.",
    ],
    tip: "Una relación de cobro no confirma un recaudo. Registra el dinero recibido en Pagos para conservar su trazabilidad.",
  },
  pagos: {
    purpose: "Deja trazabilidad del dinero recibido",
    description:
      "Registra el recaudo con su asociado, fecha, medio de pago y referencia.",
    steps: [
      "Identifica al asociado y la obligación.",
      "Comprueba el valor y el soporte del recaudo.",
      "Guarda y verifica el estado del pago.",
    ],
    tip: "Antes de registrar, revisa si ya existe el pago con la misma referencia para evitar duplicados.",
  },
  convenios: {
    purpose: "Mantén a mano los beneficios del fondo",
    description:
      "Organiza los convenios que FEGCON ha registrado para sus asociados.",
    steps: [
      "Consulta si el convenio ya existe.",
      "Registra proveedor y condiciones.",
      "Verifica los datos antes de ofrecer el beneficio.",
    ],
    tip: "Publica condiciones claras y comprueba su vigencia con el proveedor.",
  },
  reportes: {
    purpose: "Consulta la información que necesitas",
    description:
      "Elige el área y revisa los registros disponibles antes de descargar o compartir información.",
    steps: [
      "Elige el tipo de información.",
      "Revisa el período y los registros disponibles.",
      "Verifica el contenido antes de compartirlo.",
    ],
    tip: "Los reportes contienen información personal y financiera. Compártelos únicamente con las personas autorizadas.",
  },
  administracion: {
    purpose: "Prepara y supervisa la operación",
    description:
      "Configura el fondo, administra los accesos y revisa las operaciones pendientes.",
    steps: [
      "Completa los pasos esenciales del resumen.",
      "Asigna a cada persona los accesos necesarios.",
      "Revisa solicitudes y consulta la bitácora.",
    ],
    tip: "Los permisos de consulta y de gestión son distintos. Revisa ambos al configurar el perfil del equipo.",
  },
  aprobaciones: {
    purpose: "Revisa antes de aplicar un cambio",
    description:
      "Comprueba quién solicita la operación y qué información cambiará.",
    steps: [
      "Abre la solicitud pendiente.",
      "Compara los datos y revisa sus soportes.",
      "Aprueba o rechaza según corresponda.",
    ],
    tip: "La aprobación aplica la operación al sistema. Comprueba persona, valor y referencia antes de decidir.",
  },
  configuracion: {
    purpose: "Consulta las reglas del fondo",
    description:
      "Revisa las condiciones de ahorro, crédito y mora usadas en la operación.",
    steps: [
      "Consulta la regla que corresponde.",
      "Verifica el período de la tasa de mora.",
      "Solicita revisión si encuentras una diferencia.",
    ],
    tip: "Las reglas base son institucionales. La tasa de usura se registra por período con el acceso autorizado.",
  },
  mis_solicitudes: {
    purpose: "Sigue el resultado de tus solicitudes",
    description:
      "Consulta si tus operaciones siguen pendientes o ya fueron revisadas.",
    steps: [
      "Localiza la operación que enviaste.",
      "Revisa su estado y detalle.",
      "Comprueba el resultado antes de volver a enviarla.",
    ],
    tip: "Una solicitud pendiente aún no aplica el cambio. Evita enviarla de nuevo mientras espera revisión.",
  },
  perfil: {
    purpose: "Toda la información del asociado",
    description:
      "Consulta sus datos y revisa los movimientos de cada sección de su ficha.",
    steps: [
      "Confirma nombre y documento.",
      "Elige la sección que necesitas consultar.",
      "Revisa el historial antes de registrar novedades.",
    ],
    tip: "Confirma siempre la identidad del asociado antes de realizar una operación financiera.",
  },
} as const;

export type ModuleView = keyof typeof moduleGuides;

export function ModuleGuide({
  view,
  role,
}: {
  view: ModuleView;
  role: string;
}) {
  const guide = moduleGuides[view];
  return (
    <details className="module-guide" key={view}>
      <summary>
        <span className="guide-symbol">
          <CircleHelp size={19} />
        </span>
        <span>
          <b>
            ¿Cómo usar {view === "inicio" ? "este espacio" : "este módulo"}?
          </b>
          <small>{guide.purpose}</small>
        </span>
        <span className="guide-open-label">
          Ver guía <BookOpen size={15} />
        </span>
      </summary>
      <div className="guide-body">
        <p>{guide.description}</p>
        <ol>
          {guide.steps.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              {step}
              {index < 2 && <ArrowRight aria-hidden="true" size={15} />}
            </li>
          ))}
        </ol>
        <aside>
          <CircleHelp size={17} />
          <p>{guide.tip}</p>
        </aside>
        <div className="guide-permission">
          <ShieldCheck size={16} />
          {role === "superadmin"
            ? "Tus decisiones se aplican al sistema y quedan registradas en la bitácora."
            : "Las acciones disponibles dependen de tus permisos. Los cambios que envíes quedan sujetos a revisión antes de aplicarse."}
        </div>
      </div>
    </details>
  );
}
