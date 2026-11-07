"use client";

import { CreateRecordButton, RecordFormPanel, RecordFilters } from "./record-workflow";
import { matchesRecord } from "@/lib/record-search";

import { privateDocumentHref } from "@/lib/private-document";

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
import { ChevronRight } from "lucide-react";
import {
  Fragment,
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { FieldHelp } from "./field-help";

import { FirstActionPanel, Heading } from "@/components/fegcon/associates";
import {
  ApiJson,
  money,
  readJson,
  StatusFor,
  useCapability,
  View,
} from "@/components/fegcon/shared";

export function CreditDocumentsPanel({
  application,
  csrf,
  role,
  onChange,
}: {
  application: ApiJson;
  csrf: string;
  role: string;
  onChange: () => void;
}) {
  const canManage = useCapability("credits");
  const [documents, setDocuments] = useState<ApiJson[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const payrollLabels = [
    { id: "desprendible_1", label: "Primer desprendible de pago" },
    { id: "desprendible_2", label: "Segundo desprendible de pago" },
    { id: "certificacion_laboral", label: "Certificación laboral" },
  ];
  const labels =
    application.credit_channel === "independiente"
      ? [{ id: "declaracion_renta", label: "Declaración de renta" }]
      : payrollLabels;
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(
        `/api/?action=credit-documents&credit_application_id=${application.id}`,
        { credentials: "same-origin" },
      );
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(data.error || "No fue posible cargar los documentos.");
      setDocuments(data.documents || []);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible cargar los documentos.",
      );
    } finally {
      setLoading(false);
    }
  }, [application.id]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const formElement = event.currentTarget;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const form = new FormData(formElement);
      form.set("credit_application_id", String(application.id));
      const response = await apiFetch("/api/?action=credit-documents", {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CSRF-Token": csrf },
        body: form,
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(data.error || "No fue posible guardar el documento.");
      setNotice(data.message || "Documento registrado.");
      formElement.reset();
      await load();
      onChange();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible guardar el documento.",
      );
    } finally {
      setBusy(false);
    }
  };
  const retire = async (document: ApiJson) => {
    if (
      !window.confirm(
        `¿Solicitar el retiro de “${document.label}” del expediente?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch(
        `/api/?action=credit-documents&id=${document.id}`,
        {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "X-CSRF-Token": csrf },
        },
      );
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(data.error || "No fue posible retirar el documento.");
      setNotice(data.message || "Solicitud enviada a revisión.");
      await load();
      onChange();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible retirar el documento.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="credit-documents-panel">
      <div className="credit-documents-heading">
        <div>
          <b>Expediente de solicitud #{application.id}</b>
          <small>
            {application.credit_channel === "independiente"
              ? "Independiente · requiere declaración de renta y definición de codeudores"
              : "Libranza · requiere dos desprendibles y certificación laboral"}
          </small>
        </div>
        <Button
          variant="outline"
          onClick={() => void load()}
          disabled={loading}
        >
          Actualizar
        </Button>
      </div>
      {error && (
        <div className="auth-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="flash-message info" role="status">
          {notice}
        </div>
      )}
      {loading ? (
        <div className="empty-state">Cargando expediente…</div>
      ) : documents.length ? (
        <div className="credit-document-list">
          {documents.map((document) => (
            <div className="credit-document-row" key={document.id}>
              <span>
                <b>
                  {labels.find((item) => item.id === document.label)?.label ||
                    document.label}
                </b>
                <small>
                  {document.original_name} ·{" "}
                  {(Number(document.byte_size) / 1024 / 1024).toFixed(1)} MB
                </small>
              </span>
              <StatusFor value={document.status} />
              <div className="flex gap-2">
                {(document.status === "custodiado" ||
                  role === "superadmin") && (
                  <Button variant="outline" asChild>
                    <a
                      href={privateDocumentHref(
                        `/api/?action=credit-document-file&id=${document.id}`,
                      )}
                    >
                      Abrir
                    </a>
                  </Button>
                )}
                {canManage && document.status === "custodiado" && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void retire(document)}
                  >
                    Retirar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <b>Expediente sin documentos</b>
          <small>
            Adjunta los soportes requeridos para completar la revisión de la
            solicitud.
          </small>
        </div>
      )}
      {canManage &&
        application.status !== "desembolsada" &&
        application.status !== "rechazada" && (
          <form className="credit-document-upload" onSubmit={upload}>
            <label>
              Documento requerido
              <select
                name="label"
                required
                className="w-full rounded-md border p-2"
              >
                {labels.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Archivo PDF, JPG o PNG · máximo 15 MB
              <Input
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                required
              />
            </label>
            <Button type="submit" disabled={busy}>
              {busy
                ? "Guardando…"
                : role === "operador"
                  ? "Enviar soporte"
                  : "Guardar soporte privado"}
            </Button>
          </form>
        )}
    </div>
  );
}

export function CreditScreen({
  csrf,
  role,
  go,
}: {
  csrf: string;
  role: string;
  go: (view: View) => void;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [recordSearch, setRecordSearch] = useState("");
  const [recordStatus, setRecordStatus] = useState("");
  const canManage = useCapability("credits");
  const [associates, setAssociates] = useState<ApiJson[]>([]),
    [products, setProducts] = useState<ApiJson[]>([]),
    [rows, setRows] = useState<ApiJson[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("libranza");
  const [priority, setPriority] = useState("normal");
  const [associateId, setAssociateId] = useState(""),
    [amount, setAmount] = useState(""),
    [term, setTerm] = useState(""),
    [purpose, setPurpose] = useState(""),
    [creditChannel, setCreditChannel] = useState("libranza"),
    [requiredCosigners, setRequiredCosigners] = useState<
      Record<number, string>
    >({}),
    [documentsFor, setDocumentsFor] = useState<number | null>(null);
  const [disbursementDates, setDisbursementDates] = useState<
    Record<number, { disbursedOn: string; firstDueDate: string }>
  >({});
  const [capacity, setCapacity] = useState<ApiJson | null>(null),
    [capacityLoading, setCapacityLoading] = useState(false),
    [capacityRetry, setCapacityRetry] = useState(0),
    [multipliers, setMultipliers] = useState<Record<number, string>>({}),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const urls = [
        "/api/?action=associates",
        "/api/?action=products&type=credito",
        "/api/?action=credit-applications",
      ];
      const [associateData, productData, creditData] = await Promise.all(
        urls.map(async (url) => {
          const response = await apiFetch(url, { credentials: "same-origin" });
          const data = await readJson(response);
          if (!response.ok)
            throw new Error(
              data.error || "No fue posible cargar los créditos.",
            );
          return data;
        }),
      );
      setAssociates(
        (associateData.associates || []).filter(
          (associate: ApiJson) => associate.status === "activo",
        ),
      );
      setProducts(productData.products || []);
      setRows((creditData.applications || []).sort((a: ApiJson, b: ApiJson) => {
        const rank: Record<string, number> = { alta: 0, normal: 1, baja: 2 };

        return (rank[a.priority || "normal"] ?? 1) - (rank[b.priority || "normal"] ?? 1);
      }));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible cargar los créditos.",
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
  useEffect(() => {
    if (!associateId) return;
    let cancelled = false;
    apiFetch(`/api/?action=credit-capacity&associate_id=${associateId}`, {
      credentials: "same-origin",
    })
      .then(async (response) => {
        const data = await readJson(response);
        if (!response.ok)
          throw new Error(data.error || "No fue posible consultar el cupo.");
        return data;
      })
      .then((data) => {
        if (!cancelled) setCapacity(data);
      })
      .catch((reason) => {
        if (!cancelled) {
          setCapacity(null);
          setError(
            reason instanceof Error
              ? reason.message
              : "No fue posible consultar el cupo.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCapacityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [associateId, capacityRetry]);
  const numericAmount = Number(amount) || 0,
    months = Number(term) || 0;
  const estimatedInstallment =
    numericAmount > 0 && months > 0
      ? (numericAmount * 0.02) / (1 - Math.pow(1.02, -months))
      : 0;
  const decide = async (
    application: ApiJson,
    status: "aprobada" | "rechazada",
  ) => {
    const selectedMultiplier = multipliers[Number(application.id)];
    if (status === "aprobada" && !selectedMultiplier) {
      setNotice(
        "Selecciona el multiplicador para esta solicitud antes de aprobarla.",
      );
      return;
    }
    if (
      status === "aprobada" &&
      application.credit_channel === "independiente" &&
      !requiredCosigners[Number(application.id)]
    ) {
      setNotice(
        "Indica si esta solicitud independiente requiere uno o dos codeudores.",
      );
      return;
    }
    const quote =
      (Number(application.requested_amount) * 0.02) /
      (1 - Math.pow(1.02, -Number(application.requested_term_months)));
    if (
      status === "aprobada" &&
      !window.confirm(
        `¿Aprobar el crédito #${application.id} con cupo de ${selectedMultiplier} veces los aportes? La cuota estimada es ${money(quote)} al mes.`,
      )
    )
      return;
    setBusy(true);
    try {
      const response = await apiFetch("/api/?action=credit-applications", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({
          id: Number(application.id),
          status,
          multiplier: Number(selectedMultiplier || 0),
          required_cosigners: Number(
            requiredCosigners[Number(application.id)] || 0,
          ),
        }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setNotice(data.error || "No fue posible procesar la solicitud.");
        return;
      }
      setNotice(
        status === "aprobada"
          ? "Crédito aprobado. La cuota quedó registrada en la solicitud."
          : "Solicitud de crédito rechazada.",
      );
      load();
    } catch {
      setNotice("No se pudo conectar con el servidor.");
    } finally {
      setBusy(false);
    }
  };
  const disburse = async (application: ApiJson) => {
    const dates = disbursementDates[Number(application.id)];
    if (!dates?.disbursedOn || !dates.firstDueDate) {
      setNotice(
        "Indica la fecha real del desembolso y la primera fecha de pago.",
      );
      return;
    }
    if (dates.firstDueDate <= dates.disbursedOn) {
      setNotice("La primera cuota debe vencer después del desembolso.");
      return;
    }
    setBusy(true);
    try {
      const response = await apiFetch("/api/?action=credit-applications", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({
          id: Number(application.id),
          status: "desembolsada",
          disbursed_on: dates.disbursedOn,
          first_due_date: dates.firstDueDate,
        }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setNotice(data.error || "No fue posible registrar el desembolso.");
        return;
      }
      if (data.pending_approval) {
        go("mis_solicitudes");
        return;
      }
      setNotice(
        data.message || "Crédito desembolsado y plan de cuotas creado.",
      );
      await load();
    } catch {
      setNotice("No se pudo conectar con el servidor.");
    } finally {
      setBusy(false);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const response = await apiFetch("/api/?action=credit-applications", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({
          associate_id: Number(associateId),
          product_id: Number(products[0]?.id),
          amount: numericAmount,
          term_months: months,
          purpose,
          credit_channel: creditChannel,
          payment_method: paymentMethod,
          priority,
        }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setNotice(data.error || "No fue posible crear la solicitud.");
        return;
      }
      if (data.pending_approval) {
        go("mis_solicitudes");
        return;
      }
      setNotice(
        "Solicitud de crédito creada. Ahora adjunta los soportes de la modalidad seleccionada.",
      );
      setCreateOpen(false);
      setAmount("");
      setTerm("");
      setPurpose("");
      setCreditChannel("libranza");
      setPaymentMethod("libranza"); setPriority("normal");
      await load();
      if (data.id) setDocumentsFor(Number(data.id));
    } catch {
      setNotice("No se pudo conectar con el servidor.");
    } finally {
      setBusy(false);
    }
  };
  const visibleRecords = rows.filter(row =>
    (!recordStatus || row.status === recordStatus) && matchesRecord(recordSearch, [row.first_name, row.last_name, row.requested_amount, row.credit_channel, row.status, row.id]));
  const recordStatuses = Array.from(new Set(rows.map(row => String(row.status || "")))).filter(Boolean);
  return (
    <div className="page">
      <Heading
        eyebrow="TESORERÍA"
        title="Créditos"
        text="Solicita y revisa créditos de libre inversión. Consulta los requisitos y el estado de cada solicitud."
      >
        {canManage && <CreateRecordButton id="credits-create" open={createOpen} onOpen={() => setCreateOpen(true)}>Crear crédito</CreateRecordButton>}
      </Heading>
      {error && associates.length > 0 && (
        <div
          className="auth-error flex items-center justify-between gap-3"
          role="alert"
        >
          <span>{error}</span>
          <Button
            variant="outline"
            onClick={() => {
              void load();
              setCapacityLoading(Boolean(associateId));
              setCapacityRetry((value) => value + 1);
            }}
            disabled={loading}
          >
            Reintentar
          </Button>
        </div>
      )}
      {createOpen && <RecordFormPanel id="credits-create" title="Nueva solicitud de crédito" description="Selecciona el asociado, revisa su cupo y completa las condiciones de la solicitud." busy={busy} onClose={() => setCreateOpen(false)}>
        {!canManage ? (
          <div className="empty-state role-read-only-note">
            <b>Vista de consulta</b>
            <small>
              Este perfil puede consultar solicitudes, estados y documentos de
              crédito.
            </small>
          </div>
        ) : !associates.length ? (
          <FirstActionPanel
            title="Registra primero un asociado"
            detail="Después de registrar sus aportes, podrás consultar el cupo y crear una solicitud de crédito."
            action="Ir a asociados"
            onAction={() => go("asociados")}
            loading={loading}
            error={error}
            onRetry={() => void load()}
          />
        ) : (
          <form className="p-6 grid gap-4 md:grid-cols-2" onSubmit={submit}>
            <label>
              Asociado
              <AssociateSelect
                initialOptions={associates}
                value={associateId}
                onChange={(event) => {
                  const value = event.target.value;
                  setCapacity(null);
                  setCapacityLoading(Boolean(value));
                  setAssociateId(value);
                }}
                activeOnly
              />
            </label>
            <label>
              Monto solicitado
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Ej. 100.000"
                value={amount ? Number(amount).toLocaleString("es-CO") : ""}
                onChange={(event) =>
                  setAmount(event.target.value.replace(/\D/g, ""))
                }
                required
              />
            </label>
            <label>
              Plazo
              <Input
                type="number"
                min="1"
                max="60"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                required
              />
            </label>
            <label>
              Modalidad
              <FieldHelp title="¿Qué modalidad corresponde?">
                Libranza corresponde al descuento por nómina de una empresa
                vinculada. Independiente requiere declaración de renta y
                evaluación de codeudores.
              </FieldHelp>
              <select
                value={creditChannel}
                onChange={(event) => setCreditChannel(event.target.value)}
                className="w-full rounded-md border p-2"
              >
                <option value="libranza">
                  Libranza · requiere dos desprendibles y certificación laboral
                </option>
                <option value="independiente">
                  Independiente · requiere declaración de renta y codeudores
                </option>
              </select>
            </label>
            <label>Forma de pago
              <select className="w-full rounded-md border p-2" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                <option value="libranza">Descuento por nómina</option><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="consignacion">Consignación</option>
              </select>
            </label>
            <label>Prioridad
              <select className="w-full rounded-md border p-2" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="alta">Alta</option><option value="normal">Normal</option><option value="baja">Baja</option>
              </select>
            </label>
            <label>
              Destino del crédito
              <Input
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                maxLength={255}
              />
            </label>
            {capacityLoading && associateId && (
              <p className="form-guidance md:col-span-2" role="status">
                Consultando aportes y cupo disponible…
              </p>
            )}
            {capacity && (
              <div className="credit-capacity md:col-span-2">
                <div>
                  <small>Ahorro total registrado</small>
                  <b>{money(Number(capacity.total_savings))}</b>
                </div>
                <div>
                  <small>Ahorro a la vista · 30%</small>
                  <b>{money(Number(capacity.vista_balance))}</b>
                </div>
                <div>
                  <small>Aportes base · 70%</small>
                  <b>{money(Number(capacity.contributions_balance))}</b>
                </div>
                <div>
                  <small>Cupo máximo · x5</small>
                  <b>{money(Number(capacity.credit_limits["5"]))}</b>
                </div>
                {Number(capacity.contributions_balance) <= 0 ? (
                  <>
                    <p role="alert">
                      Este asociado todavía no tiene aportes que respalden un
                      crédito.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="md:col-span-4 justify-self-start"
                      onClick={() => go("ahorros")}
                    >
                      Registrar aportes <ChevronRight />
                    </Button>
                  </>
                ) : (
                  numericAmount > Number(capacity.credit_limits["5"]) && (
                    <p role="alert">
                      El monto supera el cupo máximo de cinco veces los aportes
                      base.
                    </p>
                  )
                )}
                {estimatedInstallment > 0 && (
                  <p className="md:col-span-4">
                    Cuota estimada a {months} meses y 2% mensual sobre saldo
                    pendiente: <b>{money(estimatedInstallment)}</b>. La cuota
                    definitiva se fija al aprobar.
                  </p>
                )}
              </div>
            )}
            <div className="md:col-span-2">
              <Button
                className="violet-button"
                type="submit"
                disabled={
                  busy ||
                  loading ||
                  Boolean(error) ||
                  !associates.length ||
                  !products.length ||
                  numericAmount <= 0 ||
                  months < 1 ||
                  months > 60 ||
                  !capacity ||
                  capacityLoading ||
                  Number(capacity.contributions_balance) <= 0 ||
                  numericAmount > Number(capacity.credit_limits["5"])
                }
              >
                {busy
                  ? "Guardando…"
                  : role === "operador"
                    ? "Enviar a revisión"
                    : "Crear solicitud de crédito"}
              </Button>
              {notice && (
                <small className="ml-3" role="status">
                  {notice}
                </small>
              )}
            </div>
          </form>
        )}
      </RecordFormPanel>}
      {notice && (
        <div className="flash-message info mt-4" role="status">
          {notice}
        </div>
      )}
      <section className="data-panel mt-6">
        <div className="table-tools">
          <div>
            <b>Solicitudes de crédito</b>
            <small>
              La aprobación valida los soportes. El desembolso crea cuotas al 2%
              mensual sobre saldo pendiente.
            </small>
          </div>
          <div className="flex items-center gap-2">
            <small>
              {loading
                ? "Cargando…"
                : `${loading || error ? "—" : rows.length} registros`}
            </small>
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={loading}
            >
              Actualizar
            </Button>
          </div>
        </div>
        <RecordFilters search={recordSearch} onSearch={setRecordSearch} status={recordStatus} onStatus={setRecordStatus} statuses={recordStatuses} count={visibleRecords.length} />
        {!loading && !error && rows.length > 0 && !visibleRecords.length && <div className="empty-state"><b>No hay coincidencias</b><small>Prueba otra búsqueda o cambia el filtro de estado.</small></div>}
        {loading ? (
          <div className="empty-state">Cargando solicitudes…</div>
        ) : error ? (
          <div className="empty-state">
            <b>No se pudo cargar la cartera de créditos</b>
            <small>Corrige la conexión y vuelve a intentarlo.</small>
          </div>
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asociado</TableHead>
                  <TableHead>Modalidad y solicitud</TableHead>
                  <TableHead>Plazo</TableHead>
                  <TableHead>Cupo aprobado</TableHead>
                  <TableHead>Cuota mensual</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRecords.map((row) => (
                  <Fragment key={row.id}>
                    <TableRow>
                      <TableCell>
                        {row.first_name} {row.last_name}
                      </TableCell>
                      <TableCell>
                        <b>{money(Number(row.requested_amount))}</b>
                        <small className="block">
                          {row.credit_channel === "independiente"
                            ? "Independiente"
                            : "Libranza"}
                        </small>
                      </TableCell>
                      <TableCell>
                        {row.requested_term_months} meses
                      </TableCell>
                      <TableCell>
                        {row.approved_multiplier
                          ? `x${row.approved_multiplier}`
                          : "Pendiente"}
                        {row.required_cosigners ? (
                          <small className="block">
                            {row.required_cosigners} codeudor(es)
                          </small>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {row.monthly_installment
                          ? money(Number(row.monthly_installment))
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusFor value={row.status} />
                        {row.status === "desembolsada" && (
                          <small className="block">
                            {row.installment_count} cuotas programadas
                          </small>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="credit-detail-toggle">
                          <Button
                            variant="outline"
                            onClick={() =>
                              setDocumentsFor(
                                documentsFor === Number(row.id)
                                  ? null
                                  : Number(row.id),
                              )
                            }
                          >
                            {documentsFor === Number(row.id)
                              ? "Cerrar detalle"
                              : "Ver detalle"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {documentsFor === Number(row.id) && (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <div className="credit-record-detail">
                            <div className="credit-record-actions">
                              <h3>Gestión de la solicitud #{row.id}</h3>
                              <CreditTerms application={row} csrf={csrf} onChange={load} />
                          {row.status === "en_revision" &&
                          role === "superadmin" ? (
                            <>
                              <select
                                aria-label={`Multiplicador de cupo para solicitud ${row.id}`}
                                className="rounded-md border p-2"
                                value={multipliers[Number(row.id)] || ""}
                                onChange={(event) =>
                                  setMultipliers((values) => ({
                                    ...values,
                                    [Number(row.id)]: event.target.value,
                                  }))
                                }
                              >
                                <option value="">
                                  Selecciona cupo: 3, 4 o 5 veces aportes
                                </option>
                                <option value="3">x3</option>
                                <option value="4">x4</option>
                                <option value="5">x5</option>
                              </select>
                              {row.credit_channel === "independiente" && (
                                <label className="text-xs">
                                  Codeudores requeridos
                                  <select
                                    className="mt-1 w-full rounded-md border p-2"
                                    value={
                                      requiredCosigners[Number(row.id)] || ""
                                    }
                                    onChange={(event) =>
                                      setRequiredCosigners((values) => ({
                                        ...values,
                                        [Number(row.id)]: event.target.value,
                                      }))
                                    }
                                  >
                                    <option value="">
                                      Selecciona uno o dos
                                    </option>
                                    <option value="1">Uno</option>
                                    <option value="2">Dos</option>
                                  </select>
                                </label>
                              )}
                              <Button
                                disabled={busy}
                                onClick={() => decide(row, "aprobada")}
                              >
                                Aprobar
                              </Button>
                              <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() => decide(row, "rechazada")}
                              >
                                Rechazar
                              </Button>
                            </>
                          ) : row.status === "aprobada" && canManage ? (
                            <>
                              <label className="text-xs">
                                Fecha de desembolso
                                <Input
                                  type="date"
                                  value={
                                    disbursementDates[Number(row.id)]
                                      ?.disbursedOn || ""
                                  }
                                  onChange={(event) =>
                                    setDisbursementDates((dates) => ({
                                      ...dates,
                                      [Number(row.id)]: {
                                        disbursedOn: event.target.value,
                                        firstDueDate:
                                          dates[Number(row.id)]?.firstDueDate ||
                                          "",
                                      },
                                    }))
                                  }
                                  required
                                />
                              </label>
                              <label className="text-xs">
                                Primera fecha de pago
                                <Input
                                  type="date"
                                  value={
                                    disbursementDates[Number(row.id)]
                                      ?.firstDueDate || ""
                                  }
                                  onChange={(event) =>
                                    setDisbursementDates((dates) => ({
                                      ...dates,
                                      [Number(row.id)]: {
                                        disbursedOn:
                                          dates[Number(row.id)]?.disbursedOn ||
                                          "",
                                        firstDueDate: event.target.value,
                                      },
                                    }))
                                  }
                                  required
                                />
                              </label>
                              <Button
                                disabled={busy}
                                onClick={() => void disburse(row)}
                              >
                                {role === "operador"
                                  ? "Solicitar desembolso"
                                  : "Registrar desembolso"}
                              </Button>
                            </>
                          ) : null}
                            </div>
                          <CreditDocumentsPanel
                            application={row}
                            csrf={csrf}
                            role={role}
                            onChange={() => void load()}
                          />
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="empty-state">
            <b>Aún no hay solicitudes</b>
            <small>
              Al crear una solicitud, aparecerá aquí para seguimiento y
              decisión.
            </small>
          </div>
        )}
      </section>
    </div>
  );
}

function CreditTerms({ application, csrf, onChange }: { application: ApiJson; csrf: string; onChange: () => Promise<void> }) {
  const manage = useCapability("credits");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const labels: Record<string, string> = { libranza: "Descuento por nómina", transferencia: "Transferencia", efectivo: "Efectivo", consignacion: "Consignación" };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setMessage("");
    try {
      const response = await apiFetch("/api/?action=credit-applications", { method: "PATCH", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ ...values, id: application.id, operation: "terms" }) });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || "No fue posible guardar.");
      setMessage(data.pending_approval ? "Cambio enviado a revisión." : "Datos actualizados."); setEditing(false); await onChange();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "No fue posible guardar."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2">
    <small className="block">Pago: {labels[String(application.payment_method)] || "Sin registrar"}</small>
    <small className="block">Prioridad: {application.priority || "normal"}</small>
    {manage && <Button variant="outline" disabled={busy} onClick={() => setEditing(!editing)}>Editar pago y prioridad</Button>}
    {editing && <form onSubmit={submit} className="space-y-2">
      <label>Forma de pago<select name="payment_method" required defaultValue={application.payment_method || ""} className="w-full rounded-md border p-2"><option value="" disabled>Seleccionar</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Prioridad<select name="priority" defaultValue={application.priority || "normal"} className="w-full rounded-md border p-2"><option value="alta">Alta</option><option value="normal">Normal</option><option value="baja">Baja</option></select></label>
      <Button type="submit" disabled={busy}>Guardar</Button>
    </form>}
    {message && <small role="status">{message}</small>}
  </div>;
}
