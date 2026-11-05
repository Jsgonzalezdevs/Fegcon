"use client";

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
import { ArrowUpRight, ChevronRight, Plus, Search } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import {
  ApiJson,
  Associate,
  Avatar,
  money,
  readJson,
  StatusFor,
  useCapability,
} from "@/components/fegcon/shared";

export function Heading({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <small>{text}</small>
      </div>
      {children}
    </div>
  );
}
export function FirstActionPanel({
  title,
  detail,
  action,
  onAction,
  loading = false,
  error = "",
  onRetry,
}: {
  title: string;
  detail: string;
  action: string;
  onAction: () => void;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  return (
    <section className="first-action-panel">
      <span className="first-action-icon">
        <ArrowUpRight />
      </span>
      <p>
        {loading
          ? "CARGANDO INFORMACIÓN"
          : error
            ? "NO SE PUDO CONTINUAR"
            : "PRIMER PASO"}
      </p>
      <h2>
        {loading
          ? "Consultando registros…"
          : error
            ? "Revisa la conexión"
            : title}
      </h2>
      <small>
        {loading
          ? "Espera un momento mientras consultamos los datos reales."
          : error || detail}
      </small>
      {error && onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          Reintentar
        </Button>
      ) : (
        !loading && (
          <Button className="violet-button" onClick={onAction}>
            {action}
            <ChevronRight />
          </Button>
        )
      )}
    </section>
  );
}
export function Associates({
  data,
  role,
  onOpen,
  onEdit,
  onRetire,
  onNew,
  query,
  onQueryChange,
  loading,
  error,
  onRetry,
}: {
  data: Associate[];
  role: string;
  onOpen: (associate: Associate) => void;
  onEdit: (associate: Associate) => void;
  onRetire: (associate: Associate) => void;
  onNew: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  const canManage = useCapability("associates");
  return (
    <div className="page">
      <Heading
        eyebrow="DIRECTORIO FEGCON"
        title="Asociados"
        text="Consulta la información de las personas vinculadas al fondo y mantén sus datos al día."
      >
        {canManage && (
          <Button onClick={onNew} className="violet-button">
            <Plus />
            Nuevo asociado
          </Button>
        )}
      </Heading>
      <section className="data-panel">
        <div className="table-tools">
          <div>
            <Search />
            <Input
              aria-label="Buscar asociado"
              placeholder="Buscar por nombre, documento o empresa"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <small>{loading || error ? "" : `${data.length} registros`}</small>
            <Button variant="outline" onClick={onRetry} disabled={loading}>
              {loading ? "Consultando…" : "Actualizar"}
            </Button>
          </div>
        </div>
        {error ? (
          <div className="empty-state">
            <b>No se pudo consultar el directorio</b>
            <small>
              {error} No mostraremos una lista vacía hasta confirmar el
              resultado.
            </small>
            <Button variant="outline" onClick={onRetry}>
              Reintentar
            </Button>
          </div>
        ) : loading ? (
          <div className="empty-state">
            <b>Consultando asociados…</b>
            <small>Estamos leyendo los datos guardados del fondo.</small>
          </div>
        ) : data.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asociado</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Registro</TableHead>
                {canManage && <TableHead>Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((associate) => (
                <TableRow className="data-row" key={associate.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="person person-link"
                      aria-label={`Abrir ficha de ${associate.name}`}
                      onClick={() => onOpen(associate)}
                    >
                      <Avatar name={associate.name} />
                      <span>
                        <b>{associate.name}</b>
                        <small>CC {associate.document}</small>
                      </span>
                    </button>
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {associate.company}
                  </TableCell>
                  <TableCell>
                    <StatusFor value={associate.status} />
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {associate.updated}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => onEdit(associate)}
                        >
                          Editar
                        </Button>
                        {associate.status !== "Retirado" && (
                          <Button
                            variant="outline"
                            onClick={() => onRetire(associate)}
                          >
                            Retirar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="empty-state">
            <b>{query ? "No hay coincidencias" : "El directorio está vacío"}</b>
            <small>
              {query
                ? "Prueba con otro nombre, documento o empresa."
                : "El directorio se completará con las primeras afiliaciones."}
            </small>
            {!query && canManage && (
              <Button onClick={onNew} className="violet-button">
                <Plus />
                Registrar asociado
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export function Record({
  associate,
  onBack,
}: {
  associate: Associate;
  onBack: () => void;
}) {
  const [tab, setTab] = useState("Resumen");
  const canSavings = useCapability("savings", "view");
  const canPayments = useCapability("payments", "view");
  const canCredits = useCapability("credits", "view");
  const canNotes = useCapability("promissory", "view");
  const [records, setRecords] = useState<{
    movements: string[][];
    credits: string[][];
    notes: string[][];
  }>({ movements: [], credits: [], notes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const read = async (action: string, allowed: boolean) => {
      if (!allowed) return null;
      const response = await apiFetch(
        `/api/?action=${action}&associate_id=${associate.id}`,
      );
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(
          data.error || "No fue posible consultar una sección del historial.",
        );
      return data;
    };
    Promise.allSettled([
      read("savings-transactions", canSavings),
      read("payments", canPayments),
      read("credit-applications", canCredits),
      read("promissory-notes", canNotes),
    ]).then((results) => {
      if (cancelled) return;
      const [savings, payments, credits, notes] = results.map((result) =>
        result.status === "fulfilled" ? result.value : null,
      );
      const movementRows = [
        ...(savings?.transactions || [])
          .filter((row: ApiJson) => Number(row.associate_id) === associate.id)
          .map((row: ApiJson) => [
            new Date(row.created_at).toLocaleDateString("es-CO"),
            row.movement_type === "aporte" ? "Aporte" : "Retiro",
            row.product_name,
            money(Number(row.amount)),
            row.status,
          ]),
        ...(payments?.payments || [])
          .filter((row: ApiJson) => Number(row.associate_id) === associate.id)
          .map((row: ApiJson) => [
            row.received_on,
            "Pago",
            row.concept,
            money(Number(row.amount)),
            row.status,
          ]),
      ];
      const creditRows = (credits?.applications || [])
        .filter((row: ApiJson) => Number(row.associate_id) === associate.id)
        .map((row: ApiJson) => [
          String(row.id),
          row.product_name,
          `${row.requested_term_months} meses`,
          money(Number(row.requested_amount)),
          row.status,
        ]);
      const noteRows = (notes?.notes || [])
        .filter((row: ApiJson) => Number(row.associate_id) === associate.id)
        .map((row: ApiJson) => [
          row.note_number,
          row.credit_application_id
            ? `Solicitud #${row.credit_application_id}`
            : "Sin solicitud asociada",
          new Date(row.created_at).toLocaleDateString("es-CO"),
          row.status,
        ]);
      setRecords({
        movements: movementRows,
        credits: creditRows,
        notes: noteRows,
      });
      setError(
        results.some((result) => result.status === "rejected")
          ? "No pudimos consultar todo el historial. Los datos pueden estar incompletos; vuelve a intentarlo antes de tomar una decisión."
          : "",
      );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [associate.id, canSavings, canPayments, canCredits, canNotes, retry]);
  const tabs = [
    "Resumen",
    ...(canSavings || canPayments ? ["Movimientos"] : []),
    ...(canCredits ? ["Créditos"] : []),
    ...(canNotes ? ["Pagarés"] : []),
  ];
  const count = (value: number) => (loading || error ? "—" : String(value));
  return (
    <div className="record">
      <button onClick={onBack} className="back">
        ‹ Volver a asociados
      </button>
      <section className="record-hero">
        <div>
          <Avatar name={associate.name} large />
          <span>
            <StatusFor value={associate.status} />
            <h1>{associate.name}</h1>
            <p>
              CC {associate.document} · {associate.company}
            </p>
          </span>
        </div>
      </section>
      <nav className="record-nav" aria-label="Información del asociado">
        {tabs.map((item) => (
          <button
            key={item}
            className={tab === item ? "selected" : ""}
            aria-current={tab === item ? "page" : undefined}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </nav>
      {error && (
        <div className="auth-error record-load-error" role="alert">
          <span>{error}</span>
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true);
              setError("");
              setRetry((value) => value + 1);
            }}
          >
            Reintentar
          </Button>
        </div>
      )}
      {tab === "Resumen" ? (
        <section className="record-grid">
          <div className="profile-data">
            <p>DATOS REGISTRADOS</p>
            <h2>Perfil y contacto</h2>
            {[
              ["Correo electrónico", associate.email || "Sin registrar"],
              ["Celular", associate.phone || "Sin registrar"],
              ["Empresa", associate.company],
              ["Documento", associate.document],
              ["Estado", associate.status],
              ["Fecha de registro", associate.updated],
            ].map(([label, value]) => (
              <span key={label}>
                <small>{label}</small>
                <b>{value}</b>
              </span>
            ))}
          </div>
          <div className="watch-data">
            <p>RESUMEN</p>
            <h2>Actividad registrada</h2>
            <small>Historial del asociado disponible para tu perfil.</small>
            {(canSavings || canPayments) && (
              <div>
                <span>
                  <b>{count(records.movements.length)}</b>
                  <small>Movimientos</small>
                </span>
              </div>
            )}
            {canCredits && (
              <div>
                <span>
                  <b>{count(records.credits.length)}</b>
                  <small>Solicitudes de crédito</small>
                </span>
              </div>
            )}
            {canNotes && (
              <div>
                <span>
                  <b>{count(records.notes.length)}</b>
                  <small>Pagarés</small>
                </span>
              </div>
            )}
            {!canSavings && !canPayments && !canCredits && !canNotes && (
              <p>Tu perfil tiene acceso a los datos personales del asociado.</p>
            )}
          </div>
        </section>
      ) : error ? (
        <div className="empty-state">
          <b>Historial pendiente de verificar</b>
          <small>
            Reintenta la consulta para mostrar un resultado completo.
          </small>
        </div>
      ) : tab === "Movimientos" ? (
        <RecordTable
          loading={loading}
          headers={["Fecha", "Tipo", "Detalle", "Valor", "Estado"]}
          rows={records.movements}
        />
      ) : tab === "Créditos" ? (
        <RecordTable
          loading={loading}
          headers={["Solicitud", "Línea", "Plazo", "Monto", "Estado"]}
          rows={records.credits}
        />
      ) : (
        <RecordTable
          loading={loading}
          headers={["Número", "Solicitud", "Registro", "Estado"]}
          rows={records.notes}
        />
      )}
    </div>
  );
}

export function RecordTable({
  loading,
  headers,
  rows,
}: {
  loading: boolean;
  headers: string[];
  rows: string[][];
}) {
  if (loading)
    return <div className="empty-state">Cargando datos del asociado…</div>;
  if (!rows.length)
    return (
      <div className="empty-state">
        <b>Sin registros todavía</b>
        <small>
          Los movimientos asociados a esta persona aparecerán aquí al
          registrarlos.
        </small>
      </div>
    );
  return (
    <section className="data-panel history">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow className="data-row" key={row.join("-")}>
              {row.map((cell, index) => (
                <TableCell
                  className={index === 0 ? "font-semibold" : ""}
                  key={`${index}-${cell}`}
                >
                  {index === row.length - 1 ? <StatusFor value={cell} /> : cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
