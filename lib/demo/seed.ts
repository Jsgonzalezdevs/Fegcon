export type DemoRow = ReturnType<typeof JSON.parse>;
export type DemoState = {
  version: 1;
  companies: DemoRow[];
  associates: DemoRow[];
  transactions: DemoRow[];
  applications: DemoRow[];
  installments: DemoRow[];
  affiliations: DemoRow[];
  payments: DemoRow[];
  receivables: DemoRow[];
  notes: DemoRow[];
  documents: DemoRow[];
  collections: DemoRow[];
  items: DemoRow[];
  catalog: DemoRow[];
  individualCharges: DemoRow[];
  benefitUses: DemoRow[];
  users: DemoRow[];
  approvals: DemoRow[];
  audit: DemoRow[];
  settings: DemoRow;
  permissions: DemoRow;
  rules: DemoRow;
};
export const demoUser = {
  demo: true,
  id: 1,
  name: "Cuenta de demostración",
  email: "demo@fegcon.example",
  role: "superadmin",
  role_label: "Demo · datos ficticios",
  permissions: { all: true },
};
export const moduleLabels = {
  inicio: "Inicio",
  associates: "Asociados",
  affiliations: "Afiliaciones",
  companies: "Empresas",
  savings: "Ahorros y aportes",
  credits: "Créditos",
  promissory: "Pagarés",
  receivables: "Cartera",
  payroll: "Cobros de nómina",
  payments: "Pagos",
  convenios: "Convenios",
  reports: "Reportes",
  rules: "Reglas",
  approvals: "Solicitudes",
};
export function demoDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function createDemoState(): DemoState {
  const companies = [
    "Constructora Ejemplo",
    "Obras del Futuro · Demo",
    "Servicios Modelo",
  ].map((name, i) => ({
    id: i + 1,
    name,
    tax_id: `DEMO-00${i + 1}`,
    contact_name: "Contacto de demostración",
    contact_email: `empresa${i + 1}@example.com`,
    active: 1,
    created_at: demoDate(-90),
  }));
  const names = [
    ["Ana María", "Demo"],
    ["Carlos Andrés", "Demo"],
    ["Laura Sofía", "Demo"],
    ["Diego Alejandro", "Demo"],
    ["Valentina", "Demo"],
    ["Juan Pablo", "Demo"],
    ["Camila", "Demo"],
    ["Santiago", "Demo"],
  ];
  const associates = names.map(([first_name, last_name], i) => ({
    id: i + 1,
    first_name,
    last_name,
    document_type: "CC",
    document_number: `DEMO-${1001 + i}`,
    company_id: (i % 3) + 1,
    company: companies[i % 3].name,
    email: `asociado${i + 1}@example.com`,
    phone: "Sin teléfono real",
    status: i === 7 ? "pendiente" : "activo",
    created_at: demoDate(-80 + i * 4),
  }));
  const transactions = associates
    .filter((a) => a.status === "activo")
    .flatMap((a, i) =>
      [0, 1, 2].map((month) => {
        const amount = 250000 + i * 50000;
        return {
          id: i * 3 + month + 1,
          associate_id: a.id,
          product_id: 1,
          movement_type: "aporte",
          amount,
          vista_amount: amount * 0.3,
          contributions_amount: amount * 0.7,
          status: "aplicado",
          reference: `APORTE-DEMO-${i + 1}-${month + 1}`,
          created_at: demoDate(-60 + month * 15),
        };
      }),
    );
  const applications = [
    {
      id: 1,
      associate_id: 1,
      product_id: 2,
      requested_amount: 1200000,
      requested_term_months: 12,
      purpose: "Mejoras del hogar · ejemplo",
      credit_channel: "libranza",
      status: "desembolsada",
      monthly_installment: 113471,
      created_at: demoDate(-35),
      installment_count: 12,
    },
    {
      id: 2,
      associate_id: 3,
      product_id: 2,
      requested_amount: 800000,
      requested_term_months: 6,
      purpose: "Educación · ejemplo",
      credit_channel: "libranza",
      status: "en_revision",
      monthly_installment: 0,
      created_at: demoDate(-2),
      installment_count: 0,
    },
    {
      id: 3,
      associate_id: 4,
      product_id: 2,
      requested_amount: 1000000,
      requested_term_months: 12,
      purpose: "Libre inversión · ejemplo",
      credit_channel: "independiente",
      status: "aprobada",
      monthly_installment: 94560,
      required_cosigners: 1,
      created_at: demoDate(-6),
      installment_count: 0,
    },
  ];
  const installments = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    credit_application_id: 1,
    associate_id: 1,
    installment_number: i + 1,
    due_date: demoDate(-5 + i * 30),
    principal_amount: 100000,
    interest_amount: 13471,
    total_amount: 113471,
    paid_amount: i === 0 ? 50000 : 0,
    status: "pendiente",
  }));
  return {
    version: 1,
    individualCharges: [],
    benefitUses: [],
    companies,
    associates,
    transactions,
    applications,
    installments,
    affiliations: [
      {
        id: 1,
        first_name: "Daniela",
        last_name: "Solicitud Demo",
        document_number: "DEMO-2001",
        company_name: companies[0].name,
        email: "solicitud@example.com",
        phone: "Sin teléfono real",
        documents_status: "completos",
        status: "en_revision",
        created_at: demoDate(-1),
      },
    ],
    payments: [
      {
        id: 1,
        associate_id: 1,
        amount: 50000,
        concept: "Abono a cuota · ejemplo",
        received_on: demoDate(-2),
        status: "aplicado",
        credit_installment_id: 1,
        installment_number: 1,
        reference: "PAGO-DEMO-001",
      },
      {
        id: 2,
        associate_id: 2,
        amount: 150000,
        concept: "Recaudo de ejemplo",
        received_on: demoDate(-1),
        status: "aplicado",
        reference: "PAGO-DEMO-002",
      },
    ],
    receivables: [
      {
        id: 1,
        associate_id: 2,
        reference: "CONVENIO-DEMO-001",
        amount: 85000,
        due_date: demoDate(-4),
        status: "vencida",
      },
      {
        id: 2,
        associate_id: 5,
        reference: "OBLIGACIÓN-DEMO-002",
        amount: 120000,
        due_date: demoDate(5),
        status: "por_vencer",
      },
    ],
    notes: [
      {
        id: 1,
        associate_id: 1,
        credit_application_id: 1,
        note_number: "PAG-DEMO-001",
        amount: 1200000,
        status: "firmado",
        created_at: demoDate(-35),
      },
      {
        id: 2,
        associate_id: 4,
        credit_application_id: 3,
        note_number: "PAG-DEMO-002",
        amount: 1000000,
        status: "pendiente_firma",
        created_at: demoDate(-3),
      },
    ],
    documents: [
      {
        id: 1,
        credit_application_id: 1,
        label: "certificacion_laboral",
        original_name: "certificacion-ejemplo.pdf",
        mime_type: "application/pdf",
        byte_size: 24576,
        status: "custodiado",
        created_at: demoDate(-35),
      },
    ],
    collections: [
      {
        id: 1,
        company_id: 1,
        company_name: companies[0].name,
        collection_date: demoDate(5).slice(0, 8) + "10",
        period_label: "Relación de demostración",
        expected_amount: 363471,
        collected_amount: 0,
        status: "borrador",
        item_count: 2,
      },
    ],
    items: [
      {
        id: 1,
        payroll_collection_id: 1,
        associate_id: 1,
        charge_type: "aporte",
        amount: 250000,
        collected_amount: 0,
        reference: "Aporte de ejemplo",
        status: "pendiente",
      },
      {
        id: 2,
        payroll_collection_id: 1,
        associate_id: 1,
        credit_application_id: 1,
        charge_type: "cuota_credito",
        amount: 113471,
        collected_amount: 0,
        reference: "Cuota de ejemplo",
        status: "pendiente",
      },
    ],
    catalog: [
      {
        id: 1,
        category: "convenio",
        label: "Bienestar · Proveedor Demo",
        payload: {
          benefit: "Descuento de ejemplo del 10%",
          start_date: demoDate(-30),
          end_date: demoDate(60),
        },
        active: 1,
      },
      {
        id: 2,
        category: "payment_method",
        label: "Transferencia · ejemplo",
        payload: {},
        active: 1,
      },
    ],
    users: [
      {
        id: 1,
        full_name: demoUser.name,
        email: demoUser.email,
        role: "superadmin",
        active: 1,
      },
      {
        id: 2,
        full_name: "Supervisor de demostración",
        email: "supervisor@example.com",
        role: "operador",
        active: 1,
      },
    ],
    approvals: [
      {
        id: 1,
        requested_by_name: "Supervisor de demostración",
        operation: "associate_update",
        summary: "Actualizar contacto de un asociado · ejemplo",
        payload: { id: 2, email: "contacto-nuevo@example.com" },
        status: "pendiente",
        created_at: demoDate(-1),
      },
    ],
    audit: [
      {
        id: 1,
        entity: "demo",
        entity_id: 1,
        action: "inicio",
        detail:
          "Datos ficticios de demostración. No corresponden a personas ni operaciones reales.",
        user_name: demoUser.name,
        created_at: demoDate(),
      },
    ],
    settings: {
      organization: {
        name: "FEGCON · Demostración",
        nit: "DEMO-SIN-VALIDEZ",
        email: "demo@example.com",
      },
    },
    permissions: Object.fromEntries(
      Object.keys(moduleLabels).map((key) => [
        key,
        {
          view: true,
          manage: !["inicio", "reports", "rules", "approvals"].includes(key),
        },
      ]),
    ),
    rules: {
      late_interest: {
        usury_rate_percent: 25,
        effective_month: demoDate().slice(0, 7),
        history: [
          { effective_month: demoDate().slice(0, 7), rate_percent: 25 },
        ],
      },
    },
  };
}
