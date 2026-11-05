"use client";

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
import {
  useCallback,
  useContext,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { FieldHelp } from "./field-help";
import { PermissionContext } from "./shared";

import { FirstActionPanel, Heading } from "@/components/fegcon/associates";
import {
  ApiJson,
  money,
  readJson,
  StatusFor,
  useCapability,
  View,
} from "@/components/fegcon/shared";

export function FinanceScreen({
  type,
  csrf,
  go,
}: {
  type: "ahorro";
  csrf: string;
  go: (view: View) => void;
}) {
  const permissions = useContext(PermissionContext);
  const requiresReview = !("all" in permissions);
  const canManage = useCapability("savings");
  const [associates, setAssociates] = useState<ApiJson[]>([]),
    [products, setProducts] = useState<ApiJson[]>([]),
    [rows, setRows] = useState<ApiJson[]>([]);
  const [associateId, setAssociateId] = useState(""),
    [movement, setMovement] = useState("aporte"),
    [amount, setAmount] = useState("");
  const [balance, setBalance] = useState<ApiJson | null>(null),
    [balanceLoading, setBalanceLoading] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const title = "Ahorros y aportes";
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const urls = [
        "/api/?action=associates",
        `/api/?action=products&type=${type}`,
        "/api/?action=savings-transactions",
      ];
      const [associateData, productData, transactionData] = await Promise.all(
        urls.map(async (url) => {
          const response = await apiFetch(url, { credentials: "same-origin" });
          const data = await readJson(response);
          if (!response.ok)
            throw new Error(
              data.error || "No fue posible cargar los movimientos.",
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
      setRows(transactionData.transactions || []);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible cargar los movimientos.",
      );
    } finally {
      setLoading(false);
    }
  }, [type]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);
  useEffect(() => {
    if (!associateId) return;
    let cancelled = false;
    apiFetch(`/api/?action=savings-balance&associate_id=${associateId}`, {
      credentials: "same-origin",
    })
      .then(async (response) => {
        const data = await readJson(response);
        if (!response.ok)
          throw new Error(data.error || "No fue posible consultar los saldos.");
        return data;
      })
      .then((data) => {
        if (!cancelled) setBalance(data);
      })
      .catch((reason) => {
        if (!cancelled) {
          setBalance(null);
          setError(
            reason instanceof Error
              ? reason.message
              : "No fue posible consultar los saldos.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [associateId]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const response = await apiFetch("/api/?action=savings-transactions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({
          associate_id: Number(associateId),
          product_id: Number(values.get("product")),
          movement_type: movement,
          amount: Number(amount),
          reference: values.get("reference"),
        }),
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(
          data.error || "No fue posible registrar el movimiento.",
        );
      if (data.pending_approval) {
        go("mis_solicitudes");
        return;
      }
      setNotice("Movimiento registrado.");
      setAmount("");
      form.reset();
      setAssociateId("");
      setBalance(null);
      await reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo conectar con el servidor.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page">
      <Heading
        eyebrow="OPERACIÓN"
        title={title}
        text="Cada aporte se distribuye entre ahorro a la vista y aportes; los retiros se descuentan del disponible a la vista."
      />
      {error && associates.length > 0 && (
        <div className="auth-error mb-4" role="alert">
          {error}
        </div>
      )}
      <section className="data-panel">
        {!canManage ? (
          <div className="empty-state role-read-only-note">
            <b>Vista de consulta</b>
            <small>
              Este perfil puede consultar saldos y movimientos de ahorro.
            </small>
          </div>
        ) : !associates.length ? (
          <FirstActionPanel
            title="Registra primero un asociado"
            detail="Cuando tenga un asociado activo, podrás registrar aportes y retiros a la vista aquí."
            action="Ir a asociados"
            onAction={() => go("asociados")}
            loading={loading}
            error={error}
            onRetry={() => void reload()}
          />
        ) : (
          <form className="p-6 grid gap-3 md:grid-cols-2" onSubmit={submit}>
            <label>
              Asociado
              <AssociateSelect
                initialOptions={associates}
                name="associate"
                value={associateId}
                onChange={(event) => {
                  setAssociateId(event.target.value);
                  setBalance(null);
                  setBalanceLoading(Boolean(event.target.value));
                }}
                activeOnly
                onSelect={(person) =>
                  setAssociates((items) =>
                    items.some((item) => item.id === person.id)
                      ? items
                      : [...items, person],
                  )
                }
              />
            </label>
            <label>
              Producto
              <select
                name="product"
                required
                className="w-full rounded-md border p-2"
              >
                <option value="">Selecciona</option>
                {products.map((product) => (
                  <option value={product.id} key={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Movimiento
              <FieldHelp title="Aporte o retiro">
                El aporte aumenta el ahorro a la vista y los aportes. El retiro
                se descuenta únicamente del ahorro a la vista disponible; no es
                un pago de crédito.
              </FieldHelp>
              <select
                name="movement"
                value={movement}
                onChange={(event) => setMovement(event.target.value)}
                className="w-full rounded-md border p-2"
              >
                <option value="aporte">Aporte · distribuir 30% / 70%</option>
                <option value="retiro">Retiro · solo ahorro a la vista</option>
              </select>
            </label>
            <label>
              Valor
              <Input
                name="amount"
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
              {movement === "retiro" && balance && (
                <small>
                  Disponible para retiro: {money(Number(balance.vista_balance))}
                </small>
              )}
            </label>
            <label className="md:col-span-2">
              Referencia
              <FieldHelp title="¿Qué referencia registrar?">
                Usa el número del comprobante o una descripción que permita
                reconocer el origen del movimiento y evitar duplicados.
              </FieldHelp>
              <Input name="reference" maxLength={100} />
            </label>
            {balanceLoading && associateId && (
              <p className="form-guidance md:col-span-2" role="status">
                Consultando saldos…
              </p>
            )}
            {balance && (
              <div className="credit-capacity md:col-span-2">
                <div>
                  <small>Total ahorrado</small>
                  <b>{money(Number(balance.total_savings))}</b>
                </div>
                <div>
                  <small>Ahorro a la vista · 30%</small>
                  <b>{money(Number(balance.vista_balance))}</b>
                </div>
                <div>
                  <small>Aportes · 70% y base de crédito</small>
                  <b>{money(Number(balance.contributions_balance))}</b>
                </div>
              </div>
            )}
            {associateId && Number(amount) > 0 && (
              <section
                className="operation-review md:col-span-2"
                aria-label="Resumen antes de guardar"
              >
                <b>Revisa antes de {requiresReview ? "enviar" : "guardar"}</b>
                <p>
                  {movement === "aporte" ? "Aporte" : "Retiro"} de{" "}
                  <strong>{money(Number(amount))}</strong> ·{" "}
                  {
                    associates.find(
                      (person) => String(person.id) === associateId,
                    )?.first_name
                  }{" "}
                  {
                    associates.find(
                      (person) => String(person.id) === associateId,
                    )?.last_name
                  }
                </p>
                {movement === "aporte" && (
                  <small>
                    Ahorro a la vista:{" "}
                    {money(Math.round(Number(amount) * 0.3 * 100) / 100)} ·
                    Aportes:{" "}
                    {money(
                      Number(amount) -
                        Math.round(Number(amount) * 0.3 * 100) / 100,
                    )}
                  </small>
                )}
                <small>
                  {requiresReview
                    ? "Se enviará para revisión; el saldo cambia al aprobarse."
                    : "Se aplicará al saldo y quedará en el historial del asociado."}
                </small>
              </section>
            )}
            <div>
              <Button
                className="violet-button"
                type="submit"
                disabled={
                  busy ||
                  loading ||
                  Boolean(error) ||
                  !associates.length ||
                  !products.length ||
                  !associateId ||
                  balanceLoading ||
                  (movement === "retiro" &&
                    (!balance ||
                      Number(amount) > Number(balance.vista_balance)))
                }
              >
                {busy
                  ? "Guardando…"
                  : requiresReview
                    ? "Enviar movimiento para revisión"
                    : "Guardar movimiento"}
              </Button>
              {notice && (
                <small className="ml-3" role="status">
                  {notice}
                </small>
              )}
            </div>
          </form>
        )}
      </section>
      <section className="data-panel mt-6">
        <div className="table-tools">
          <b>Operaciones registradas</b>
          <div className="flex items-center gap-2">
            <small>
              {loading
                ? "Cargando…"
                : `${loading || error ? "—" : rows.length} registros`}
            </small>
            <Button
              variant="outline"
              onClick={() => void reload()}
              disabled={loading}
            >
              Actualizar
            </Button>
          </div>
        </div>
        {loading ? (
          <div className="empty-state">Cargando movimientos…</div>
        ) : error ? (
          <div className="empty-state">
            <b>No se pudieron cargar los movimientos</b>
            <small>Revisa la conexión e inténtalo de nuevo.</small>
          </div>
        ) : rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asociado</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead>Movimiento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.first_name} {row.last_name}
                  </TableCell>
                  <TableCell>{row.product_name}</TableCell>
                  <TableCell>
                    {row.movement_type === "retiro"
                      ? "Retiro a la vista"
                      : "Aporte (30% / 70%)"}
                  </TableCell>
                  <TableCell>{money(Number(row.amount))}</TableCell>
                  <TableCell>
                    <StatusFor
                      value={
                        row.status === "en_revision"
                          ? "En revisión"
                          : row.status === "aplicado"
                            ? "Aplicado"
                            : row.status || "Pendiente"
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="empty-state">
            <b>Aún no hay movimientos</b>
            <small>
              Al registrar el primer aporte autorizado, quedará aquí su
              historial.
            </small>
          </div>
        )}
      </section>
    </div>
  );
}
