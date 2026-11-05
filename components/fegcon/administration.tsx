"use client";

import { privateDocumentHref } from "@/lib/private-document";

import { apiFetch } from "@/lib/fegcon-api";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Banknote,
  Building2,
  Check,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { RolePermissionsPanel, UsersPanel } from "@/components/fegcon/access";
import { Heading } from "@/components/fegcon/associates";
import { CompaniesPanel } from "@/components/fegcon/companies";
import {
  ApiJson,
  money,
  readJson,
  StatusFor,
  useCapability,
  View,
} from "@/components/fegcon/shared";

export function BusinessRulesPanel({
  csrf,
  role,
  embedded = false,
}: {
  csrf: string;
  role: string;
  embedded?: boolean;
}) {
  const [rate, setRate] = useState<number | null>(null),
    [month, setMonth] = useState(""),
    [rates, setRates] = useState<ApiJson[]>([]),
    [currentMonth, setCurrentMonth] = useState(""),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false);
  const load = useCallback(async (preferredMonth?: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/?action=business-rules", {
        credentials: "same-origin",
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(data.error || "No fue posible consultar las reglas.");
      const rule = data.rules?.late_interest;
      if (rule) {
        const history = rule.history || [];
        const selection =
          preferredMonth &&
          history.find(
            (item: ApiJson) => item.effective_month === preferredMonth,
          );
        setRate(
          selection
            ? Number(selection.rate_percent)
            : rule.usury_rate_percent == null
              ? null
              : Number(rule.usury_rate_percent),
        );
        setMonth(selection ? preferredMonth : rule.effective_month || "");
        setCurrentMonth(rule.effective_month || "");
        setRates(history);
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible consultar las reglas.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const saveRate = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch("/api/?action=business-rules", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({
          effective_month: month,
          usury_rate_percent: rate,
        }),
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(data.error || "No fue posible guardar la tasa.");
      setNotice("Tasa de usura guardada para el período.");
      await load(month);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible guardar la tasa.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className={embedded ? "rules-content" : "page"}>
      {!embedded && (
        <Heading
          eyebrow="REGLAS DEL FONDO"
          title="Políticas financieras"
          text="Las condiciones del fondo son fijas. La tasa de usura se registra cada mes."
        />
      )}
      <section className="data-panel">
        <div className="table-tools">
          <b>Ahorros y aportes</b>
          <small>Distribución fija del ahorro total del asociado</small>
        </div>
        <div className="p-6 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border p-4">
            <b>30% · Ahorro a la vista</b>
            <p>Disponibilidad inmediata para el asociado.</p>
          </div>
          <div className="rounded-xl border p-4">
            <b>70% · Aportes</b>
            <p>
              Base para calcular el cupo de crédito: 3, 4 o 5 veces este saldo,
              según evaluación de la solicitud.
            </p>
          </div>
        </div>
      </section>
      <section className="data-panel mt-6">
        <div className="table-tools">
          <b>Crédito de libre inversión</b>
          <small>Única línea de crédito definida por FEGCON</small>
        </div>
        <div className="p-6 grid gap-3 md:grid-cols-2">
          <p>
            <b>Tasa:</b> 2% mensual fija, aplicada al saldo pendiente.
          </p>
          <p>
            <b>Plazo:</b> de 1 a 60 meses.
          </p>
          <p>
            <b>Libranza:</b> dos últimos desprendibles de pago y certificación
            laboral.
          </p>
          <p>
            <b>Independiente:</b> declaración de renta y uno o dos codeudores,
            según el monto evaluado en cada solicitud.
          </p>
        </div>
      </section>
      <section className="data-panel mt-6">
        <div className="table-tools">
          <div>
            <b>Interés de mora</b>
            <small>
              Base de 360 días · tasa de usura vigente para el período
            </small>
          </div>
          {!loading && (
            <Button variant="outline" onClick={() => void load()}>
              Actualizar
            </Button>
          )}
        </div>
        <div className="p-6">
          <p className="font-semibold">
            Capital de la cuota × (tasa de usura vigente ÷ 100) ÷ 360 × días en
            mora
          </p>
          {error && (
            <div className="auth-error mt-3" role="alert">
              {error}
            </div>
          )}
          {role === "superadmin" ? (
            <form
              onSubmit={saveRate}
              className="mt-4 flex flex-wrap items-end gap-3"
            >
              <label>
                Mes aplicable
                <Input
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  required
                  disabled={loading || saving}
                />
              </label>
              <label>
                Tasa de usura vigente (%)
                <Input
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={rate ?? ""}
                  onChange={(event) =>
                    setRate(
                      event.target.value === ""
                        ? null
                        : Number(event.target.value),
                    )
                  }
                  required
                  disabled={loading || saving}
                />
              </label>
              <Button
                className="violet-button"
                type="submit"
                disabled={loading || saving || Boolean(error)}
              >
                {saving ? "Guardando…" : "Guardar tasa del mes"}
              </Button>
              {notice && <small role="status">{notice}</small>}
            </form>
          ) : (
            <p className="mt-3">
              Tasa registrada para {month || "el mes aún no está configurado"}:{" "}
              {rate == null ? "pendiente" : `${rate}%`}.
            </p>
          )}
          {loading ? (
            <div className="empty-state">Consultando historial de tasas…</div>
          ) : rates.length ? (
            <div className="mt-5">
              <b className="text-sm">Historial de tasas</b>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes</TableHead>
                    <TableHead>Tasa registrada</TableHead>
                    <TableHead>Aplicación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map((item) => (
                    <TableRow key={item.effective_month}>
                      <TableCell>{item.effective_month}</TableCell>
                      <TableCell>{Number(item.rate_percent)}%</TableCell>
                      <TableCell>
                        {item.effective_month === currentMonth
                          ? "Mes vigente"
                          : "Histórico"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            !error && (
              <div className="empty-state">
                <b>Aún no hay tasas registradas</b>
                <small>
                  Registra la tasa oficial de cada período antes de calcular
                  mora.
                </small>
              </div>
            )
          )}
        </div>
      </section>
      <section className="data-panel mt-6">
        <div className="table-tools">
          <b>Cobros y recaudo</b>
          <small>Reglas de periodicidad y envío</small>
        </div>
        <div className="p-6 grid gap-2">
          <p>
            El fondo cobra aportes y cuotas a cada asociado quincenal o
            mensualmente. Prepara la relación y envíala por WhatsApp desde el
            canal habitual.
          </p>
          <p>
            Las relaciones de libranza se preparan para los días 10 y 20 e
            incluyen aportes, cuotas de crédito y convenios cuando aplique.
          </p>
          <div className="form-guidance" role="note">
            <div>
              <b>Envío manual</b>
              <small>
                FEGCON todavía no tiene una integración de WhatsApp conectada.
                El sistema no envía mensajes por su cuenta.
              </small>
            </div>
          </div>
        </div>
      </section>
      <section className="data-panel mt-6">
        <div className="table-tools">
          <b>Pagarés y documentos</b>
          <small>Expediente digital por asociado</small>
        </div>
        <div className="p-6">
          <p>
            FEGCON conserva aproximadamente siete documentos por crédito. Se
            escanean y se guardan en la carpeta digital del asociado; sus
            nombres y la política exacta de copias aún deben definirse.
          </p>
        </div>
      </section>
      <section className="data-panel mt-6">
        <div className="table-tools">
          <b>Perfiles de acceso</b>
          <small>Permisos ajustables desde el Centro de control</small>
        </div>
        <div className="p-6 grid gap-3 md:grid-cols-2">
          <p>
            <b>Supervisor:</b> puede acceder a los módulos y acciones que se
            habiliten para su perfil.
          </p>
          <p>
            <b>Superadmin:</b> mantiene acceso completo a la operación, las
            cuentas y la configuración.
          </p>
        </div>
      </section>
    </div>
  );
}

export type AdminSection =
  | "resumen"
  | "aprobaciones"
  | "usuarios"
  | "permisos"
  | "empresas"
  | "reglas"
  | "organizacion"
  | "auditoria";
export const adminSections: {
  id: AdminSection;
  label: string;
  help: string;
  icon: LucideIcon;
}[] = [
  {
    id: "resumen",
    label: "Resumen",
    help: "Estado y próximos pasos",
    icon: LayoutDashboard,
  },
  {
    id: "aprobaciones",
    label: "Aprobaciones",
    help: "Cambios por revisar",
    icon: ClipboardList,
  },
  {
    id: "usuarios",
    label: "Personas",
    help: "Cuentas del equipo",
    icon: Users,
  },
  {
    id: "permisos",
    label: "Roles y permisos",
    help: "Acceso del Supervisor",
    icon: ShieldCheck,
  },
  {
    id: "empresas",
    label: "Empresas",
    help: "Convenios de libranza",
    icon: Building2,
  },
  {
    id: "reglas",
    label: "Reglas financieras",
    help: "Tasas y condiciones",
    icon: Settings,
  },
  {
    id: "organizacion",
    label: "Datos del fondo",
    help: "Identificación institucional",
    icon: ShieldCheck,
  },
  {
    id: "auditoria",
    label: "Bitácora",
    help: "Actividad registrada",
    icon: FileText,
  },
];

export function SuperadminHub({
  csrf,
  go,
  initialSection = "resumen",
}: {
  csrf: string;
  go: (view: View) => void;
  initialSection?: AdminSection;
}) {
  const [section, setSection] = useState<AdminSection>(initialSection);
  return (
    <div className="page superadmin-page">
      <Heading
        eyebrow="CONTROL DEL FONDO"
        title="Centro de control"
        text="Administra accesos, revisa cambios y consulta las reglas de FEGCON."
      />
      <nav
        className="admin-tabs admin-tabs-complete"
        aria-label="Secciones de administración"
      >
        {adminSections.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              title={item.help}
              className={section === item.id ? "active" : ""}
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => setSection(item.id)}
            >
              <span className="admin-tab-icon">
                <Icon />
              </span>
              <span className="admin-tab-copy">
                <b>{item.label}</b>
                <small>{item.help}</small>
              </span>
            </button>
          );
        })}
      </nav>
      {section === "resumen" && (
        <AdminOverview go={go} setSection={setSection} />
      )}
      {section === "aprobaciones" && (
        <ApprovalRequestsPanel csrf={csrf} role="superadmin" />
      )}
      {section === "usuarios" && <UsersPanel csrf={csrf} />}
      {section === "permisos" && <RolePermissionsPanel csrf={csrf} />}
      {section === "empresas" && (
        <CompaniesPanel csrf={csrf} role="superadmin" go={go} />
      )}
      {section === "reglas" && (
        <BusinessRulesPanel csrf={csrf} role="superadmin" embedded />
      )}
      {section === "organizacion" && <SettingsPanel csrf={csrf} embedded />}
      {section === "auditoria" && <AdminAuditPanel />}
    </div>
  );
}

export function OperatorHub({
  csrf,
  initialSection = "reglas",
}: {
  csrf: string;
  initialSection?: "reglas" | "solicitudes";
}) {
  const canSeeRules = useCapability("rules", "view");
  const canSeeRequests = useCapability("approvals", "view");
  const [section, setSection] = useState<"reglas" | "solicitudes">(
    initialSection,
  );
  const currentSection =
    section === "reglas" && !canSeeRules
      ? "solicitudes"
      : section === "solicitudes" && !canSeeRequests
        ? "reglas"
        : section;
  return (
    <div className="page superadmin-page">
      <Heading
        eyebrow="AYUDA PARA LA OPERACIÓN"
        title={
          canSeeRules && canSeeRequests
            ? "Reglas y solicitudes"
            : canSeeRules
              ? "Reglas del fondo"
              : "Mis solicitudes"
        }
        text="Consulta la información y las tareas disponibles para tu perfil."
      />
      {(canSeeRules || canSeeRequests) && (
        <nav
          className="admin-tabs admin-tabs-compact"
          aria-label="Ayuda para la operación"
        >
          {canSeeRules && (
            <button
              className={currentSection === "reglas" ? "active" : ""}
              aria-current={currentSection === "reglas" ? "page" : undefined}
              onClick={() => setSection("reglas")}
            >
              <b>Reglas del fondo</b>
              <small>Condiciones vigentes</small>
            </button>
          )}
          {canSeeRequests && (
            <button
              className={currentSection === "solicitudes" ? "active" : ""}
              aria-current={
                currentSection === "solicitudes" ? "page" : undefined
              }
              onClick={() => setSection("solicitudes")}
            >
              <b>Mis solicitudes</b>
              <small>Estado de mis cambios</small>
            </button>
          )}
        </nav>
      )}
      {currentSection === "reglas" && canSeeRules ? (
        <BusinessRulesPanel csrf={csrf} role="operador" embedded />
      ) : canSeeRequests ? (
        <ApprovalRequestsPanel csrf={csrf} role="operador" />
      ) : (
        <div className="empty-state">
          No hay secciones disponibles para este perfil.
        </div>
      )}
    </div>
  );
}

export function AdminOverview({
  go,
  setSection,
}: {
  go: (view: View) => void;
  setSection: (section: AdminSection) => void;
}) {
  const [summary, setSummary] = useState({
    associates: 0,
    affiliations: 0,
    receivables: 0,
    payments: 0,
    approvals: 0,
    operators: 0,
    companies: 0,
    organizationReady: false,
    usuryRateReady: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch("/api/?action=dashboard", { credentials: "same-origin" }).then(
        (response) => (response.ok ? readJson(response) : Promise.reject()),
      ),
      apiFetch("/api/?action=approval-requests", {
        credentials: "same-origin",
      }).then((response) =>
        response.ok ? readJson(response) : Promise.reject(),
      ),
      apiFetch("/api/?action=users", { credentials: "same-origin" }).then(
        (response) => (response.ok ? readJson(response) : Promise.reject()),
      ),
      apiFetch("/api/?action=companies", { credentials: "same-origin" }).then(
        (response) => (response.ok ? readJson(response) : Promise.reject()),
      ),
      apiFetch("/api/?action=business-rules", {
        credentials: "same-origin",
      }).then((response) =>
        response.ok ? readJson(response) : Promise.reject(),
      ),
      apiFetch("/api/?action=settings", { credentials: "same-origin" }).then(
        (response) => (response.ok ? readJson(response) : Promise.reject()),
      ),
    ])
      .then(
        ([dashboard, requests, users, companies, businessRules, settings]) => {
          if (cancelled) return;
          const metrics = dashboard.metrics || {};
          setSummary({
            associates: Number(metrics.asociados || 0),
            affiliations: Number(metrics.afiliaciones_pendientes || 0),
            receivables: Number(metrics.cartera_abierta || 0),
            payments: Number(metrics.pagos_aplicados || 0),
            approvals: (requests.requests || []).filter(
              (request: ApiJson) => request.status === "pendiente",
            ).length,
            operators: (users.users || []).filter(
              (user: ApiJson) =>
                user.role === "operador" && Number(user.active) === 1,
            ).length,
            companies: (companies.companies || []).length,
            organizationReady: Boolean(
              settings.settings?.organization?.name &&
              settings.settings?.organization?.nit,
            ),
            usuryRateReady:
              businessRules.rules?.late_interest?.usury_rate_percent != null,
          });
        },
      )
      .catch(() => {
        if (!cancelled)
          setError(
            "No pudimos consultar los datos del sistema. Recarga esta página o verifica la conexión.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);
  const setupSteps = [
    {
      label: "Completar identificación del fondo",
      detail: summary.organizationReady
        ? "Nombre y NIT registrados."
        : "Registra el nombre y el NIT de FEGCON.",
      ready: summary.organizationReady,
      required: true,
      action: () => setSection("organizacion"),
      link: "Completar datos",
    },
    {
      label: "Crear acceso del Operador",
      detail: summary.operators
        ? `${summary.operators} cuenta${summary.operators === 1 ? "" : "s"} activa${summary.operators === 1 ? "" : "s"}`
        : "Crea el acceso de quien apoyará la operación diaria.",
      ready: summary.operators > 0,
      required: true,
      action: () => setSection("usuarios"),
      link: "Crear acceso",
    },
    {
      label: "Registrar una empresa de libranza",
      detail: summary.companies
        ? `${summary.companies} empresa${summary.companies === 1 ? "" : "s"} activa${summary.companies === 1 ? "" : "s"}`
        : "Solo hace falta si prepararás cobros de nómina por libranza.",
      ready: summary.companies > 0,
      required: false,
      action: () => setSection("empresas"),
      link: "Registrar empresa",
    },
    {
      label: "Registrar la tasa de usura del mes",
      detail: summary.usuryRateReady
        ? "La tasa vigente ya está registrada."
        : "Configúrala cuando vayas a calcular intereses de mora.",
      ready: summary.usuryRateReady,
      required: false,
      action: () => setSection("reglas"),
      link: "Configurar tasa",
    },
    {
      label: "Registrar el primer asociado",
      detail: summary.associates
        ? `${summary.associates} asociado${summary.associates === 1 ? "" : "s"} activo${summary.associates === 1 ? "" : "s"}`
        : summary.affiliations
          ? `${summary.affiliations} solicitud${summary.affiliations === 1 ? "" : "es"} pendiente${summary.affiliations === 1 ? "" : "s"}; apruébala para activar al asociado.`
          : "Registra a la persona para comenzar las operaciones del fondo.",
      ready: summary.associates > 0,
      required: true,
      action: () => go(summary.affiliations ? "afiliaciones" : "asociados"),
      link: summary.affiliations
        ? "Revisar afiliaciones"
        : "Registrar asociado",
    },
  ];
  const requiredSteps = setupSteps.filter((step) => step.required);
  const optionalSteps = setupSteps.filter((step) => !step.required);
  const completedSetup = requiredSteps.filter((step) => step.ready).length;
  const setupProgress = Math.round(
    (completedSetup / requiredSteps.length) * 100,
  );
  const nextStep = requiredSteps.find((step) => !step.ready);
  return (
    <div className="admin-overview">
      <section className="admin-stat-grid" aria-label="Indicadores ejecutivos">
        <AdminStat
          label="Asociados activos"
          value={loading || error ? "—" : String(summary.associates)}
          icon={Users}
          onClick={() => go("asociados")}
        />
        <AdminStat
          label="Afiliaciones pendientes"
          value={loading || error ? "—" : String(summary.affiliations)}
          icon={ClipboardList}
          onClick={() => go("afiliaciones")}
        />
        <AdminStat
          label="Cambios por revisar"
          value={loading || error ? "—" : String(summary.approvals)}
          icon={ShieldCheck}
          onClick={() => setSection("aprobaciones")}
        />
        <AdminStat
          label="Cartera registrada"
          value={loading || error ? "—" : money(summary.receivables)}
          icon={Banknote}
          onClick={() => go("cartera")}
        />
        <AdminStat
          label="Pagos aplicados"
          value={loading || error ? "—" : money(summary.payments)}
          icon={CreditCard}
          onClick={() => go("pagos")}
        />
        <AdminStat
          label="Supervisores activos"
          value={loading || error ? "—" : String(summary.operators)}
          icon={Users}
          onClick={() => setSection("usuarios")}
        />
      </section>
      <section
        className={`admin-welcome ${summary.associates || summary.affiliations ? "has-data" : "is-empty"}`}
      >
        <div className="admin-welcome-copy">
          <p>ESTADO DE PREPARACIÓN</p>
          <h2>
            {loading
              ? "Consultando el sistema…"
              : error
                ? "No pudimos leer la configuración"
                : nextStep
                  ? "Completa la preparación básica"
                  : "El fondo está listo para operar"}
          </h2>
          <small>
            {loading
              ? "Estamos leyendo el estado guardado."
              : error
                ? "Revisa la conexión e inténtalo de nuevo para ver el estado real."
                : nextStep
                  ? "Completa los pasos esenciales para que el equipo pueda comenzar."
                  : "Los accesos y datos esenciales están configurados. La actividad del fondo se actualizará aquí."}
          </small>
        </div>
        {!loading && !error && (
          <div
            className="admin-readiness"
            aria-label={`Preparación básica: ${completedSetup} de ${requiredSteps.length} pasos`}
          >
            <div>
              <b>
                {completedSetup}
                <span>/{requiredSteps.length}</span>
              </b>
              <small>pasos esenciales</small>
            </div>
            <div
              className="admin-progress-track"
              role="progressbar"
              aria-valuenow={setupProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Preparación del fondo"
            >
              <i style={{ width: `${setupProgress}%` }} />
            </div>
          </div>
        )}
        {nextStep && (
          <Button
            className="violet-button"
            disabled={loading || Boolean(error)}
            onClick={nextStep.action}
          >
            <ArrowUpRight />
            {nextStep.link}
          </Button>
        )}
      </section>
      {error && (
        <div
          className="auth-error flex items-center justify-between gap-3"
          role="alert"
        >
          <span>{error}</span>
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true);
              setRetry((value) => value + 1);
            }}
          >
            Reintentar
          </Button>
        </div>
      )}
      <section className="admin-next-steps">
        <div className="admin-panel-heading">
          <div>
            <p>PRIMEROS PASOS</p>
            <h2>Deja el espacio listo para el equipo</h2>
          </div>
          <small>
            {loading
              ? "Consultando estado…"
              : error
                ? "Estado no disponible"
                : `${completedSetup}/${requiredSteps.length} pasos esenciales`}
          </small>
        </div>
        <div className="admin-step-grid">
          {requiredSteps.map((step, index) => (
            <button
              key={step.label}
              className={step.ready ? "is-complete" : "is-next"}
              disabled={loading || Boolean(error)}
              onClick={step.action}
              aria-label={`${loading || error ? "Por verificar" : step.ready ? "Completado" : "Pendiente"}: ${step.label}`}
            >
              <span>
                {step.ready ? <Check /> : String(index + 1).padStart(2, "0")}
              </span>
              <b>{step.label}</b>
              <small>{step.detail}</small>
              <em>
                {step.ready ? "Completado · revisar" : step.link}{" "}
                <ChevronRight />
              </em>
            </button>
          ))}
        </div>
        {optionalSteps.length > 0 && (
          <details className="admin-optional-setup">
            <summary>
              Configuración según necesidad{" "}
              <small>
                {loading || error
                  ? "Estado no disponible"
                  : `${optionalSteps.filter((step) => step.ready).length} de ${optionalSteps.length} listas`}
              </small>
            </summary>
            <div className="admin-step-grid">
              {optionalSteps.map((step) => (
                <button
                  key={step.label}
                  className={step.ready ? "is-complete" : "is-optional"}
                  disabled={loading || Boolean(error)}
                  onClick={step.action}
                  aria-label={`${step.ready ? "Completado" : "Opcional"}: ${step.label}`}
                >
                  <span>{step.ready ? <Check /> : <ChevronRight />}</span>
                  <b>{step.label}</b>
                  <small>{step.detail}</small>
                  <em>
                    {step.ready ? "Configurado" : step.link} <ChevronRight />
                  </em>
                </button>
              ))}
            </div>
          </details>
        )}
      </section>
      <section className="admin-quick-links">
        <button onClick={() => setSection("aprobaciones")}>
          <ClipboardList />
          <span>
            <b>Revisar solicitudes</b>
            <small>
              {loading || error
                ? "Consulta pendiente de verificar"
                : summary.approvals
                  ? `${summary.approvals} esperan tu decisión`
                  : "No hay cambios pendientes"}
            </small>
          </span>
          <ChevronRight />
        </button>
        <button onClick={() => setSection("organizacion")}>
          <Building2 />
          <span>
            <b>Datos del fondo</b>
            <small>Nombre, NIT y correo institucional</small>
          </span>
          <ChevronRight />
        </button>
        <button onClick={() => go("reportes")}>
          <FileText />
          <span>
            <b>Consultar reportes</b>
            <small>Ver registros guardados por módulo</small>
          </span>
          <ChevronRight />
        </button>
      </section>
    </div>
  );
}

export function AdminStat({
  label,
  value,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button className="admin-stat" onClick={onClick}>
      <span className="admin-stat-icon">
        <Icon />
      </span>
      <small>{label}</small>
      <b>{value}</b>
      <span className="admin-stat-link">
        Ver detalle <ChevronRight />
      </span>
    </button>
  );
}

export type AuditEntry = {
  id: number;
  entity: string;
  entity_id: number;
  action: string;
  detail: string;
  created_at: string;
  user_name?: string;
};

export function AdminAuditPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/?action=audit-log", {
        credentials: "same-origin",
      });
      const data = (await readJson(response)) as {
        entries?: AuditEntry[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || "No fue posible consultar la bitácora.");
      setEntries(data.entries || []);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No pudimos cargar la actividad.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const filtered = entries.filter((entry) =>
    `${entry.user_name || ""} ${entry.entity} ${entry.action} ${entry.detail}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <section className="data-panel mt-6">
      <div className="table-tools audit-tools">
        <div>
          <b>Bitácora de actividad</b>
          <small>
            Altas, movimientos y decisiones registradas por el sistema.
          </small>
        </div>
        <Input
          aria-label="Filtrar actividad"
          placeholder="Filtrar por usuario o acción"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button
          variant="outline"
          onClick={() => void load()}
          disabled={loading}
        >
          Actualizar
        </Button>
      </div>
      {loading ? (
        <div className="empty-state">Cargando actividad…</div>
      ) : error ? (
        <div className="empty-state">
          <b>No se pudo abrir la bitácora</b>
          <small>{error}</small>
          <Button variant="outline" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      ) : filtered.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>
                  {new Date(entry.created_at).toLocaleString("es-CO")}
                </TableCell>
                <TableCell>{entry.user_name || "Usuario retirado"}</TableCell>
                <TableCell>
                  {entry.entity.replaceAll("_", " ")} · #{entry.entity_id}
                </TableCell>
                <TableCell>
                  <StatusFor value={entry.action} />
                </TableCell>
                <TableCell>{entry.detail || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="empty-state">
          <b>{query ? "No hay coincidencias" : "La bitácora aún está vacía"}</b>
          <small>
            {query
              ? "Prueba con otro usuario o acción."
              : "Las operaciones y decisiones del equipo aparecerán aquí."}
          </small>
        </div>
      )}
    </section>
  );
}

export type ApprovalRequest = {
  id: number;
  operation: string;
  summary: string;
  payload?: Record<string, unknown>;
  status: string;
  created_at: string;
  requested_by_name?: string;
};

export type ApprovalDecision = {
  request: ApprovalRequest;
  decision: "aprobada" | "rechazada";
};

export const approvalOperationNames: Record<string, string> = {
  associate_create: "Alta de asociado",
  associate_update: "Edición de asociado",
  associate_retire: "Retiro de asociado",
  promissory_document_create: "Nuevo documento de pagaré",
  promissory_document_delete: "Retiro de documento de pagaré",
  credit_document_create: "Soporte de solicitud de crédito",
  credit_document_delete: "Retiro de soporte de crédito",
  savings_transaction: "Movimiento de ahorro o aporte",
  credit_application: "Solicitud de crédito",
  credit_decision: "Decisión sobre crédito",
  affiliation_create: "Nueva afiliación",
  affiliation_decision: "Decisión sobre afiliación",
  payment_create: "Registro de pago",
  payroll_collection_create: "Relación de cobro de nómina",
  payroll_item_create: "Concepto de nómina",
  payroll_item_reconcile: "Conciliación de nómina",
  payroll_item_void: "Retiro de concepto de nómina",
  payroll_collection_status: "Etapa de relación de nómina",
  promissory_note_create: "Registro de pagaré",
  receivable_create: "Obligación de cartera",
  catalog_item_create: "Nuevo convenio",
  company_create: "Registro de empresa",
};

export const approvalFieldNames: Record<string, string> = {
  id: "Identificador",
  name: "Asociado",
  firstName: "Nombres",
  lastName: "Apellidos",
  documentType: "Tipo de documento",
  documentNumber: "Documento",
  document_number: "Documento",
  company_name: "Empresa",
  company_id: "Empresa (ID)",
  collection_date: "Fecha de cobro",
  payroll_collection_id: "Relación de nómina",
  charge_type: "Tipo de cobro",
  collected_amount: "Valor recaudado",
  tax_id: "NIT de empresa",
  contact_name: "Contacto",
  contact_email: "Correo de contacto",
  document_id: "Documento digital",
  note_id: "Pagaré",
  credit_application_id: "Solicitud de crédito",
  original_name: "Nombre del archivo",
  mime_type: "Formato",
  byte_size: "Peso en bytes",
  email: "Correo",
  phone: "Celular",
  company: "Empresa",
  associate_id: "Asociado",
  product_id: "Producto",
  movement_type: "Movimiento",
  amount: "Valor",
  term_months: "Plazo en meses",
  purpose: "Destino",
  credit_channel: "Modalidad",
  required_cosigners: "Codeudores requeridos",
  period_label: "Período",
  expected_amount: "Valor esperado",
  note_number: "Número de pagaré",
  reference: "Referencia",
  due_date: "Vencimiento",
  concept: "Concepto",
  received_on: "Fecha de pago",
  status: "Estado solicitado",
  category: "Tipo de registro",
  label: "Nombre",
};

export function approvalValue(key: string, value: unknown): string {
  if (value == null || value === "") return "—";
  if (
    ["amount", "expected_amount", "collected_amount"].includes(key) &&
    Number.isFinite(Number(value))
  )
    return money(Number(value));
  if (key === "byte_size" && Number.isFinite(Number(value)))
    return `${(Number(value) / 1024).toFixed(0)} KB`;
  if (typeof value === "number" && /(^id$|_id$)/.test(key)) return `#${value}`;
  if (Array.isArray(value))
    return value.map((entry) => String(entry)).join(", ");
  if (typeof value === "object")
    return Object.entries(value as Record<string, unknown>)
      .map(
        ([nestedKey, nestedValue]) =>
          `${approvalFieldNames[nestedKey] || nestedKey.replaceAll("_", " ")}: ${approvalValue(nestedKey, nestedValue)}`,
      )
      .join(" · ");
  return String(value);
}

export function ApprovalRequestsPanel({
  csrf,
  role,
}: {
  csrf: string;
  role: string;
}) {
  const [rows, setRows] = useState<ApprovalRequest[]>([]);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<ApprovalDecision | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState(
    role === "superadmin" ? "pendiente" : "todos",
  );

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await apiFetch("/api/?action=approval-requests", {
        credentials: "same-origin",
      });
      if (!response.ok)
        throw new Error("No fue posible consultar las solicitudes.");
      const data = (await readJson(response)) as {
        requests?: ApprovalRequest[];
      };
      setRows(data.requests || []);
    } catch {
      setLoadError(
        "No pudimos cargar las solicitudes. Revisa tu conexión e inténtalo de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/?action=approval-requests", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("No fue posible consultar las solicitudes.");
        return (await readJson(response)) as { requests?: ApprovalRequest[] };
      })
      .then((data) => {
        if (!cancelled) setRows(data.requests || []);
      })
      .catch(() => {
        if (!cancelled)
          setLoadError(
            "No pudimos cargar las solicitudes. Revisa tu conexión e inténtalo de nuevo.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const decide = async () => {
    if (!decision) return;
    setSaving(true);
    try {
      const response = await apiFetch("/api/?action=approval-requests", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({
          id: decision.request.id,
          decision: decision.decision,
        }),
      });
      const data = (await readJson(response)) as {
        message?: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(data.error || "No fue posible procesar la solicitud.");
      setNotice(data.message || "Solicitud actualizada.");
      setDecision(null);
      await load();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No fue posible procesar la solicitud.",
      );
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = rows.filter((row) => row.status === "pendiente").length;
  const isSuperadmin = role === "superadmin";
  const filteredRows =
    filter === "todos" ? rows : rows.filter((row) => row.status === filter);
  const payloadEntries = Object.entries(decision?.request.payload || {}).filter(
    ([key]) => !["password", "password_hash"].includes(key),
  );

  return (
    <>
      <section className="data-panel mt-6">
        <div className="table-tools">
          <div>
            <b>{isSuperadmin ? "Cambios por revisar" : "Mis solicitudes"}</b>
            <small>
              {isSuperadmin
                ? "Revisa cada detalle antes de autorizar su aplicación."
                : "Sigue el estado de los cambios que enviaste."}
            </small>
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="approval-filter">
              Filtrar solicitudes
            </label>
            <select
              id="approval-filter"
              className="rounded-md border p-2 text-sm"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="pendiente">Pendientes ({pendingCount})</option>
              <option value="todos">Todas</option>
              <option value="aprobada">Aprobadas</option>
              <option value="rechazada">Rechazadas</option>
            </select>
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
            >
              Actualizar
            </Button>
          </div>
        </div>
        {notice && (
          <div className="px-6 pt-4" role="status">
            {notice}
          </div>
        )}
        {loadError ? (
          <div className="empty-state">
            <b>No se pudo abrir la bandeja</b>
            <small>{loadError}</small>
            <Button variant="outline" onClick={() => void load()}>
              Reintentar
            </Button>
          </div>
        ) : loading ? (
          <div className="empty-state">Cargando solicitudes…</div>
        ) : filteredRows.length ? (
          <div className="approval-list">
            {filteredRows.map((row) => (
              <article className="approval-item" key={row.id}>
                <div className="approval-main">
                  <span className="approval-type">
                    {approvalOperationNames[row.operation] ||
                      "Cambio solicitado"}
                  </span>
                  <b>{row.summary}</b>
                  <small>
                    {row.requested_by_name ? `${row.requested_by_name} · ` : ""}
                    {new Date(row.created_at).toLocaleString("es-CO")} ·{" "}
                    {row.status.replaceAll("_", " ")}
                  </small>
                  {isSuperadmin && row.payload && (
                    <dl className="approval-details">
                      {Object.entries(row.payload)
                        .filter(
                          ([key]) =>
                            !["password", "password_hash"].includes(key),
                        )
                        .map(([key, value]) => (
                          <div key={key}>
                            <dt>
                              {approvalFieldNames[key] ||
                                key.replaceAll("_", " ")}
                            </dt>
                            <dd>{approvalValue(key, value)}</dd>
                          </div>
                        ))}
                    </dl>
                  )}
                  {isSuperadmin &&
                    row.status === "pendiente" &&
                    row.operation === "promissory_document_create" &&
                    Number(row.payload?.document_id) > 0 && (
                      <a
                        className="text-button mt-3 inline-flex"
                        href={privateDocumentHref(
                          "/api/?action=promissory-document-file&id=" +
                            row.payload?.document_id,
                        )}
                      >
                        Descargar archivo privado para revisar
                      </a>
                    )}
                  {isSuperadmin &&
                    row.status === "pendiente" &&
                    row.operation === "credit_document_create" &&
                    Number(row.payload?.document_id) > 0 && (
                      <a
                        className="text-button mt-3 inline-flex"
                        href={privateDocumentHref(
                          "/api/?action=credit-document-file&id=" +
                            row.payload?.document_id,
                        )}
                      >
                        Descargar soporte privado para revisar
                      </a>
                    )}
                </div>
                {isSuperadmin && row.status === "pendiente" && (
                  <div className="approval-actions">
                    <Button
                      className="violet-button"
                      onClick={() =>
                        setDecision({ request: row, decision: "aprobada" })
                      }
                    >
                      Revisar y aprobar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setDecision({ request: row, decision: "rechazada" })
                      }
                    >
                      Rechazar
                    </Button>
                  </div>
                )}
                {row.status !== "pendiente" && <StatusFor value={row.status} />}
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <b>
              {filter !== "todos" && rows.length
                ? "No hay solicitudes en este estado"
                : isSuperadmin
                  ? "No tienes cambios pendientes"
                  : "Todavía no has enviado cambios"}
            </b>
            <small>
              {filter !== "todos" && rows.length
                ? "Elige otro filtro para consultar el historial."
                : isSuperadmin
                  ? "Cuando haya cambios pendientes, podrás revisarlos y decidir aquí."
                  : "Las operaciones que requieren autorización aparecerán aquí con su estado."}
            </small>
          </div>
        )}
      </section>
      <Dialog
        open={Boolean(decision)}
        onOpenChange={(open) => {
          if (!open && !saving) setDecision(null);
        }}
      >
        <DialogContent className="approval-dialog">
          <DialogHeader>
            <p className="dialog-eyebrow">REVISIÓN DE CAMBIO</p>
            <DialogTitle>
              {decision?.decision === "aprobada"
                ? "¿Aprobar y aplicar este cambio?"
                : "¿Rechazar esta solicitud?"}
            </DialogTitle>
            <DialogDescription>
              {decision?.request.summary}. Esta decisión quedará registrada en
              la auditoría del sistema.
            </DialogDescription>
          </DialogHeader>
          {decision && (
            <div className="approval-confirm">
              <b>
                {approvalOperationNames[decision.request.operation] ||
                  "Cambio solicitado"}
              </b>
              {payloadEntries.length > 0 && (
                <dl className="approval-details">
                  {payloadEntries.map(([key, value]) => (
                    <div key={key}>
                      <dt>
                        {approvalFieldNames[key] || key.replaceAll("_", " ")}
                      </dt>
                      <dd>{approvalValue(key, value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={saving}
              onClick={() => setDecision(null)}
            >
              Volver
            </Button>
            <Button
              className="violet-button"
              disabled={saving}
              onClick={() => void decide()}
            >
              {saving
                ? "Procesando…"
                : decision?.decision === "aprobada"
                  ? "Confirmar aprobación"
                  : "Confirmar rechazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SettingsPanel({
  csrf,
  embedded = false,
}: {
  csrf: string;
  embedded?: boolean;
}) {
  const [org, setOrg] = useState({ name: "FEGCON", nit: "", email: "" }),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/?action=settings", {
        credentials: "same-origin",
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(
          data.error || "No fue posible consultar los datos del fondo.",
        );
      if (data?.settings?.organization)
        setOrg({
          name: data.settings.organization.name || "FEGCON",
          nit: data.settings.organization.nit || "",
          email: data.settings.organization.email || "",
        });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible consultar los datos del fondo.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch("/api/?action=settings", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ organization: org }),
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(data.error || "No fue posible guardar los datos.");
      setNotice("Datos institucionales guardados.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible guardar los datos.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className={embedded ? "settings-content" : "page"}>
      {!embedded && (
        <Heading
          eyebrow="ADMINISTRACIÓN"
          title="Datos del fondo"
          text="Información que identifica a FEGCON en el sistema."
        />
      )}
      <form className="data-panel" onSubmit={save}>
        <div className="table-tools">
          <div>
            <b>Identificación institucional</b>
            <small>Se muestra en las comunicaciones del sistema.</small>
          </div>
          {!loading && (
            <Button variant="outline" type="button" onClick={() => void load()}>
              Actualizar
            </Button>
          )}
        </div>
        {error && (
          <div className="px-6 pt-4">
            <div
              className="auth-error flex items-center justify-between gap-3"
              role="alert"
            >
              <span>{error}</span>
              <Button
                variant="outline"
                type="button"
                onClick={() => void load()}
                disabled={loading}
              >
                Reintentar
              </Button>
            </div>
          </div>
        )}
        <div className="p-6 grid gap-4 md:grid-cols-2">
          <label>
            Nombre del fondo
            <Input
              value={org.name}
              onChange={(event) => setOrg({ ...org, name: event.target.value })}
              required
              disabled={loading || saving || Boolean(error)}
            />
          </label>
          <label>
            NIT
            <Input
              value={org.nit}
              onChange={(event) => setOrg({ ...org, nit: event.target.value })}
              disabled={loading || saving || Boolean(error)}
            />
          </label>
          <label className="md:col-span-2">
            Correo institucional
            <Input
              type="email"
              value={org.email}
              onChange={(event) =>
                setOrg({ ...org, email: event.target.value })
              }
              disabled={loading || saving || Boolean(error)}
            />
          </label>
        </div>
        <div className="p-6 pt-0 flex items-center gap-4">
          <Button
            className="violet-button"
            type="submit"
            disabled={loading || saving || Boolean(error)}
          >
            {loading
              ? "Cargando…"
              : saving
                ? "Guardando…"
                : "Guardar datos del fondo"}
          </Button>
          {notice && <small role="status">{notice}</small>}
        </div>
      </form>
    </div>
  );
}
