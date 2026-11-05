"use client";

import { apiFetch } from "@/lib/fegcon-api";

import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileCheck2,
  HandCoins,
  ReceiptText,
  Users,
  WalletCards,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  ApiJson,
  hasAccess,
  money,
  readJson,
  SessionUser,
  Status,
  View,
} from "@/components/fegcon/shared";

export type DashboardItem = {
  title: string;
  person: string;
  detail: string;
  value: string;
  state: string;
  icon: LucideIcon;
  tone: "bad" | "warn";
  target: View;
};

export function Dashboard({
  go,
  csrf,
  session,
}: {
  go: (view: View) => void;
  csrf: string;
  session: SessionUser;
}) {
  const [live, setLive] = useState({
    asociados: 0,
    afiliaciones_pendientes: 0,
    pagos_aplicados: 0,
    cartera_abierta: 0,
  });
  const [attention, setAttention] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const role = session.role;
  const can = (module: string) => hasAccess(session, module);
  useEffect(() => {
    let cancelled = false;
    const read = (action: string) =>
      apiFetch(`/api/?action=${action}`, { credentials: "same-origin" }).then(
        async (response) =>
          response.ok
            ? readJson(response)
            : Promise.reject(
                new Error("No fue posible consultar la base de datos."),
              ),
      );
    const requests = [
      read("dashboard"),
      can("affiliations") ? read("affiliations") : Promise.resolve(null),
      can("receivables") ? read("receivables") : Promise.resolve(null),
      can("promissory") ? read("promissory-notes") : Promise.resolve(null),
      role === "superadmin" || can("approvals")
        ? read("approval-requests")
        : Promise.resolve(null),
    ];
    Promise.allSettled(requests).then((results) => {
      if (cancelled) return;
      const [dashboard, affiliations, receivables, notes, approvals] =
        results.map((result) =>
          result.status === "fulfilled" ? result.value : null,
        );
      if (dashboard?.metrics)
        setLive({
          asociados: Number(dashboard.metrics.asociados || 0),
          afiliaciones_pendientes: Number(
            dashboard.metrics.afiliaciones_pendientes || 0,
          ),
          pagos_aplicados: Number(dashboard.metrics.pagos_aplicados || 0),
          cartera_abierta: Number(dashboard.metrics.cartera_abierta || 0),
        });
      const items: DashboardItem[] = [];
      if (can("affiliations"))
        for (const row of (affiliations?.requests || []).filter(
          (item: ApiJson) => item.status === "en_revision",
        ))
          items.push({
            title: "Afiliación en revisión",
            person: `${row.first_name} ${row.last_name}`,
            detail: `Documento ${row.document_number}`,
            value: "",
            state: "En revisión",
            icon: ClipboardList,
            tone: "warn",
            target: "afiliaciones",
          });
      if (can("receivables"))
        for (const row of (receivables?.receivables || []).filter(
          (item: ApiJson) =>
            item.status === "vencida" ||
            (item.status === "por_vencer" &&
              item.due_date < new Date().toISOString().slice(0, 10)),
        ))
          items.push({
            title:
              row.status === "vencida" ||
              row.due_date < new Date().toISOString().slice(0, 10)
                ? "Obligación vencida"
                : "Obligación próxima a vencer",
            person: `${row.first_name} ${row.last_name}`,
            detail: `${row.reference} · ${row.due_date}`,
            value: money(Number(row.amount)),
            state: "Revisar",
            icon: AlertTriangle,
            tone: "bad",
            target: "cartera",
          });
      if (can("promissory"))
        for (const row of (notes?.notes || []).filter((item: ApiJson) =>
          ["pendiente_firma", "borrador"].includes(item.status),
        ))
          items.push({
            title: "Pagaré pendiente",
            person: `${row.first_name} ${row.last_name}`,
            detail: row.note_number,
            value: "",
            state: row.status === "borrador" ? "Borrador" : "Pendiente",
            icon: FileCheck2,
            tone: "warn",
            target: "pagares",
          });
      if (role === "superadmin")
        for (const row of (approvals?.requests || []).filter(
          (item: ApiJson) => item.status === "pendiente",
        ))
          items.push({
            title: "Cambio por revisar",
            person: row.requested_by_name || "Supervisor",
            detail: row.summary,
            value: "",
            state: "Pendiente",
            icon: ClipboardList,
            tone: "warn",
            target: "aprobaciones",
          });
      const priority: Partial<Record<View, number>> = {
        cartera: 0,
        aprobaciones: 1,
        pagares: 2,
        afiliaciones: 3,
      };
      setAttention(
        items
          .sort((a, b) => (priority[a.target] ?? 4) - (priority[b.target] ?? 4))
          .slice(0, 6),
      );
      if (
        results.some((result) => result.status === "rejected") ||
        !dashboard?.metrics
      )
        setLoadError(
          "No fue posible consultar todos los módulos. El resumen puede estar incompleto.",
        );
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [csrf, role, session.permissions, retry]);
  const metrics = [
    ...(can("affiliations")
      ? [
          [
            loading || loadError ? "—" : String(live.afiliaciones_pendientes),
            "Afiliaciones por revisar",
            "Solicitudes pendientes",
            "pink",
          ],
        ]
      : []),
    ...(can("receivables") || can("credits")
      ? [
          [
            loading || loadError ? "—" : money(live.cartera_abierta),
            "Cartera abierta",
            "Obligaciones registradas",
            "orange",
          ],
        ]
      : []),
    ...(can("payments")
      ? [
          [
            loading || loadError ? "—" : money(live.pagos_aplicados),
            "Pagos aplicados",
            "Pagos registrados",
            "aqua",
          ],
        ]
      : []),
    ...(can("associates")
      ? [
          [
            loading || loadError ? "—" : String(live.asociados),
            "Asociados activos",
            "Personas vinculadas",
            "lime",
          ],
        ]
      : []),
  ];
  const hasActivity =
    (can("associates") && live.asociados > 0) ||
    (can("affiliations") && live.afiliaciones_pendientes > 0) ||
    (can("payments") && live.pagos_aplicados > 0) ||
    ((can("receivables") || can("credits")) && live.cartera_abierta > 0);
  const isEmpty =
    !loading && !loadError && !hasActivity && attention.length === 0;
  const allShortcuts: [LucideIcon, string, string, View, string][] = [
    [Users, "Asociados", "Directorio y novedades", "asociados", "associates"],
    [
      ClipboardList,
      "Afiliaciones",
      "Solicitudes de vinculación",
      "afiliaciones",
      "affiliations",
    ],
    [HandCoins, "Créditos", "Solicitudes y seguimiento", "creditos", "credits"],
    [
      WalletCards,
      "Ahorros y aportes",
      "Movimientos registrados",
      "ahorros",
      "savings",
    ],
    [
      ReceiptText,
      "Cartera",
      "Obligaciones y vencimientos",
      "cartera",
      "receivables",
    ],
    [Banknote, "Cobros de nómina", "Relaciones de cobro", "cobros", "payroll"],
    [CreditCard, "Pagos", "Recaudos aplicados", "pagos", "payments"],
    [FileCheck2, "Pagarés", "Documentos y firmas", "pagares", "promissory"],
  ];
  const shortcuts = allShortcuts.filter((item) => can(item[4]));
  return (
    <div className="dashboard">
      <section className={`hero-surface ${isEmpty ? "hero-empty" : ""}`}>
        <div className="hero-copy">
          <p>{isEmpty ? "TU ESPACIO DE TRABAJO" : "GESTIÓN FEGCON"}</p>
          <h1>
            {isEmpty ? (
              <>
                Un buen inicio
                <br />
                <span>para el fondo.</span>
              </>
            ) : (
              <>
                La operación
                <br />
                <span>en un solo lugar.</span>
              </>
            )}
          </h1>
          <small>
            {isEmpty
              ? "Aquí verás las tareas y datos disponibles para tu perfil. El espacio empieza a tomar forma con la primera operación."
              : "Indicadores y tareas disponibles según los accesos de tu perfil."}
          </small>
          <div>
            {shortcuts.length > 0 && (
              <Button
                onClick={() =>
                  go(attention[0]?.target || shortcuts[0]?.[3] || "inicio")
                }
                className="light-button"
              >
                <ArrowUpRight />
                {isEmpty
                  ? "Empezar"
                  : attention.length
                    ? "Revisar primer pendiente"
                    : can("associates")
                      ? "Consultar asociados"
                      : "Abrir mi espacio"}
              </Button>
            )}
            {can("rules") && (
              <button
                onClick={() => go("configuracion")}
                className="text-button"
              >
                Consultar reglas <ArrowUpRight />
              </button>
            )}
          </div>
        </div>
        <div className={`hero-chart ${isEmpty ? "hero-chart-empty" : ""}`}>
          <div className="chart-top">
            <span>ESTADO DEL ESPACIO</span>
            <Status
              tone={
                loading
                  ? "warn"
                  : loadError
                    ? "bad"
                    : isEmpty
                      ? "neutral"
                      : "good"
              }
            >
              {loading
                ? "Cargando"
                : loadError
                  ? "Resumen incompleto"
                  : isEmpty
                    ? "Aún sin actividad"
                    : "Datos actuales"}
            </Status>
          </div>
          <strong>
            {loading || loadError || !can("associates") ? "—" : live.asociados}
          </strong>
          <p>
            <span>
              {can("associates")
                ? "Asociados activos"
                : "Información autorizada para tu perfil"}
            </span>
          </p>
          <div className="hero-live-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="hero-disc" aria-hidden="true" />
      </section>
      {loadError && (
        <div
          className="auth-error flex items-center justify-between gap-3"
          role="alert"
        >
          <span>{loadError}</span>
          <Button
            variant="outline"
            onClick={() => {
              setLoading(true);
              setLoadError("");
              setRetry((value) => value + 1);
            }}
            disabled={loading}
          >
            Reintentar
          </Button>
        </div>
      )}
      <section className="metrics" aria-label="Resumen de actividad">
        {metrics.map(([n, label, detail, color]) => (
          <Metric
            key={label}
            n={String(n)}
            label={String(label)}
            detail={String(detail)}
            color={String(color)}
          />
        ))}
      </section>
      <section className="dashboard-grid">
        <div className="decision-board">
          <div className="board-header">
            <div>
              <p>TU BANDEJA</p>
              <h2>Lo que requiere atención</h2>
            </div>
            {role === "superadmin" && (
              <button onClick={() => go("aprobaciones")}>
                Ver solicitudes <ChevronRight />
              </button>
            )}
          </div>
          {attention.length ? (
            attention.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  className="decision-row"
                  key={`${item.title}-${item.detail}-${index}`}
                  onClick={() => go(item.target)}
                >
                  <span className={`decision-icon ${item.tone}`}>
                    <Icon />
                  </span>
                  <span className="decision-copy">
                    <b>{item.title}</b>
                    <small>
                      {item.person} · {item.detail}
                    </small>
                  </span>
                  {item.value && <strong>{item.value}</strong>}
                  <Status tone={item.tone}>{item.state}</Status>
                  <ChevronRight />
                </button>
              );
            })
          ) : (
            <div className="empty-state">
              <b>
                {loading
                  ? "Consultando tu bandeja…"
                  : loadError
                    ? "No pudimos completar la consulta"
                    : "Todo está al día"}
              </b>
              <small>
                {loading
                  ? "Estamos reuniendo la información disponible para tu perfil."
                  : loadError
                    ? "Revisa la conexión e inténtalo de nuevo."
                    : "Cuando haya una tarea que requiera atención, aparecerá aquí."}
              </small>
            </div>
          )}
        </div>
      </section>
      <section className="quick-routes">
        <div>
          <p>MÓDULOS DISPONIBLES</p>
          <h2>Continúa desde aquí</h2>
        </div>
        <div>
          {shortcuts.map(([Icon, title, detail, target]) => {
            const I = Icon as LucideIcon;
            return (
              <button onClick={() => go(target)} key={String(title)}>
                <span>
                  <I />
                </span>
                <b>{String(title)}</b>
                <small>{String(detail)}</small>
                <ArrowUpRight />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
export function Metric({
  n,
  label,
  detail,
  color,
}: {
  n: string;
  label: string;
  detail: string;
  color: string;
}) {
  return (
    <div className={`metric-card ${color}`}>
      <i />
      <p>{label}</p>
      <strong>{n}</strong>
      <small>{detail}</small>
    </div>
  );
}

export { Login } from "./login";
