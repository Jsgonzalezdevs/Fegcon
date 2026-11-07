"use client";

import { CreateRecordButton, RecordFormPanel } from "./record-workflow";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/fegcon-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AssociateSelect } from "./associate-select";
import { money, readJson, useCapability, type ApiJson } from "./shared";

/** Individual records within the existing collections and agreements screens. */
export function AssociateActivity({
  kind,
  csrf = "",
  associateId,
}: {
  kind: "charges" | "benefits";
  csrf?: string;
  associateId?: number;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const charges = kind === "charges";
  const canView = useCapability(charges ? "payroll" : "convenios", "view");
  const canManage = useCapability(charges ? "payroll" : "convenios");
  const endpoint = charges ? "associate-charges" : "associate-benefits";
  const [rows, setRows] = useState<ApiJson[]>([]);
  const [associates, setAssociates] = useState<ApiJson[]>([]);
  const [catalog, setCatalog] = useState<ApiJson[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [month, setMonth] = useState("");
  const [period, setPeriod] = useState("");
  const [frequency, setFrequency] = useState("");
  const load = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError("");
    try {
      const requests = [
        `/api/?action=${endpoint}${associateId ? `&associate_id=${associateId}` : ""}`,
      ];
      if (!associateId && canManage) requests.push("/api/?action=associates");
      if (!charges && !associateId && canManage)
        requests.push("/api/?action=catalog&category=convenio");
      const data = await Promise.all(
        requests.map(async (url) => {
          const response = await apiFetch(url);
          const result = await readJson(response);
          if (!response.ok)
            throw new Error(
              result.error || "No fue posible consultar los registros.",
            );
          return result;
        }),
      );
      setRows(data[0].entries || []);
      setAssociates(data[1]?.associates || []);
      setCatalog(data[2]?.items || []);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "No fue posible consultar.",
      );
    } finally {
      setLoading(false);
    }
  }, [canView, canManage, endpoint, associateId, charges]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  async function save(
    payload: ApiJson,
    method = "POST",
    form?: HTMLFormElement,
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch(`/api/?action=${endpoint}`, {
        method,
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify(payload),
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(data.error || "No fue posible guardar.");
      setNotice(
        data.pending_approval
          ? "Solicitud enviada para revisión administrativa."
          : "Registro guardado.",
      );
      form?.reset();
      if (form) setCreateOpen(false);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "No fue posible guardar.",
      );
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void save(Object.fromEntries(new FormData(form)), "POST", form);
  }
  if (!canView) return null;
  const visible = rows.filter((row) => {
    const date = String(charges ? row.due_date : row.used_on);
    return (
      (!month || date.slice(0, 7) === month) &&
      (!period || (Number(date.slice(8, 10)) <= 15 ? "1" : "2") === period) &&
      (!frequency || row.frequency === frequency)
    );
  });
  return (
    <section className="data-panel p-6 space-y-4">
      <div className="activity-heading">
      <h2 className="text-lg font-semibold">
        {charges
          ? "Cobros individuales"
          : "Convenios, compras y beneficios utilizados"}
      </h2>
      {!associateId && canManage && <CreateRecordButton id={`${kind}-individual-create`} open={createOpen} onOpen={() => setCreateOpen(true)}>{charges ? "Crear cobro individual" : "Registrar uso o compra"}</CreateRecordButton>}
      </div>
      {charges && (
        <p>
          Organiza cada cobro por su vencimiento: mes completo, primera quincena
          (1–15) o segunda quincena (16–fin de mes).
        </p>
      )}
      {error && (
        <div role="alert" className="auth-error">
          {error}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {!associateId && canManage && createOpen && (
        <RecordFormPanel id={`${kind}-individual-create`} title={charges ? "Nuevo cobro individual" : "Registrar uso o compra"}
          description="Selecciona el asociado y completa la información del registro." busy={busy} onClose={() => setCreateOpen(false)}>
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <label>
            Asociado
            <AssociateSelect
              name="associate_id"
              initialOptions={associates}
              activeOnly
            />
          </label>
          {charges ? (
            <label>
              Frecuencia
              <select
                name="frequency"
                required
                className="w-full rounded-md border p-2"
              >
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </label>
          ) : (
            <>
              <label>
                Tipo
                <select
                  name="entry_type"
                  required
                  className="w-full rounded-md border p-2"
                >
                  <option value="convenio">Convenio</option>
                  <option value="compra">Compra</option>
                  <option value="beneficio">Beneficio</option>
                </select>
              </label>
              <label>
                Convenio utilizado (obligatorio para tipo convenio)
                <select
                  name="catalog_id"
                  className="w-full rounded-md border p-2"
                >
                  <option value="">Sin convenio</option>
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label>
            {charges ? "Vencimiento" : "Fecha de uso"}
            <Input
              name={charges ? "due_date" : "used_on"}
              type="date"
              required
            />
          </label>
          <label>
            Descripción
            <Input name="description" maxLength={255} required />
          </label>
          <label>
            Valor
            <Input
              name="amount"
              type="number"
              min={charges ? "0.01" : "0"}
              step="0.01"
              max="999999999999.99"
              required
            />
          </label>
          <Button
            className="violet-button"
            disabled={busy || loading}
            type="submit"
          >
            {charges ? "Registrar cobro" : "Registrar uso o compra"}
          </Button>
        </form>
        </RecordFormPanel>
      )}
      <div className="flex flex-wrap gap-4">
        <label>
          Mes
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        {charges && (
          <>
            <label>
              Quincena
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="rounded-md border p-2"
              >
                <option value="">Mes completo</option>
                <option value="1">Primera (1–15)</option>
                <option value="2">Segunda (16–fin)</option>
              </select>
            </label>
            <label>
              Frecuencia
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="rounded-md border p-2"
              >
                <option value="">Todas</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </label>
          </>
        )}
        <Button
          variant="outline"
          onClick={() => void load()}
          disabled={loading || busy}
        >
          Actualizar
        </Button>
      </div>
      {loading ? (
        <p role="status">Consultando registros…</p>
      ) : (
        !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  {[
                    "Fecha",
                    "Asociado",
                    charges ? "Frecuencia" : "Tipo",
                    "Detalle",
                    "Valor",
                    ...(charges
                      ? [
                          "Estado",
                          ...(!associateId && canManage ? ["Acción"] : []),
                        ]
                      : ["Convenio"]),
                  ].map((h) => (
                    <th key={h} className="p-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td className="p-2">
                      {charges ? row.due_date : row.used_on}
                    </td>
                    <td className="p-2">
                      {row.first_name} {row.last_name}
                    </td>
                    <td className="p-2">
                      {charges ? row.frequency : row.entry_type}
                    </td>
                    <td className="p-2">{row.description}</td>
                    <td className="p-2">{money(Number(row.amount))}</td>
                    <td className="p-2">
                      {charges ? row.status : row.convenio || "—"}
                    </td>
                    {charges && !associateId && canManage && (
                      <td className="p-2">
                        {!associateId &&
                          canManage &&
                          row.status === "pendiente" && (
                            <div className="flex gap-2">
                              <Button
                                disabled={busy}
                                onClick={() =>
                                  void save(
                                    { id: row.id, status: "pagado" },
                                    "PATCH",
                                  )
                                }
                              >
                                Marcar pagado
                              </Button>
                              <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                  void save(
                                    { id: row.id, status: "anulado" },
                                    "PATCH",
                                  )
                                }
                              >
                                Anular
                              </Button>
                            </div>
                          )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length && <p>No hay registros para este período.</p>}
          </div>
        )
      )}
    </section>
  );
}
