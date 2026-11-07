"use client";

import { AssociateActivity } from "./associate-activity";

import { downloadCsv } from "@/lib/csv";
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
import { useCallback, useEffect, useState } from "react";

import { FirstActionPanel, Heading } from "@/components/fegcon/associates";
import {
  ApiJson,
  money,
  readJson,
  StatusFor,
  useCapability,
  View,
} from "@/components/fegcon/shared";

export function PayrollCollectionsScreen({
  csrf,
  role,
  go,
}: {
  csrf: string;
  role: string;
  go: (view: View) => void;
}) {
  const canManage = useCapability("payroll");
  const [rows, setRows] = useState<ApiJson[]>([]),
    [companies, setCompanies] = useState<ApiJson[]>([]),
    [associates, setAssociates] = useState<ApiJson[]>([]),
    [credits, setCredits] = useState<ApiJson[]>([]),
    [items, setItems] = useState<ApiJson[]>([]);
  const [selected, setSelected] = useState<ApiJson | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const today = new Date();
  const nextDay = today.getDate() < 10 ? 10 : today.getDate() < 20 ? 20 : 10;
  const nextMonth =
    nextDay === 10 && today.getDate() >= 20
      ? new Date(today.getFullYear(), today.getMonth() + 1, 1)
      : today;
  const defaultDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [collectionData, companyData, associateData, creditData] =
        await Promise.all(
          [
            "payroll-collections",
            "companies",
            "associates",
            "credit-applications",
          ].map(async (action) => {
            const response = await apiFetch(`/api/?action=${action}`, {
              credentials: "same-origin",
            });
            if (!response.ok)
              throw new Error(
                "No fue posible consultar los registros de nómina.",
              );
            return readJson(response);
          }),
        );
      setRows(collectionData.collections || []);
      setCompanies(companyData.companies || []);
      setAssociates(
        (associateData.associates || []).filter(
          (a: ApiJson) => a.status === "activo",
        ),
      );
      setCredits(
        (creditData.applications || []).filter(
          (credit: ApiJson) =>
            ["aprobada", "desembolsada"].includes(String(credit.status)) &&
            Number(credit.monthly_installment) > 0,
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible cargar las relaciones.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  const loadItems = useCallback(async (collection: ApiJson) => {
    setSelected(collection);
    setItems([]);
    setError("");
    try {
      const response = await apiFetch(
        `/api/?action=payroll-items&collection_id=${collection.id}`,
        { credentials: "same-origin" },
      );
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(data.error || "No fue posible abrir el detalle.");
      setItems(data.items || []);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible abrir el detalle.",
      );
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const send = async (
    url: string,
    method: string,
    payload: ApiJson,
    form?: HTMLFormElement,
  ) => {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const response = await apiFetch(url, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify(payload),
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(data.error || "No fue posible guardar los cambios.");
      if (data.pending_approval) {
        go("mis_solicitudes");
        return false;
      }
      setNotice(data.message || "Cambios guardados.");
      form?.reset();
      await load();
      if (selected) {
        const collectionData = await readJson<ApiJson>(
          await apiFetch("/api/?action=payroll-collections", {
            credentials: "same-origin",
          }),
        );
        const fresh = collectionData.collections?.find(
          (row: ApiJson) => Number(row.id) === Number(selected.id),
        );
        if (fresh) await loadItems(fresh);
      }
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible guardar los cambios.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  const exportCsv = () => {
    if (!selected) return;
    downloadCsv(
      `nomina-${selected.collection_date || selected.id}`,
      ["Documento", "Asociado", "Tipo", "Concepto", "Valor"],
      items
        .filter((item) => item.status !== "anulado")
        .map((item) => [
          item.document_number,
          `${item.first_name} ${item.last_name}`,
          item.charge_type,
          item.reference,
          item.amount,
        ]),
    );
  };
  const advance = async (status: string) => {
    if (!selected) return;
    const ok = await send("/api/?action=payroll-collections", "PATCH", {
      id: Number(selected.id),
      status,
    });
    if (ok) {
      const collectionData = await readJson<ApiJson>(
        await apiFetch("/api/?action=payroll-collections", {
          credentials: "same-origin",
        }),
      );
      await loadItems(
        collectionData.collections?.find(
          (row: ApiJson) => Number(row.id) === Number(selected.id),
        ) || selected,
      );
    }
  };
  const activeAssociates = selected
    ? associates.filter(
        (associate) =>
          Number(associate.company_id) === Number(selected.company_id),
      )
    : [];
  const draft = selected?.status === "borrador";
  const nextStatus: Record<string, string> = {
    borrador: "enviado",
    enviado: "recibido",
    recibido: "conciliado",
  };
  return (
    <div className="page">
      <Heading
        eyebrow="TESORERÍA"
        title="Cobros"
        text="Prepara y descarga la relación de cada empresa para los días 10 o 20, registra aportes, cuotas y convenios, y concilia lo recibido. Compartir el archivo con la empresa se hace manualmente."
      />
      <AssociateActivity kind="charges" csrf={csrf} />
      {error && (
        <div className="auth-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className="form-guidance" role="status">
          {notice}
        </p>
      )}
      <section className="data-panel">
        <div className="table-tools">
          <div>
            <b>Nueva relación</b>
            <small>
              El valor esperado se calcula desde los conceptos agregados.
            </small>
          </div>
          {!loading && (
            <Button
              variant="outline"
              onClick={() => void load()}
              disabled={busy}
            >
              Actualizar
            </Button>
          )}
        </div>
        {!canManage ? (
          <div className="empty-state role-read-only-note">
            <b>Vista de consulta</b>
            <small>
              Este perfil puede consultar relaciones y recaudos de nómina.
            </small>
          </div>
        ) : loading || error || !companies.length ? (
          <FirstActionPanel
            title={
              !companies.length
                ? "Registra una empresa de libranza"
                : "Prepara la relación de cobro"
            }
            detail={
              !companies.length
                ? "La empresa debe estar registrada antes de crear y enviar su relación de nómina."
                : "Consulta de empresas, asociados y créditos aprobados disponible."
            }
            action="Ir a empresas"
            onAction={() => go("empresas")}
            loading={loading}
            error={error}
            onRetry={() => void load()}
          />
        ) : (
          <form
            className="p-6 grid gap-3 md:grid-cols-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              void send(
                "/api/?action=payroll-collections",
                "POST",
                {
                  company_id: Number(data.get("company_id")),
                  collection_date: data.get("collection_date"),
                },
                form,
              );
            }}
          >
            <label>
              Empresa
              <select
                name="company_id"
                required
                className="w-full rounded-md border p-2"
              >
                <option value="">Selecciona una empresa</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              {!companies.length && (
                <small>
                  Registra la empresa desde la afiliación de un asociado antes
                  de crear la relación.
                </small>
              )}
            </label>
            <label>
              Fecha de cobro
              <Input
                name="collection_date"
                type="date"
                defaultValue={defaultDate}
                required
              />
            </label>
            <div className="flex items-end">
              <Button
                className="violet-button"
                type="submit"
                disabled={busy || !companies.length}
              >
                {busy
                  ? "Guardando…"
                  : role === "operador"
                    ? "Preparar relación"
                    : "Crear borrador"}
              </Button>
            </div>
          </form>
        )}
      </section>
      <section className="data-panel mt-6">
        <div className="table-tools">
          <div>
            <b>Relaciones por empresa</b>
            <small>
              Selecciona una relación para editarla o revisar su recaudo.
            </small>
          </div>
          <small>{rows.length} registros</small>
        </div>
        {loading ? (
          <div className="empty-state">Cargando relaciones…</div>
        ) : rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Conceptos</TableHead>
                <TableHead>Esperado</TableHead>
                <TableHead>Recaudado</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.company_name || "Empresa no disponible"}
                  </TableCell>
                  <TableCell>
                    {row.collection_date || row.period_label}
                  </TableCell>
                  <TableCell>{row.item_count}</TableCell>
                  <TableCell>{money(Number(row.expected_amount))}</TableCell>
                  <TableCell>{money(Number(row.collected_amount))}</TableCell>
                  <TableCell>
                    <StatusFor
                      value={String(row.status).replaceAll("_", " ")}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      onClick={() => void loadItems(row)}
                    >
                      Abrir relación
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="empty-state">
            <b>Aún no hay relaciones</b>
            <small>
              Cuando registres la primera empresa y sus asociados activos,
              podrás crear aquí el cobro de nómina.
            </small>
          </div>
        )}
      </section>
      {selected && (
        <section className="data-panel mt-6">
          <div className="table-tools">
            <div>
              <b>
                {selected.company_name} ·{" "}
                {selected.collection_date || selected.period_label}
              </b>
              <small>
                Estado: {String(selected.status).replaceAll("_", " ")} ·{" "}
                {money(Number(selected.expected_amount))} esperado
              </small>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={exportCsv}
                disabled={!items.length}
              >
                Descargar CSV
              </Button>
              <Button variant="outline" onClick={() => setSelected(null)}>
                Cerrar
              </Button>
            </div>
          </div>
          {canManage &&
            draft &&
            (activeAssociates.length ? (
              <form
                className="p-6 grid gap-3 border-b md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const data = new FormData(form);
                  const type = String(data.get("charge_type"));
                  void send(
                    "/api/?action=payroll-items",
                    "POST",
                    {
                      payroll_collection_id: Number(selected.id),
                      associate_id: Number(data.get("associate_id")),
                      charge_type: type,
                      credit_application_id:
                        type === "cuota_credito"
                          ? Number(data.get("credit_application_id"))
                          : null,
                      amount: Number(data.get("amount")),
                      reference: data.get("reference"),
                    },
                    form,
                  );
                }}
              >
                <label>
                  Asociado
                  <AssociateSelect
                    initialOptions={activeAssociates}
                    name="associate_id"
                    companyId={Number(selected.company_id)}
                    activeOnly
                    onSelect={(person) =>
                      setAssociates((people) =>
                        people.some((item) => item.id === person.id)
                          ? people
                          : [...people, person],
                      )
                    }
                  />
                  {!activeAssociates.length && (
                    <small>
                      No hay asociados activos registrados para esta empresa.
                    </small>
                  )}
                </label>
                <label>
                  Concepto
                  <select
                    name="charge_type"
                    required
                    className="w-full rounded-md border p-2"
                  >
                    <option value="aporte">Aporte</option>
                    <option value="cuota_credito">Cuota de crédito</option>
                    <option value="convenio">Convenio</option>
                  </select>
                </label>
                <label>
                  Crédito aprobado
                  <select
                    name="credit_application_id"
                    className="w-full rounded-md border p-2"
                  >
                    <option value="">Selecciona si es cuota de crédito</option>
                    {credits
                      .filter((credit) =>
                        activeAssociates.some(
                          (associate) =>
                            Number(associate.id) ===
                            Number(credit.associate_id),
                        ),
                      )
                      .map((credit) => (
                        <option key={credit.id} value={credit.id}>
                          #{credit.id} · {credit.first_name} {credit.last_name}{" "}
                          · cuota {money(Number(credit.monthly_installment))}
                        </option>
                      ))}
                  </select>
                  <small>
                    El valor de la cuota se ingresa abajo para el período de
                    cobro.
                  </small>
                </label>
                <label>
                  Valor del concepto
                  <Input
                    name="amount"
                    type="number"
                    min="1"
                    step="1"
                    required
                  />
                </label>
                <label>
                  Detalle o referencia
                  <Input name="reference" maxLength={190} required />
                </label>
                <div className="md:col-span-2">
                  <Button
                    className="violet-button"
                    type="submit"
                    disabled={busy || !activeAssociates.length}
                  >
                    {busy
                      ? "Guardando…"
                      : role === "operador"
                        ? "Enviar concepto"
                        : "Agregar a la relación"}
                  </Button>
                </div>
              </form>
            ) : (
              <FirstActionPanel
                title="No hay asociados activos en esta empresa"
                detail="Vincula a los asociados con la empresa antes de agregar sus aportes, cuotas de crédito o convenios."
                action="Ir a afiliaciones"
                onAction={() => go("afiliaciones")}
              />
            ))}
          {items.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asociado</TableHead>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Valor cobrado</TableHead>
                  <TableHead>Recaudado</TableHead>
                  <TableHead>Estado</TableHead>
                  {canManage && (draft || selected.status === "recibido") && (
                    <TableHead>Acción</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.first_name} {item.last_name}
                      <small className="block">{item.document_number}</small>
                    </TableCell>
                    <TableCell>
                      {String(item.charge_type).replaceAll("_", " ")} ·{" "}
                      {item.reference}
                    </TableCell>
                    <TableCell>{money(Number(item.amount))}</TableCell>
                    <TableCell>
                      {selected.status === "recibido" && canManage ? (
                        <Input
                          aria-label={`Valor recaudado para ${item.first_name} ${item.last_name}`}
                          name="collected"
                          type="number"
                          min="0"
                          max={Number(item.amount)}
                          step="1"
                          defaultValue={item.collected_amount}
                        />
                      ) : (
                        money(Number(item.collected_amount))
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusFor
                        value={String(item.status).replaceAll("_", " ")}
                      />
                    </TableCell>
                    {canManage && (draft || selected.status === "recibido") && (
                      <TableCell>
                        {draft && (
                          <Button
                            variant="outline"
                            disabled={busy || item.status === "anulado"}
                            onClick={() =>
                              void send(
                                `/api/?action=payroll-items&id=${item.id}`,
                                "DELETE",
                                { id: Number(item.id) },
                              )
                            }
                          >
                            Retirar
                          </Button>
                        )}
                        {selected.status === "recibido" && (
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              const input =
                                document.querySelector<HTMLInputElement>(
                                  `[aria-label="Valor recaudado para ${item.first_name} ${item.last_name}"]`,
                                );
                              if (input)
                                void send(
                                  "/api/?action=payroll-items",
                                  "PATCH",
                                  {
                                    id: Number(item.id),
                                    collected_amount: Number(input.value),
                                  },
                                );
                            }}
                          >
                            Guardar recaudo
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="empty-state">
              <b>La relación todavía no tiene conceptos</b>
              <small>
                Agrega los valores reales de aportes, cuotas de crédito y
                convenios para esta empresa.
              </small>
            </div>
          )}
          {canManage && (
            <div className="p-6 flex flex-wrap gap-3">
              {selected.status !== "conciliado" &&
                nextStatus[String(selected.status)] && (
                  <Button
                    className="violet-button"
                    disabled={
                      busy ||
                      (selected.status === "recibido" &&
                        items.some(
                          (item) =>
                            item.status !== "anulado" &&
                            Number(item.collected_amount) < Number(item.amount),
                        ))
                    }
                    onClick={() =>
                      void advance(nextStatus[String(selected.status)])
                    }
                  >
                    {role === "operador"
                      ? "Enviar cambio para revisión"
                      : `Marcar como ${String(nextStatus[String(selected.status)]).replaceAll("_", " ")}`}
                  </Button>
                )}
              {selected.status === "recibido" &&
                items.some(
                  (item) =>
                    item.status !== "anulado" &&
                    Number(item.collected_amount) < Number(item.amount),
                ) && (
                  <small className="self-center">
                    Completa la conciliación de cada concepto antes del cierre.
                  </small>
                )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
