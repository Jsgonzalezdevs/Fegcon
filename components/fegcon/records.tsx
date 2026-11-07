"use client";

import { RecordFormPanel } from "./record-workflow";

import { AssociateActivity } from "./associate-activity";

import { AssociateSelect } from "./associate-select";

import { apiFetch } from "@/lib/fegcon-api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsv } from "@/lib/csv";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Banknote,
  Building2,
  CreditCard,
  HandCoins,
  Plus,
  ReceiptText,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import {
  useCallback,
  useContext,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { FieldHelp } from "./field-help";

import { FirstActionPanel, Heading } from "@/components/fegcon/associates";
import {
  ApiJson,
  money,
  PermissionContext,
  PermissionSet,
  readJson,
  StatusFor,
  useCapability,
  View,
} from "@/components/fegcon/shared";

export const liveScreens = {
  afiliaciones: {
    eyebrow: "VINCULACIÓN",
    title: "Afiliaciones",
    text: "Solicitudes de afiliación registradas en el sistema.",
    action: "Nueva solicitud",
    heads: [
      "Solicitante",
      "Empresa",
      "Fecha de solicitud",
      "Fecha de aceptación",
      "Documentos",
      "Estado",
    ],
    endpoint: "affiliations",
    key: "requests",
  },
  cartera: {
    eyebrow: "SEGUIMIENTO",
    title: "Cartera",
    text: "Consulta vencimientos, días en mora e interés estimado con la tasa de usura del mes.",
    action: "Nueva obligación",
    heads: [
      "Asociado",
      "Obligación",
      "Vencimiento",
      "Capital de cuota",
      "Días en mora",
      "Mora estimada",
      "Estado",
    ],
    endpoint: "receivables",
    key: "receivables",
  },
  convenios: {
    eyebrow: "BENEFICIOS",
    title: "Convenios",
    text: "Convenios que FEGCON haya registrado.",
    action: "Nuevo convenio",
    heads: ["Convenio", "Beneficio", "Vigencia", "Estado"],
    endpoint: "catalog&category=convenio",
    key: "items",
  },
  pagos: {
    eyebrow: "RECAUDO",
    title: "Pagos",
    text: "Pagos registrados en la base de datos.",
    action: "Registrar pago",
    heads: ["Fecha", "Asociado", "Concepto", "Valor", "Estado"],
    endpoint: "payments",
    key: "payments",
  },
} as const;
export type LiveScreenView = keyof typeof liveScreens;
export type LiveRow = { id: number | string; cells: string[]; status: string };

export function ListScreen({
  view,
  csrf,
  role,
  go,
}: {
  view: View;
  csrf: string;
  role: string;
  go: (view: View) => void;
}) {
  const screen = liveScreens[view as LiveScreenView];
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const moduleKey =
    view === "afiliaciones"
      ? "affiliations"
      : view === "cartera"
        ? "receivables"
        : view === "pagos"
          ? "payments"
          : "convenios";
  const canManage = useCapability(moduleKey);
  const [rows, setRows] = useState<LiveRow[]>([]),
    [associates, setAssociates] = useState<ApiJson[]>([]),
    [installments, setInstallments] = useState<ApiJson[]>([]),
    [selectedPaymentAssociate, setSelectedPaymentAssociate] = useState(""),
    [selectedInstallment, setSelectedInstallment] = useState(""),
    [associatesLoaded, setAssociatesLoaded] = useState(false),
    [associatesError, setAssociatesError] = useState(""),
    [notice, setNotice] = useState(""),
    [noticeTone, setNoticeTone] = useState<"success" | "error" | "info">(
      "success",
    ),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [decisionBusy, setDecisionBusy] = useState<number | null>(null),
    [formOpen, setFormOpen] = useState(false);
  const filteredRows = rows.filter(
    (row) =>
      (!statusFilter || row.status === statusFilter) &&
      `${row.cells.join(" ")} ${row.status}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes(
          search
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim(),
        ),
  );
  const statuses = [...new Set(rows.map((row) => row.status))];
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(`/api/?action=${screen.endpoint}`, {
        credentials: "same-origin",
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(
          data.error || "No fue posible consultar los registros.",
        );
      const source = data[screen.key] || [];
      const mapped: LiveRow[] = source.map((row: ApiJson) => {
        if (view === "afiliaciones")
          return {
            id: row.id,
            cells: [
              `${row.first_name} ${row.last_name}`,
              row.company_name || "Sin empresa",
              new Date(row.created_at).toLocaleDateString("es-CO"),
              row.status === "aprobada" && row.reviewed_at
                ? new Date(row.reviewed_at).toLocaleDateString("es-CO")
                : "—",
              row.documents_status === "completos" ? "Completos" : "Pendientes",
            ],
            status: row.status,
          };
        if (view === "cartera") {
          const days = Number(row.days_overdue || 0);
          return {
            id: row.id,
            cells: [
              `${row.first_name} ${row.last_name}`,
              row.reference,
              row.due_date,
              money(Number(row.amount)),
              `${days} días`,
              days > 0 && row.late_interest == null
                ? "Falta tasa del mes"
                : money(Number(row.late_interest || 0)),
            ],
            status: row.status,
          };
        }
        if (view === "pagos")
          return {
            id: row.id,
            cells: [
              row.received_on,
              `${row.first_name} ${row.last_name}`,
              row.installment_number
                ? `${row.concept} · cuota ${row.installment_number}`
                : row.concept,
              money(Number(row.amount)),
            ],
            status: row.status,
          };
        const payload = row.payload || {};
        return {
          id: row.id,
          cells: [
            row.label,
            payload.benefit || "Sin descripción",
            payload.end_date || "Sin fecha de vencimiento",
          ],
          status: Number(row.active) ? "Activo" : "Inactivo",
        };
      });
      setRows(mapped);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No fue posible consultar los registros.",
      );
    } finally {
      setLoading(false);
    }
  }, [screen, view]);
  const loadAssociates = useCallback(async () => {
    setAssociatesLoaded(false);
    setAssociatesError("");
    try {
      const response = await apiFetch("/api/?action=associates", {
        credentials: "same-origin",
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(
          data.error || "No fue posible consultar los asociados.",
        );
      setAssociates(data.associates || []);
    } catch (reason) {
      setAssociates([]);
      setAssociatesError(
        reason instanceof Error
          ? reason.message
          : "No fue posible consultar los asociados.",
      );
    } finally {
      setAssociatesLoaded(true);
    }
  }, []);
  const loadInstallments = useCallback(async () => {
    try {
      const response = await apiFetch("/api/?action=credit-installments", {
        credentials: "same-origin",
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(
          data.error || "No fue posible consultar cuotas pendientes.",
        );
      setInstallments(data.installments || []);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible consultar cuotas pendientes.",
      );
    }
  }, []);
  const needsAssociate =
    (view === "pagos" || view === "cartera") &&
    associatesLoaded &&
    !associates.length &&
    !associatesError;
  const selectedInstallmentRow = installments.find(
    (item) => Number(item.id) === Number(selectedInstallment),
  );
  const selectedInstallmentBalance = Math.max(
    0,
    Number(selectedInstallmentRow?.total_amount || 0) -
      Number(selectedInstallmentRow?.paid_amount || 0),
  );
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
      if (view === "pagos" || view === "cartera") void loadAssociates();
      if (view === "pagos") void loadInstallments();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, loadAssociates, loadInstallments, view]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const action = screen.endpoint.split("&")[0];
    let payload: Record<string, unknown>;
    if (view === "afiliaciones")
      payload = {
        document_number: form.get("document"),
        first_name: form.get("first"),
        last_name: form.get("last"),
        email: form.get("email"),
        phone: form.get("phone"),
        company: form.get("company"),
        documents_status: "pendientes",
      };
    else if (view === "cartera")
      payload = {
        associate_id: Number(form.get("associate")),
        reference: form.get("reference"),
        due_date: form.get("due_date"),
        amount: Number(form.get("amount")),
      };
    else if (view === "pagos") {
      const installmentId = Number(form.get("credit_installment_id")) || null;
      const installment = installments.find(
        (item) => Number(item.id) === installmentId,
      );
      payload = {
        associate_id: Number(form.get("associate")),
        credit_installment_id: installmentId,
        concept:
          form.get("concept") ||
          (installment
            ? `Cuota ${installment.installment_number} · crédito #${installment.credit_application_id}`
            : "Pago recibido"),
        amount: Number(form.get("amount")),
        reference: form.get("reference"),
        received_on: form.get("received_on"),
      };
    } else
      payload = {
        category: "convenio",
        label: form.get("label"),
        payload: {
          benefit: form.get("benefit"),
          start_date: form.get("start_date"),
          end_date: form.get("end_date"),
        },
      };
    setSaving(true);
    setNotice("");
    setError("");
    try {
      const response = await apiFetch(`/api/?action=${action}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify(payload),
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(data.error || "No fue posible guardar el registro.");
      if (data.pending_approval) {
        setNoticeTone("info");
        setNotice(data.message || "La solicitud se envió a revisión.");
        go("mis_solicitudes");
        return;
      }
      setNoticeTone("success");
      setNotice(data.message || "Registro guardado.");
      formElement.reset();
      setSelectedPaymentAssociate("");
      setSelectedInstallment("");
      setFormOpen(false);
      await load();
      if (view === "pagos") await loadInstallments();
    } catch (cause) {
      setNoticeTone("error");
      setNotice(
        cause instanceof Error
          ? cause.message
          : "No fue posible conectar con el servidor.",
      );
    } finally {
      setSaving(false);
    }
  };
  const decide = async (id: number, status: "aprobada" | "rechazada") => {
    const row = rows.find((item) => Number(item.id) === id);
    const person = row?.cells[0] || `solicitud #${id}`;
    if (
      !window.confirm(
        `${status === "aprobada" ? "Aprobar" : "Rechazar"} la afiliación de ${person}?`,
      )
    )
      return;
    setDecisionBusy(id);
    setNotice("");
    setError("");
    try {
      const response = await apiFetch("/api/?action=affiliations", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ id, status }),
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(data.error || "No fue posible procesar la solicitud.");
      setNoticeTone("success");
      setNotice(data.message || "Solicitud actualizada.");
      await load();
    } catch (cause) {
      setNoticeTone("error");
      setNotice(
        cause instanceof Error
          ? cause.message
          : "No fue posible procesar la solicitud.",
      );
    } finally {
      setDecisionBusy(null);
    }
  };
  return (
    <div className="page">
      <Heading eyebrow={screen.eyebrow} title={screen.title} text={screen.text}>
        {canManage && (
          <Button
            aria-expanded={formOpen}
            aria-controls={`${view}-create`}
            onClick={() =>
              needsAssociate ? go("asociados") : setFormOpen((open) => !open)
            }
            className="violet-button"
            disabled={saving ||
              (view === "pagos" || view === "cartera") &&
              (!associatesLoaded || Boolean(associatesError))
            }
          >
            <Plus />
            {needsAssociate
              ? "Registrar asociado"
              : formOpen
                ? "Cerrar formulario"
                : screen.action}
          </Button>
        )}
      </Heading>
      {view === "convenios" && <AssociateActivity kind="benefits" csrf={csrf} />}
      {notice && (
        <div
          className={`flash-message ${noticeTone}`}
          role={noticeTone === "error" ? "alert" : "status"}
        >
          {notice}
          <button aria-label="Cerrar mensaje" onClick={() => setNotice("")}>
            <X />
          </button>
        </div>
      )}
      {(view === "pagos" || view === "cartera") && associatesError && (
        <FirstActionPanel
          title="No pudimos cargar los asociados"
          detail="Revisa la conexión para verificar a qué persona vincular el movimiento."
          action="Ir a asociados"
          onAction={() => go("asociados")}
          error={associatesError}
          onRetry={() => void loadAssociates()}
        />
      )}
      {needsAssociate && (
        <FirstActionPanel
          title="Registra primero un asociado"
          detail="Los pagos y las obligaciones de cartera siempre deben quedar vinculados a una persona."
          action="Ir a asociados"
          onAction={() => go("asociados")}
        />
      )}
      {canManage &&
        formOpen &&
        !needsAssociate &&
        !(associatesError && (view === "pagos" || view === "cartera")) && (
          <RecordFormPanel id={`${view}-create`} title={screen.action}
            description="Completa los datos y revisa la información antes de guardar."
            busy={saving} onClose={() => setFormOpen(false)}>
            <form className="p-6 grid gap-3 md:grid-cols-2" onSubmit={submit}>
              {view === "afiliaciones" && (
                <>
                  <label>
                    Documento
                    <Input name="document" required />
                  </label>
                  <label>
                    Nombres
                    <Input name="first" required />
                  </label>
                  <label>
                    Apellidos
                    <Input name="last" required />
                  </label>
                  <label>
                    Empresa
                    <Input name="company" />
                  </label>
                  <label>
                    Correo electrónico
                    <Input name="email" type="email" />
                  </label>
                  <label>
                    Celular
                    <Input name="phone" />
                  </label>
                </>
              )}
              {(view === "pagos" || view === "cartera") && (
                <>
                  <label className="md:col-span-2">
                    Asociado
                    <AssociateSelect
                      initialOptions={associates}
                      name="associate"
                      value={
                        view === "pagos" ? selectedPaymentAssociate : undefined
                      }
                      onChange={
                        view === "pagos"
                          ? (event) => {
                              setSelectedPaymentAssociate(event.target.value);
                              setSelectedInstallment("");
                            }
                          : undefined
                      }
                    />
                    {!associates.length && (
                      <small>
                        Registra o aprueba un asociado antes de continuar.
                      </small>
                    )}
                  </label>
                  {view === "pagos" ? (
                    <>
                      <label className="md:col-span-2">
                        Aplicar a cuota de crédito (opcional)
                        <FieldHelp title="¿Cuándo seleccionar una cuota?">
                          Selecciona la cuota si este recaudo corresponde a un
                          crédito. Un pago general no reduce automáticamente el
                          saldo de una cuota.
                        </FieldHelp>
                        <select
                          name="credit_installment_id"
                          className="w-full rounded-md border p-2"
                          value={selectedInstallment}
                          onChange={(event) =>
                            setSelectedInstallment(event.target.value)
                          }
                          disabled={!selectedPaymentAssociate}
                        >
                          <option value="">
                            Pago general (sin cuota de crédito)
                          </option>
                          {installments
                            .filter(
                              (item) =>
                                Number(item.associate_id) ===
                                Number(selectedPaymentAssociate),
                            )
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                Crédito #{item.credit_application_id} · cuota{" "}
                                {item.installment_number} · vence{" "}
                                {item.due_date} · saldo{" "}
                                {money(
                                  Number(item.total_amount) -
                                    Number(item.paid_amount),
                                )}
                              </option>
                            ))}
                        </select>
                        <small>
                          Si eliges una cuota, el pago reduce su saldo
                          pendiente. Puedes registrar abonos parciales.
                        </small>
                      </label>
                      <label>
                        Concepto
                        <Input
                          name="concept"
                          required={!selectedInstallment}
                          placeholder={
                            selectedInstallment
                              ? "Se completa con la cuota seleccionada"
                              : "Describe el concepto del pago"
                          }
                        />
                      </label>
                      <label>
                        Fecha
                        <Input type="date" name="received_on" required />
                      </label>
                    </>
                  ) : (
                    <>
                      <label>
                        Referencia
                        <Input name="reference" required />
                      </label>
                      <label>
                        Vencimiento
                        <Input type="date" name="due_date" required />
                      </label>
                    </>
                  )}
                  <label>
                    Valor
                    <Input
                      name="amount"
                      type="number"
                      min="1"
                      max={
                        selectedInstallment
                          ? selectedInstallmentBalance
                          : undefined
                      }
                      step="1"
                      required
                    />
                    {view === "pagos" && selectedInstallment && (
                      <small>
                        Saldo máximo de esta cuota:{" "}
                        {money(selectedInstallmentBalance)}.
                      </small>
                    )}
                  </label>
                  {view === "pagos" && (
                    <label>
                      Referencia de pago
                      <Input name="reference" />
                    </label>
                  )}
                </>
              )}
              {view === "convenios" && (
                <>
                  <label>
                    Nombre del convenio
                    <Input name="label" required />
                  </label>
                  <label>
                    Beneficio o descripción
                    <Input name="benefit" required />
                  </label>
                  <label>
                    Fecha de inicio
                    <Input name="start_date" type="date" />
                  </label>
                  <label>
                    Vigencia hasta
                    <Input name="end_date" type="date" />
                  </label>
                </>
              )}
              <div className="md:col-span-2">
                <Button
                  className="violet-button"
                  type="submit"
                  disabled={
                    saving ||
                    ((view === "pagos" || view === "cartera") &&
                      (!associatesLoaded || !associates.length))
                  }
                >
                  {saving
                    ? "Guardando…"
                    : role === "operador"
                      ? "Enviar para revisión"
                      : "Guardar registro"}
                </Button>
              </div>
            </form>
          </RecordFormPanel>
        )}
      {error && (
        <div className="auth-error" role="alert">
          {error}
        </div>
      )}
      <section className="data-panel">
        <div className="table-tools">
          <div>
            <b>Registros</b>
            <small>
              {loading
                ? "Consultando…"
                : error
                  ? "Consulta pendiente de verificar"
                  : `${filteredRows.length} de ${rows.length} registros cargados`}
            </small>
          </div>
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
          >
            Actualizar
          </Button>
          <Button
            variant="outline"
            disabled={loading || Boolean(error) || !filteredRows.length}
            onClick={() =>
              downloadCsv(
                view,
                [...screen.heads],
                filteredRows.map((row) => [
                  ...row.cells,
                  row.status.replaceAll("_", " "),
                ]),
              )
            }
          >
            Descargar CSV
          </Button>
        </div>
        <div className="record-filters">
          <label>
            Buscar en registros cargados
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre, referencia o concepto"
              disabled={loading || Boolean(error)}
            />
          </label>
          <label>
            Estado
            <select
              value={statusFilter}
              disabled={loading || Boolean(error)}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">Todos los estados</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          {(search || statusFilter) && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
              }}
            >
              Limpiar filtros
            </Button>
          )}
        </div>
        {loading ? (
          <div className="empty-state">Cargando registros…</div>
        ) : error ? (
          <div className="empty-state">
            <b>No se pudieron cargar los registros</b>
            <small>{error}</small>
            <Button variant="outline" onClick={() => void load()}>
              Reintentar
            </Button>
          </div>
        ) : rows.length && !filteredRows.length ? (
          <div className="empty-state">
            <b>No hay coincidencias</b>
            <small>Prueba con otro nombre o elimina el filtro de estado.</small>
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
              }}
            >
              Mostrar todos los registros
            </Button>
          </div>
        ) : filteredRows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                {screen.heads.map((head) => (
                  <TableHead key={head}>{head}</TableHead>
                ))}
                {view === "afiliaciones" && role === "superadmin" && (
                  <TableHead>Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((row) => (
                <TableRow key={row.id} className="data-row">
                  {row.cells.map((cell, index) => (
                    <TableCell
                      className={index === 0 ? "font-semibold" : ""}
                      key={`${row.id}-${index}`}
                    >
                      {cell}
                    </TableCell>
                  ))}
                  <TableCell>
                    <StatusFor value={row.status.replaceAll("_", " ")} />
                  </TableCell>
                  {view === "afiliaciones" && role === "superadmin" && (
                    <TableCell>
                      {row.status === "en_revision" ? (
                        <div className="flex gap-2">
                          <Button
                            disabled={decisionBusy !== null}
                            onClick={() =>
                              void decide(Number(row.id), "aprobada")
                            }
                          >
                            {decisionBusy === Number(row.id)
                              ? "Procesando…"
                              : "Aprobar"}
                          </Button>
                          <Button
                            variant="outline"
                            disabled={decisionBusy !== null}
                            onClick={() =>
                              void decide(Number(row.id), "rechazada")
                            }
                          >
                            Rechazar
                          </Button>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="empty-state">
            <b>
              {needsAssociate
                ? "Aún no hay movimientos"
                : "Sin registros todavía"}
            </b>
            <small>
              {needsAssociate
                ? "El historial empezará cuando registres un asociado y vincules la primera operación."
                : "Los datos aparecerán aquí cuando se realicen las primeras operaciones."}
            </small>
            {canManage && !needsAssociate && !associatesError && (
              <Button
                onClick={() => setFormOpen(true)}
                className="violet-button"
              >
                <Plus />
                {screen.action}
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export function Reports({ go }: { go: (view: View) => void }) {
  const permissions = useContext(PermissionContext);
  const allReports: [LucideIcon, string, string, View, string][] = [
    [
      Users,
      "Asociados",
      "Consultar el directorio actualizado.",
      "asociados",
      "associates",
    ],
    [
      HandCoins,
      "Créditos",
      "Consultar solicitudes y productos registrados.",
      "creditos",
      "credits",
    ],
    [
      ReceiptText,
      "Cartera",
      "Revisar obligaciones y vencimientos registrados.",
      "cartera",
      "receivables",
    ],
    [
      Banknote,
      "Cobros",
      "Consultar relaciones creadas.",
      "cobros",
      "payroll",
    ],
    [
      CreditCard,
      "Pagos",
      "Revisar recaudos y descargar los registros cargados.",
      "pagos",
      "payments",
    ],
    [
      WalletCards,
      "Ahorros y aportes",
      "Consultar movimientos registrados.",
      "ahorros",
      "savings",
    ],
    [
      Building2,
      "Convenios",
      "Consultar convenios registrados.",
      "convenios",
      "convenios",
    ],
  ];
  const reports = allReports.filter(
    (item) =>
      "all" in permissions ||
      Boolean((permissions as PermissionSet)[item[4]]?.view),
  );
  return (
    <div className="page">
      <Heading
        eyebrow="CONSULTA Y CONTROL"
        title="Reportes"
        text="Abre cada módulo para consultar los datos vigentes del sistema."
      />
      <section className="reports">
        {reports.map(([Icon, title, description, target], index) => (
          <button key={title} onClick={() => go(target)}>
            <span className={`report-mark mark-${index}`}>
              <Icon />
            </span>
            <b>{title}</b>
            <small>{description}</small>
            <em>
              Ver registros <ArrowUpRight />
            </em>
          </button>
        ))}
      </section>
    </div>
  );
}
