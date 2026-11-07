import {
  createDemoState,
  demoDate,
  demoUser,
  moduleLabels,
  type DemoRow,
  type DemoState,
} from "./seed.ts";
import {
  enterDemo,
  DEMO_DATA_KEY,
  demoStorage,
  exitDemo,
  isDemoActive,
  type DemoStorage,
} from "./session.ts";

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "X-FEGCON-Mode": "demo" } });
const number = (v: unknown) => {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : 0;
};
const nextId = (rows: DemoRow[]) =>
  Math.max(0, ...rows.map((row) => number(row.id))) + 1;
const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
function load(storage: DemoStorage): DemoState {
  try {
    const raw = storage.getItem(DEMO_DATA_KEY);
    if (raw) {
      const state = JSON.parse(raw);
      if (state.version === 1 && Array.isArray(state.associates)) return { ...state, individualCharges: state.individualCharges || [], benefitUses: state.benefitUses || [] };
    }
  } catch {
    /* Reset invalid demonstration data only. */
  }
  return createDemoState();
}
const products = [
  {
    id: 1,
    product_type: "ahorro",
    code: "APORTES-FEGCON",
    name: "Aportes FEGCON",
    parameters: { ahorros_a_la_vista_pct: 30, aportes_pct: 70 },
  },
  {
    id: 2,
    product_type: "credito",
    code: "LIBRE-INVERSION",
    name: "Libre inversión",
    parameters: { tasa_fija_mensual_pct: 2, plazo_maximo_meses: 60 },
  },
];
function balance(state: DemoState, id: number) {
  const rows = state.transactions.filter(
    (r) => number(r.associate_id) === id && r.status === "aplicado",
  );
  const vista = rows.reduce((sum, r) => sum + number(r.vista_amount), 0),
    contributions = rows.reduce(
      (sum, r) => sum + number(r.contributions_amount),
      0,
    );
  return {
    total_savings: vista + contributions,
    vista_balance: vista,
    contributions_balance: contributions,
    credit_limits: {
      "3": contributions * 3,
      "4": contributions * 4,
      "5": contributions * 5,
    },
  };
}
function person(state: DemoState, row: DemoRow) {
  const p = state.associates.find(
    (a) => number(a.id) === number(row.associate_id),
  );
  return {
    ...row,
    first_name: p?.first_name ?? "Asociado demo",
    last_name: p?.last_name ?? "",
    document_number: p?.document_number ?? "DEMO",
    product_name:
      number(row.product_id) === 1 ? "Aportes FEGCON" : "Libre inversión",
  };
}
function validateAssociate(state: DemoState, id: unknown) {
  const p = state.associates.find((a) => number(a.id) === number(id));
  if (!p || p.status !== "activo")
    throw new Error("Selecciona un asociado activo de la demo.");
  return p;
}
function add(state: DemoState, key: keyof DemoState, data: DemoRow) {
  const rows = state[key] as DemoRow[];
  const row = { ...data, id: nextId(rows), created_at: demoDate() };
  rows.unshift(row);
  return row;
}

/** Local simulation only. Returning null is allowed solely when demo mode is inactive. */
export async function handleDemoRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
  storage = demoStorage(),
): Promise<Response | null> {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
    "https://fegcon.local",
  );
  if (url.pathname !== "/api/" && url.pathname !== "/api")
    return isDemoActive(storage)
      ? json({ error: "La demo no puede realizar solicitudes externas." }, 403)
      : null;
  const action = url.searchParams.get("action") ?? "";
  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  let values: DemoRow = {};
  if (typeof init?.body === "string") {
    try {
      values = JSON.parse(init.body);
    } catch {
      return isDemoActive(storage)
        ? json({ error: "Datos de demostración inválidos." }, 422)
        : null;
    }
  }
  if (init?.body instanceof FormData)
    for (const [key, value] of init.body.entries())
      values[key] =
        typeof value === "string"
          ? value
          : { name: value.name, size: value.size, type: value.type };
  if (
    action === "login" &&
    String(values.email ?? "")
      .trim()
      .toLowerCase() === "demo"
  ) {
    if (values.password !== "demo")
      return json(
        { error: "Para esta cuenta usa usuario demo y contraseña demo." },
        401,
      );
    if (!storage)
      return json(
        {
          error:
            "Permite el almacenamiento de esta pestaña para abrir la demo.",
        },
        503,
      );
    try {
      storage.setItem(DEMO_DATA_KEY, JSON.stringify(load(storage)));
      enterDemo(storage);
    } catch {
      return json(
        { error: "No fue posible iniciar la demo en este navegador." },
        503,
      );
    }
    return json({ user: demoUser, csrf: "demo-local-only" });
  }
  if (!isDemoActive(storage)) return null;
  // Once inside the demo, every API action is resolved here; there is no network fallback.
  if (!storage)
    return json(
      { error: "Almacenamiento de demostración no disponible." },
      503,
    );
  if (action === "me") return json({ user: demoUser, csrf: "demo-local-only" });
  if (action === "logout") {
    exitDemo(storage);
    return json({ ok: true });
  }
  const state = load(storage);
  const scoped = (rows: DemoRow[]) =>
    url.searchParams.has("associate_id")
      ? rows.filter(
          (r) =>
            number(r.associate_id) ===
            number(url.searchParams.get("associate_id")),
        )
      : rows;
  const collection = () =>
    state.collections.map((c) => {
      const items = state.items.filter(
        (i) =>
          number(i.payroll_collection_id) === number(c.id) &&
          i.status !== "anulado",
      );
      return {
        ...c,
        company_name: state.companies.find(
          (p) => number(p.id) === number(c.company_id),
        )?.name,
        item_count: items.length,
        expected_amount: items.reduce((s, r) => s + number(r.amount), 0),
        collected_amount: items.reduce(
          (s, r) => s + number(r.collected_amount),
          0,
        ),
      };
    });
  if (method === "GET") {
    switch (action) {
      case "associate-charges":
        return json({ entries: scoped(state.individualCharges).map(r => person(state, r)) });
      case "associate-benefits":
        return json({ entries: scoped(state.benefitUses).map(r => ({ ...person(state, r), convenio: state.catalog.find(c => number(c.id) === number(r.catalog_id))?.label })) });
      case "dashboard":
        return json({
          metrics: {
            asociados: state.associates.filter((a) => a.status === "activo")
              .length,
            afiliaciones_pendientes: state.affiliations.filter(
              (a) => a.status === "en_revision",
            ).length,
            pagos_aplicados: state.payments
              .filter((p) => p.status === "aplicado")
              .reduce((s, p) => s + number(p.amount), 0),
            cartera_abierta:
              state.receivables
                .filter((r) => ["vencida", "por_vencer"].includes(r.status))
                .reduce((s, r) => s + number(r.amount), 0) +
              state.installments
                .filter((r) => r.status === "pendiente")
                .reduce(
                  (s, r) => s + number(r.total_amount) - number(r.paid_amount),
                  0,
                ),
          },
        });
      case "associates": {
        const q = normalized(url.searchParams.get("q") ?? "");
        return json({
          associates: state.associates
            .map((a) => ({
              ...a,
              company:
                state.companies.find(
                  (c) => number(c.id) === number(a.company_id),
                )?.name ?? a.company,
            }))
            .filter((a) =>
              normalized(
                `${a.first_name} ${a.last_name} ${a.document_number} ${a.company}`,
              ).includes(q),
            ),
        });
      }
      case "companies":
        return json({
          companies: state.companies.filter((c) => number(c.active)),
        });
      case "products":
        return json({
          products: products.filter(
            (p) =>
              !url.searchParams.get("type") ||
              p.product_type === url.searchParams.get("type"),
          ),
        });
      case "savings-transactions":
        return json({
          transactions: scoped(state.transactions).map((r) => person(state, r)),
        });
      case "savings-balance":
      case "credit-capacity":
        return json(
          balance(state, number(url.searchParams.get("associate_id"))),
        );
      case "credit-applications":
        return json({
          applications: scoped(state.applications).map((a) => ({
            ...person(state, a),
            savings_balance: balance(state, number(a.associate_id))
              .total_savings,
            installment_count: state.installments.filter(
              (i) => number(i.credit_application_id) === number(a.id),
            ).length,
          })),
        });
      case "credit-installments":
        return json({
          installments: scoped(state.installments)
            .filter(
              (i) =>
                i.status === "pendiente" &&
                (!url.searchParams.get("credit_application_id") ||
                  number(i.credit_application_id) ===
                    number(url.searchParams.get("credit_application_id"))),
            )
            .map((i) => person(state, i)),
        });
      case "affiliations":
        return json({ requests: state.affiliations });
      case "payments":
        return json({
          payments: scoped(state.payments).map((p) => person(state, p)),
        });
      case "receivables":
        return json({
          receivables: state.receivables.map((r) => ({
            ...person(state, r),
            days_overdue: Math.max(
              0,
              Math.floor(
                (Date.parse(demoDate()) - Date.parse(r.due_date)) / 86400000,
              ),
            ),
            late_interest: Math.round(
              ((number(r.amount) * 0.25) / 360) *
                Math.max(
                  0,
                  Math.floor(
                    (Date.parse(demoDate()) - Date.parse(r.due_date)) /
                      86400000,
                  ),
                ),
            ),
          })),
        });
      case "promissory-notes":
        return json({
          notes: scoped(state.notes).map((n) => ({
            ...person(state, n),
            document_count: state.documents.filter(
              (d) =>
                number(d.note_id) === number(n.id) && d.status !== "retirado",
            ).length,
          })),
        });
      case "credit-documents":
        return json({
          documents: state.documents.filter(
            (d) =>
              number(d.credit_application_id) ===
                number(url.searchParams.get("credit_application_id")) &&
              d.status !== "retirado",
          ),
        });
      case "promissory-documents":
        return json({
          documents: state.documents.filter(
            (d) =>
              number(d.note_id) === number(url.searchParams.get("note_id")) &&
              d.status !== "retirado",
          ),
        });
      case "payroll-collections":
        return json({ collections: collection() });
      case "payroll-items":
        return json({
          items: state.items
            .filter(
              (i) =>
                number(i.payroll_collection_id) ===
                number(url.searchParams.get("collection_id")),
            )
            .map((i) => person(state, i)),
        });
      case "catalog":
        return json({
          items: state.catalog.filter(
            (c) =>
              !url.searchParams.get("category") ||
              c.category === url.searchParams.get("category"),
          ),
        });
      case "users":
        return json({ users: state.users });
      case "settings":
        return json({ settings: state.settings });
      case "business-rules":
        return json({ rules: state.rules });
      case "role-permissions":
        return json({ modules: moduleLabels, permissions: state.permissions });
      case "approval-requests":
        return json({ requests: state.approvals });
      case "audit-log":
        return json({ entries: state.audit });
      default:
        return json(
          {
            error:
              "Esta función no está disponible en la demostración. No se ha enviado ninguna solicitud al servidor.",
          },
          404,
        );
    }
  }
  try {
    const result: DemoRow = {};
    const id = number(values.id || url.searchParams.get("id"));
    if (action === "associates") {
      if (method === "POST") {
        if (!values.firstName || !values.lastName || !values.documentNumber)
          throw new Error("Completa nombres, apellidos y documento.");
        if (
          state.associates.some(
            (a) => a.document_number === values.documentNumber,
          )
        )
          throw new Error("El documento ya está registrado en la demo.");
        const company = state.companies.find((c) => c.name === values.company);
        const row = add(state, "associates", {
          first_name: values.firstName,
          last_name: values.lastName,
          document_type: "CC",
          document_number: values.documentNumber,
          company: values.company,
          company_id: company?.id ?? null,
          email: values.email ?? "",
          phone: values.phone ?? "",
          status: "activo",
        });
        result.associate = { id: row.id, ...values };
      } else {
        const row = state.associates.find((a) => number(a.id) === id);
        if (!row) throw new Error("El asociado no existe.");
        if (method === "DELETE") row.status = "retirado";
        else
          Object.assign(row, {
            first_name: values.firstName,
            last_name: values.lastName,
            document_number: values.documentNumber,
            company: values.company,
            company_id:
              state.companies.find((c) => c.name === values.company)?.id ??
              null,
            email: values.email,
            phone: values.phone,
          });
      }
    } else if (action === "companies") {
      if (!values.name) throw new Error("Ingresa el nombre de la empresa.");
      result.id = add(state, "companies", { ...values, active: 1 }).id;
    } else if (action === "savings-transactions") {
      validateAssociate(state, values.associate_id);
      const amount = number(values.amount);
      if (amount <= 0) throw new Error("El valor debe ser mayor a cero.");
      if (!["aporte", "retiro"].includes(values.movement_type))
        throw new Error("Selecciona aporte o retiro.");
      const withdrawal = values.movement_type === "retiro";
      if (
        withdrawal &&
        amount > balance(state, number(values.associate_id)).vista_balance
      )
        throw new Error("El retiro supera el saldo disponible a la vista.");
      const vista = withdrawal ? -amount : Math.round(amount * 0.3 * 100) / 100;
      result.id = add(state, "transactions", {
        ...values,
        amount,
        vista_amount: vista,
        contributions_amount: withdrawal ? 0 : amount - vista,
        status: "aplicado",
      }).id;
    } else if (action === "associate-charges" || action === "associate-benefits") {
      const charges = action === "associate-charges";
      const key = charges ? "individualCharges" : "benefitUses";
      if (charges && method === "PATCH") {
        const row = state.individualCharges.find(r => number(r.id) === id);
        if (!row || row.status !== "pendiente" || !["pagado", "anulado"].includes(values.status)) throw new Error("El cobro ya fue atendido o el estado no es válido.");
        row.status = values.status;
      } else if (method === "POST") {
        validateAssociate(state, values.associate_id);
        const date = String(charges ? values.due_date : values.used_on);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date || !String(values.description || "").trim() || values.amount === null || values.amount === undefined || String(values.amount).trim() === "" || !Number.isFinite(Number(values.amount)) || Number(values.amount) < (charges ? 0.01 : 0) || Number(values.amount) > 999999999999.99) throw new Error("Revisa fecha, descripción y valor.");
        if (charges && !["quincenal", "mensual"].includes(values.frequency)) throw new Error("Frecuencia inválida.");
        if (!charges) {
          if (!["convenio", "compra", "beneficio"].includes(values.entry_type)) throw new Error("Tipo inválido.");
          if (values.entry_type === "convenio" && !number(values.catalog_id)) throw new Error("Selecciona el convenio utilizado.");
          if (number(values.catalog_id) && !state.catalog.some(c => number(c.id) === number(values.catalog_id) && c.category === "convenio" && c.active)) throw new Error("El convenio no está disponible.");
        }
        result.id = add(state, key, { ...values, amount: Math.round(Number(values.amount)*100)/100, ...(charges ? {status: "pendiente"} : {}) }).id;
      } else throw new Error("Método no permitido.");
    } else if (action === "credit-applications") {
      if (method === "PATCH" && values.operation === "terms") {
        const row = state.applications.find(r => number(r.id) === id);
        if (!row || !["libranza", "transferencia", "efectivo", "consignacion"].includes(values.payment_method) || !["alta", "normal", "baja"].includes(values.priority)) throw new Error("Forma de pago, prioridad o crédito inválido.");
        row.payment_method = values.payment_method; row.priority = values.priority;
      } else if (method === "POST") {
        validateAssociate(state, values.associate_id);
        // Older demo callers may omit these fields; UI always supplies them.
        values.payment_method ??= "libranza"; values.priority ??= "normal";
        if (!["libranza", "transferencia", "efectivo", "consignacion"].includes(values.payment_method) || !["alta", "normal", "baja"].includes(values.priority)) throw new Error("Forma de pago o prioridad inválida.");
        if (
          number(values.amount) <= 0 ||
          number(values.term_months) < 1 ||
          number(values.term_months) > 60
        )
          throw new Error("Indica un monto positivo y plazo de 1 a 60 meses.");
        if (
          number(values.amount) >
          balance(state, number(values.associate_id)).contributions_balance * 5
        )
          throw new Error(
            "El monto supera cinco veces los aportes del asociado.",
          );
        result.id = add(state, "applications", {
          ...values,
          requested_amount: number(values.amount),
          requested_term_months: number(values.term_months),
          status: "en_revision",
          monthly_installment: 0,
        }).id;
      } else {
        const row = state.applications.find((r) => number(r.id) === id);
        if (!row) throw new Error("No se encontró el crédito.");
        if (values.status === "aprobada") {
          const required =
            row.credit_channel === "independiente"
              ? ["declaracion_renta"]
              : ["desprendible_1", "desprendible_2", "certificacion_laboral"];
          if (
            required.some(
              (label) =>
                !state.documents.some(
                  (d) =>
                    number(d.credit_application_id) === id &&
                    d.label === label &&
                    d.status === "custodiado",
                ),
            )
          )
            throw new Error(
              "Completa los soportes de la modalidad antes de aprobar. En la demo puedes cargar archivos de prueba; su contenido no se conserva.",
            );
        }
        const n = number(row.requested_term_months),
          amount = number(row.requested_amount);
        if (
          values.status === "aprobada" &&
          amount >
            balance(state, number(row.associate_id)).contributions_balance *
              number(values.multiplier)
        )
          throw new Error("El monto supera el cupo seleccionado.");
        if (values.status === "desembolsada") {
          if (row.status !== "aprobada")
            throw new Error("Primero aprueba el crédito.");
          if (
            !values.disbursed_on ||
            !values.first_due_date ||
            values.first_due_date <= values.disbursed_on
          )
            throw new Error("Revisa las fechas de desembolso y primera cuota.");
          if (
            state.installments.some(
              (i) => number(i.credit_application_id) === id,
            )
          )
            throw new Error("Este crédito ya tiene cuotas.");
          let pending = amount;
          const payment = (amount * 0.02) / (1 - Math.pow(1.02, -n));
          for (let i = 0; i < n; i++) {
            const interest = Math.round(pending * 0.02 * 100) / 100;
            const principal =
              i === n - 1
                ? pending
                : Math.round((payment - interest) * 100) / 100;
            const due = new Date(values.first_due_date + "T12:00:00");
            due.setMonth(due.getMonth() + i);
            add(state, "installments", {
              associate_id: row.associate_id,
              credit_application_id: id,
              installment_number: i + 1,
              due_date: due.toISOString().slice(0, 10),
              principal_amount: principal,
              interest_amount: interest,
              total_amount: Math.round((principal + interest) * 100) / 100,
              paid_amount: 0,
              status: "pendiente",
            });
            pending -= principal;
          }
        }
        row.status = values.status;
        row.monthly_installment = Math.round(
          (amount * 0.02) / (1 - Math.pow(1.02, -n)),
        );
        row.required_cosigners = number(values.required_cosigners);
      }
    } else if (action === "payments") {
      validateAssociate(state, values.associate_id);
      const amount = number(values.amount);
      if (amount <= 0) throw new Error("Ingresa un valor positivo.");
      if (values.credit_installment_id) {
        const row = state.installments.find(
          (i) =>
            number(i.id) === number(values.credit_installment_id) &&
            number(i.associate_id) === number(values.associate_id),
        );
        if (!row) throw new Error("La cuota no corresponde al asociado.");
        if (amount > number(row.total_amount) - number(row.paid_amount))
          throw new Error("El pago supera el saldo de la cuota.");
        row.paid_amount = number(row.paid_amount) + amount;
        if (row.paid_amount >= number(row.total_amount)) row.status = "pagada";
      }
      result.id = add(state, "payments", {
        ...values,
        amount,
        status: "aplicado",
      }).id;
    } else if (action === "affiliations") {
      if (method === "POST") {
        if (!values.first_name || !values.last_name || !values.document_number)
          throw new Error("Completa los datos del solicitante.");
        const documentKey = String(values.document_number).replace(/[\s.-]/g, "").toUpperCase();
        if (state.associates.some((row) => String(row.document_number).replace(/[\s.-]/g, "").toUpperCase() === documentKey))
          throw new Error("Esta persona ya está registrada como asociada en FEGCON.");
        if (state.affiliations.some((row) => String(row.document_number).replace(/[\s.-]/g, "").toUpperCase() === documentKey))
          throw new Error("Ya existe una solicitud de afiliación para este documento.");
        result.id = add(state, "affiliations", {
          ...values,
          company_name: values.company,
          status: "en_revision",
        }).id;
      } else {
        const row = state.affiliations.find((r) => number(r.id) === id);
        if (!row || row.status !== "en_revision")
          throw new Error("Esta solicitud ya fue revisada.");
        if (!["aprobada", "rechazada"].includes(values.status))
          throw new Error("Selecciona una decisión válida.");
        row.status = values.status;
        if (values.status === "aprobada") {
          const documentKey = String(row.document_number).replace(/[\s.-]/g, "").toUpperCase();
          if (state.associates.some((associate) => String(associate.document_number).replace(/[\s.-]/g, "").toUpperCase() === documentKey))
            throw new Error("No se puede aprobar: este documento ya pertenece a un asociado.");
          add(state, "associates", {
            first_name: row.first_name,
            last_name: row.last_name,
            document_type: "CC",
            document_number: row.document_number,
            company: row.company_name,
            company_id:
              state.companies.find((c) => c.name === row.company_name)?.id ??
              null,
            status: "activo",
            email: row.email,
            phone: row.phone,
          });
        }
      }
    } else if (action === "receivables") {
      validateAssociate(state, values.associate_id);
      if (number(values.amount) <= 0)
        throw new Error("Ingresa un valor positivo.");
      result.id = add(state, "receivables", {
        ...values,
        status: values.due_date < demoDate() ? "vencida" : "por_vencer",
      }).id;
    } else if (action === "promissory-notes") {
      validateAssociate(state, values.associate_id);
      if (!values.note_number) throw new Error("Ingresa el número del pagaré.");
      if (state.notes.some((n) => n.note_number === values.note_number))
        throw new Error("Este número de pagaré ya existe.");
      result.id = add(state, "notes", { ...values, status: "borrador" }).id;
    } else if (
      action === "credit-documents" ||
      action === "promissory-documents"
    ) {
      if (method === "DELETE") {
        const row = state.documents.find((d) => number(d.id) === id);
        if (!row) throw new Error("No se encontró el soporte.");
        row.status = "retirado";
      } else {
        if (!values.file?.name)
          throw new Error("Selecciona un archivo de prueba.");
        if (number(values.file.size) > 15 * 1024 * 1024)
          throw new Error("El archivo supera 15 MB.");
        result.id = add(state, "documents", {
          credit_application_id: values.credit_application_id
            ? number(values.credit_application_id)
            : undefined,
          note_id: values.note_id ? number(values.note_id) : undefined,
          label: values.label,
          original_name: values.file.name,
          mime_type: values.file.type,
          byte_size: values.file.size,
          status: "custodiado",
        }).id;
        result.message =
          "Soporte simulado: solo se guardó el nombre en esta pestaña. El contenido no se carga ni se conserva.";
      }
    } else if (action === "payroll-collections") {
      if (method === "POST") {
        const company = state.companies.find(
          (c) => number(c.id) === number(values.company_id),
        );
        if (!company) throw new Error("Selecciona una empresa.");
        result.id = add(state, "collections", {
          ...values,
          company_name: company.name,
          status: "borrador",
        }).id;
      } else {
        const row = state.collections.find((c) => number(c.id) === id);
        if (!row) throw new Error("No se encontró la relación.");
        row.status = values.status;
      }
    } else if (action === "payroll-items") {
      if (method === "POST") {
        const p = validateAssociate(state, values.associate_id);
        const c = state.collections.find(
          (c) => number(c.id) === number(values.payroll_collection_id),
        );
        if (!c || number(c.company_id) !== number(p.company_id))
          throw new Error(
            "El asociado debe pertenecer a la empresa de la relación.",
          );
        if (number(values.amount) <= 0)
          throw new Error("Ingresa un valor positivo.");
        result.id = add(state, "items", {
          ...values,
          collected_amount: 0,
          status: "pendiente",
        }).id;
      } else {
        const row = state.items.find((r) => number(r.id) === id);
        if (!row) throw new Error("No se encontró el concepto.");
        if (method === "DELETE") row.status = "anulado";
        else {
          if (
            number(values.collected_amount) > number(row.amount) ||
            number(values.collected_amount) < 0
          )
            throw new Error(
              "El recaudo debe estar entre cero y el valor esperado.",
            );
          row.collected_amount = number(values.collected_amount);
          row.status =
            row.collected_amount === number(row.amount)
              ? "conciliado"
              : "pendiente";
        }
      }
    } else if (action === "catalog") {
      result.id = add(state, "catalog", { ...values, active: 1 }).id;
    } else if (action === "users") {
      if (method === "POST") {
        if (!values.full_name || !values.email)
          throw new Error("Completa los datos de la cuenta de ejemplo.");
        result.id = add(state, "users", {
          full_name: values.full_name,
          email: values.email,
          role: "operador",
          active: 1,
        }).id;
      } else {
        const row = state.users.find((u) => number(u.id) === id);
        if (!row || id === 1)
          throw new Error("La cuenta demo debe permanecer activa.");
        row.active = values.active ? 1 : 0;
      }
    } else if (action === "settings") {
      state.settings = { ...state.settings, ...values };
    } else if (action === "role-permissions") {
      state.permissions = values.permissions;
      result.permissions = state.permissions;
    } else if (action === "business-rules") {
      state.rules.late_interest = {
        usury_rate_percent: number(values.usury_rate_percent),
        effective_month: values.effective_month,
        history: [
          {
            effective_month: values.effective_month,
            rate_percent: number(values.usury_rate_percent),
          },
          ...state.rules.late_interest.history.filter(
            (r: DemoRow) => r.effective_month !== values.effective_month,
          ),
        ],
      };
    } else if (action === "approval-requests") {
      const row = state.approvals.find((r) => number(r.id) === id);
      if (!row || row.status !== "pendiente")
        throw new Error("La solicitud ya fue revisada.");
      row.status =
        values.decision === "aprobada" || values.status === "aprobada"
          ? "aprobada"
          : "rechazada";
      row.reviewed_at = demoDate();
      if (row.status === "aprobada" && row.operation === "associate_update") {
        const p = state.associates.find(
          (a) => number(a.id) === number(row.payload.id),
        );
        if (p) Object.assign(p, { email: row.payload.email });
      }
    } else
      return json(
        {
          error:
            "Esta acción no está disponible en la demo. No se ha enviado al servidor.",
        },
        404,
      );
    add(state, "audit", {
      entity: action,
      entity_id: result.id ?? id,
      action: method.toLowerCase(),
      detail: "Operación simulada en la cuenta demo.",
      user_name: demoUser.name,
    });
    storage.setItem(DEMO_DATA_KEY, JSON.stringify(state));
    return json(
      {
        ok: true,
        message: "Cambio guardado únicamente en la demo.",
        ...result,
      },
      method === "POST" ? 201 : 200,
    );
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar el cambio de demostración.",
      },
      422,
    );
  }
}
