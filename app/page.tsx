"use client";

import { BrandLogo } from "@/components/fegcon/brand-logo";
import { DemoBanner } from "@/components/fegcon/demo-banner";

import { searchText } from "@/lib/search-text";

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
  Check,
  ChevronDown,
  ClipboardList,
  Command,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { Associates, Record } from "@/components/fegcon/associates";
import { Dashboard, Login } from "@/components/fegcon/dashboard";
import { ModuleBoundary } from "@/components/fegcon/module-boundary";
import { ModuleGuide } from "@/components/fegcon/module-guide";
import {
  ApiJson,
  Associate,
  Avatar,
  hasAccess,
  IconButton,
  nav,
  PermissionContext,
  readJson,
  roleLabel,
  SessionUser,
  titles,
  View,
  viewModules,
} from "@/components/fegcon/shared";
import { TaskFinder } from "@/components/fegcon/task-finder";

const BusinessRulesPanel = lazy(() =>
  import("@/components/fegcon/administration").then((module) => ({
    default: module.BusinessRulesPanel,
  })),
);
const OperatorHub = lazy(() =>
  import("@/components/fegcon/administration").then((module) => ({
    default: module.OperatorHub,
  })),
);
const SuperadminHub = lazy(() =>
  import("@/components/fegcon/administration").then((module) => ({
    default: module.SuperadminHub,
  })),
);
const CompaniesPanel = lazy(() =>
  import("@/components/fegcon/companies").then((module) => ({
    default: module.CompaniesPanel,
  })),
);
const CreditScreen = lazy(() =>
  import("@/components/fegcon/credits").then((module) => ({
    default: module.CreditScreen,
  })),
);
const PayrollCollectionsScreen = lazy(() =>
  import("@/components/fegcon/payroll").then((module) => ({
    default: module.PayrollCollectionsScreen,
  })),
);
const PromissoryNotesScreen = lazy(() =>
  import("@/components/fegcon/promissory").then((module) => ({
    default: module.PromissoryNotesScreen,
  })),
);
const ListScreen = lazy(() =>
  import("@/components/fegcon/records").then((module) => ({
    default: module.ListScreen,
  })),
);
const Reports = lazy(() =>
  import("@/components/fegcon/records").then((module) => ({
    default: module.Reports,
  })),
);
const FinanceScreen = lazy(() =>
  import("@/components/fegcon/savings").then((module) => ({
    default: module.FinanceScreen,
  })),
);

export default function Home() {
  const [view, setView] = useState<View>("inicio");
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [creatingAssociate, setCreatingAssociate] = useState(false);
  const [editingAssociate, setEditingAssociate] = useState<Associate | null>(
    null,
  );
  const [retiringAssociate, setRetiringAssociate] = useState<Associate | null>(
    null,
  );
  const [savingAssociateChange, setSavingAssociateChange] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "error" | "info">(
    "success",
  );
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [associatesLoading, setAssociatesLoading] = useState(false);
  const [associatesError, setAssociatesError] = useState("");
  const [associatesReload, setAssociatesReload] = useState(0);
  const [companies, setCompanies] = useState<ApiJson[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState("");
  const [selectedAssociate, setSelectedAssociate] = useState<Associate | null>(
    null,
  );
  const [session, setSession] = useState<SessionUser | null>(null);
  const [csrf, setCsrf] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [authInitError, setAuthInitError] = useState(false);
  const [authRetry, setAuthRetry] = useState(0);
  const [authError, setAuthError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => {
    const q = searchText(query);
    return q
      ? associates.filter((a) =>
          searchText(`${a.name} ${a.document} ${a.company}`).includes(q),
        )
      : associates;
  }, [query, associates]);
  const go = (v: View) => {
    const module = viewModules[v];
    if (module && !hasAccess(session, module)) {
      setNotice("Esta sección no está habilitada para tu perfil.");
      setNoticeTone("info");
      return;
    }
    if (v !== view && (v === "asociados" || v === "perfil")) {
      setAssociatesLoading(true);
      setAssociatesError("");
    }
    setView(v);
    setMenuOpen(false);
    setAccountOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const reloadAssociates = () => {
    setAssociatesLoading(true);
    setAssociatesError("");
    setAssociatesReload((value) => value + 1);
  };
  const notify = (
    message: string,
    tone: "success" | "error" | "info" = "success",
  ) => {
    setNotice(message);
    setNoticeTone(tone);
  };
  const logout = async () => {
    try {
      const response = await apiFetch("/api/?action=logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CSRF-Token": csrf },
      });
      if (!response.ok) throw new Error("No fue posible cerrar la sesión.");
      setSession(null);
      setCsrf("");
      setAssociates([]);
      setCompanies([]);
      setSelectedAssociate(null);
      setAccountOpen(false);
      setView("inicio");
    } catch {
      notify(
        "No se pudo cerrar la sesión. Revisa tu conexión e inténtalo de nuevo.",
        "error",
      );
    }
  };
  useEffect(() => {
    const closeOverlays = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setAccountOpen(false);
      }
    };
    window.addEventListener("keydown", closeOverlays);
    return () => window.removeEventListener("keydown", closeOverlays);
  }, []);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/?action=me", { credentials: "same-origin" })
      .then(async (response) => {
        if (response.status === 401 || response.status === 403)
          return { user: null };
        if (!response.ok)
          throw new Error("No fue posible consultar el servicio de acceso.");
        return readJson(response);
      })
      .then((data) => {
        if (cancelled) return;
        if (data.user) {
          setSession(data.user);
          setCsrf(data.csrf || "");
          setView("inicio");
        } else {
          setSession(null);
          setCsrf("");
        }
      })
      .catch(() => {
        if (!cancelled) setAuthInitError(true);
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authRetry]);
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setCompaniesLoading(true);
      apiFetch("/api/?action=companies", { credentials: "same-origin" })
        .then(async (response) => {
          if (!response.ok) {
            const data = await readJson(response);
            throw new Error(
              data.error || "No fue posible consultar las empresas.",
            );
          }
          return readJson(response);
        })
        .then((data) => {
          if (!cancelled && Array.isArray(data.companies)) {
            setCompanies(data.companies);
            setCompaniesError("");
          }
        })
        .catch((reason) => {
          if (!cancelled)
            setCompaniesError(
              reason instanceof Error
                ? reason.message
                : "No fue posible consultar las empresas.",
            );
        })
        .finally(() => {
          if (!cancelled) setCompaniesLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [session]);
  useEffect(() => {
    if (!session || !["asociados", "perfil"].includes(view)) return;
    let cancelled = false;
    setAssociatesLoading(true);
    apiFetch(
      `/api/?action=associates&q=${encodeURIComponent(debouncedQuery)}`,
      { credentials: "same-origin" },
    )
      .then(async (response) => {
        if (!response.ok) {
          const data = await readJson(response);
          throw new Error(
            data.error || "No fue posible consultar los asociados.",
          );
        }
        return readJson(response);
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data.associates)) {
          setAssociates(
            data.associates.map(
              (a: {
                id: number;
                first_name: string;
                last_name: string;
                document_number: string;
                company: string | null;
                email: string | null;
                phone: string | null;
                status: string;
                created_at: string;
              }) => ({
                id: a.id,
                name: `${a.first_name} ${a.last_name}`,
                firstName: a.first_name,
                lastName: a.last_name,
                document: a.document_number,
                company: a.company || "Sin empresa asignada",
                email: a.email || "",
                phone: a.phone || "",
                status:
                  a.status === "activo"
                    ? "Activo"
                    : a.status === "retirado"
                      ? "Retirado"
                      : "Pendiente",
                updated: new Date(a.created_at).toLocaleDateString("es-CO"),
              }),
            ),
          );
          setAssociatesError("");
        }
      })
      .catch((reason) => {
        if (!cancelled)
          setAssociatesError(
            reason instanceof Error
              ? reason.message
              : "No se pudieron consultar los asociados.",
          );
      })
      .finally(() => {
        if (!cancelled) setAssociatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, view, associatesReload, debouncedQuery]);
  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const first = String(form.get("first") || "").trim(),
      last = String(form.get("last") || "").trim(),
      doc = String(form.get("doc") || "").trim();
    if (!first || !last || !doc || creatingAssociate) return;
    const payload = {
      firstName: first,
      lastName: last,
      documentNumber: doc,
      company: String(form.get("company") || ""),
      email: String(form.get("email") || ""),
      phone: String(form.get("phone") || ""),
    };
    setCreatingAssociate(true);
    try {
      const response = await apiFetch("/api/?action=associates", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify(payload),
      });
      const data = await readJson(response);
      if (!response.ok) {
        notify(data.error || "No fue posible guardar el asociado.", "error");
        return;
      }
      setNewOpen(false);
      if (data.pending_approval) {
        notify(data.message, "info");
        go("mis_solicitudes");
        return;
      }
      const a = data.associate;
      setAssociates((items) => [
        {
          id: a.id,
          name: `${a.firstName} ${a.lastName}`,
          firstName: a.firstName,
          lastName: a.lastName,
          document: a.documentNumber,
          company: a.company || "Sin empresa asignada",
          email: a.email || "",
          phone: a.phone || "",
          status: "Activo",
          updated: new Date().toLocaleDateString("es-CO"),
        },
        ...items,
      ]);
      setQuery("");
      go("asociados");
      notify("Asociado creado y activo.");
    } catch {
      notify("No se pudo conectar con el servidor.", "error");
    } finally {
      setCreatingAssociate(false);
    }
  };
  const updateAssociate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingAssociate || savingAssociateChange) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      id: editingAssociate.id,
      documentType: "CC",
      documentNumber: String(form.get("doc") || "").trim(),
      firstName: String(form.get("first") || "").trim(),
      lastName: String(form.get("last") || "").trim(),
      company: String(form.get("company") || "").trim(),
      email: String(form.get("email") || "").trim(),
      phone: String(form.get("phone") || "").trim(),
    };
    setSavingAssociateChange(true);
    try {
      const response = await apiFetch("/api/?action=associates", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify(payload),
      });
      const data = await readJson(response);
      if (!response.ok) {
        notify(data.error || "No fue posible actualizar el asociado.", "error");
        return;
      }
      setEditingAssociate(null);
      if (data.pending_approval) {
        notify(data.message, "info");
        go("mis_solicitudes");
        return;
      }
      const updated: Associate = {
        ...editingAssociate,
        document: payload.documentNumber,
        firstName: payload.firstName,
        lastName: payload.lastName,
        name: `${payload.firstName} ${payload.lastName}`,
        company: payload.company || "Sin empresa asignada",
        email: payload.email,
        phone: payload.phone,
        updated: new Date().toLocaleDateString("es-CO"),
      };
      setAssociates((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSelectedAssociate((current) =>
        current?.id === updated.id ? updated : current,
      );
      notify("Datos del asociado actualizados.");
    } catch {
      notify("No se pudo conectar con el servidor.", "error");
    } finally {
      setSavingAssociateChange(false);
    }
  };
  const retireAssociate = async () => {
    if (!retiringAssociate || savingAssociateChange) return;
    setSavingAssociateChange(true);
    try {
      const response = await apiFetch(
        `/api/?action=associates&id=${retiringAssociate.id}`,
        {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "X-CSRF-Token": csrf },
        },
      );
      const data = await readJson(response);
      if (!response.ok) {
        notify(data.error || "No fue posible retirar el asociado.", "error");
        return;
      }
      setRetiringAssociate(null);
      if (data.pending_approval) {
        notify(data.message, "info");
        go("mis_solicitudes");
        return;
      }
      const retired = { ...retiringAssociate, status: "Retirado" as const };
      setAssociates((items) =>
        items.map((item) => (item.id === retired.id ? retired : item)),
      );
      setSelectedAssociate((current) =>
        current?.id === retired.id ? retired : current,
      );
      notify("Asociado retirado. Su historial financiero se conservó.");
    } catch {
      notify("No se pudo conectar con el servidor.", "error");
    } finally {
      setSavingAssociateChange(false);
    }
  };
  const login = async (email: string, password: string) => {
    setAuthError("");
    try {
      const response = await apiFetch("/api/?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email, password }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setAuthError(data.error || "No fue posible iniciar sesión.");
        return;
      }
      setAuthInitError(false);
      setSession(data.user);
      setCsrf(data.csrf);
      setView("inicio");
    } catch {
      setAuthError("No se pudo conectar con el servidor.");
    }
  };
  if (!authReady)
    return (
      <main className="access-loading" role="status">
        <BrandLogo />
        <span className="access-loader" aria-hidden="true" />
        <span>Preparando tu espacio de trabajo…</span>
      </main>
    );
  if (!session)
    return (
      <Login
        error={authError}
        onLogin={login}
        serviceUnavailable={authInitError}
      />
    );
  return (
    <PermissionContext.Provider value={session.permissions}>
      <div className="fegcon-app">
        <a className="skip-link" href="#contenido-principal">
          Saltar al contenido
        </a>
        <aside className={`app-rail ${menuOpen ? "rail-open" : ""}`}>
          <div className="brand">
            <div className="brand-identity">
              <BrandLogo />
              <small>Gestión interna</small>
            </div>
            <button
              aria-label="Cerrar menú de módulos"
              onClick={() => setMenuOpen(false)}
              className="rail-close"
            >
              <X />
            </button>
          </div>
          <nav aria-label="Módulos de FEGCON">
            {nav.map((group) => {
              const items = group.items.filter((item) =>
                hasAccess(session, viewModules[item.id] || "inicio"),
              );
              return items.length ? (
                <div className="nav-group" key={group.label}>
                  <p>{group.label}</p>
                  {items.map(({ id, label, icon: Icon }) => (
                    <button
                      onClick={() => go(id)}
                      className={view === id ? "is-active" : ""}
                      aria-current={view === id ? "page" : undefined}
                      key={id}
                    >
                      <Icon />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              ) : null;
            })}
            {(session.role === "superadmin" ||
              hasAccess(session, "rules") ||
              hasAccess(session, "approvals")) && (
              <div className="nav-group">
                <p>ADMINISTRACIÓN</p>
                {session.role === "superadmin" ? (
                  <button
                    onClick={() => go("administracion")}
                    className={
                      view === "administracion" || view === "aprobaciones"
                        ? "is-active"
                        : ""
                    }
                  >
                    <ShieldCheck />
                    <span>Centro de control</span>
                  </button>
                ) : (
                  <>
                    {hasAccess(session, "rules") && (
                      <button
                        onClick={() => go("configuracion")}
                        className={view === "configuracion" ? "is-active" : ""}
                      >
                        <Settings />
                        <span>Reglas del fondo</span>
                      </button>
                    )}
                    {hasAccess(session, "approvals") && (
                      <button
                        onClick={() => go("mis_solicitudes")}
                        className={
                          view === "mis_solicitudes" ? "is-active" : ""
                        }
                      >
                        <ClipboardList />
                        <span>Mis solicitudes</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </nav>
          <div className="rail-bottom">
            <TaskFinder
              go={go}
              canAccess={(module) => hasAccess(session, module)}
            />
            <div className="account-wrap">
              <button
                className="profile-chip"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((open) => !open)}
              >
                <Avatar name={session.name} />
                <span>
                  <b>{session.name}</b>
                  <small>{roleLabel(session)}</small>
                </span>
                <ChevronDown />
              </button>
              {accountOpen && (
                <div className="account-menu">
                  <div>
                    <b>{session.name}</b>
                    <small>{session.email}</small>
                  </div>
                  <button onClick={logout}>
                    <LogOut />
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
        {menuOpen && (
          <button
            aria-label="Cerrar menú"
            className="rail-scrim"
            onClick={() => setMenuOpen(false)}
          />
        )}
        <div className={`app-area ${session.demo ? "demo-workspace" : ""}`}>
          {session.demo && <DemoBanner />}
          <header className="app-topbar">
            <div className="location">
              <IconButton
                label="Abrir menú de módulos"
                onClick={() => setMenuOpen(true)}
              >
                <Menu />
              </IconButton>
              <span>
                FEGCON <i /> Gestión financiera
              </span>
              <b>{titles[view]}</b>
            </div>
            {hasAccess(session, "associates") && (
              <form
                className="global-search"
                role="search"
                onSubmit={(event) => {
                  event.preventDefault();
                  go("asociados");
                }}
              >
                <Search />
                <input
                  ref={searchRef}
                  aria-label="Buscar asociados por nombre o documento"
                  placeholder="Buscar asociados por nombre o documento"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <kbd>
                  <Command /> K
                </kbd>
              </form>
            )}
          </header>
          <main className="app-content" id="contenido-principal">
            {notice && (
              <div className={`flash-message ${noticeTone}`} role="status">
                {noticeTone === "success" ? <Check /> : null}
                {notice}
                <button
                  aria-label="Cerrar mensaje"
                  onClick={() => setNotice("")}
                >
                  <X />
                </button>
              </div>
            )}
            <ModuleBoundary key={view} onHome={() => go("inicio")}>
              <Suspense
                fallback={
                  <div className="empty-state" role="status">
                    <b>Abriendo {titles[view]}…</b>
                    <small>Estamos preparando tu espacio de trabajo.</small>
                  </div>
                }
              >
                {view === "inicio" ? (
                  <Dashboard go={go} csrf={csrf} session={session} />
                ) : view === "asociados" ? (
                  <Associates
                    data={filtered}
                    role={session.role}
                    onOpen={(associate) => {
                      setSelectedAssociate(associate);
                      go("perfil");
                    }}
                    onEdit={setEditingAssociate}
                    onRetire={setRetiringAssociate}
                    onNew={() => setNewOpen(true)}
                    query={query}
                    onQueryChange={setQuery}
                    loading={associatesLoading}
                    error={associatesError}
                    onRetry={reloadAssociates}
                  />
                ) : view === "perfil" && selectedAssociate ? (
                  <Record
                    associate={selectedAssociate}
                    onBack={() => go("asociados")}
                  />
                ) : view === "perfil" ? (
                  <Associates
                    data={filtered}
                    role={session.role}
                    onOpen={(associate) => {
                      setSelectedAssociate(associate);
                      go("perfil");
                    }}
                    onEdit={setEditingAssociate}
                    onRetire={setRetiringAssociate}
                    onNew={() => setNewOpen(true)}
                    query={query}
                    onQueryChange={setQuery}
                    loading={associatesLoading}
                    error={associatesError}
                    onRetry={reloadAssociates}
                  />
                ) : view === "empresas" ? (
                  <CompaniesPanel csrf={csrf} role={session.role} go={go} />
                ) : view === "reportes" ? (
                  <Reports go={go} />
                ) : view === "administracion" || view === "aprobaciones" ? (
                  session.role === "superadmin" ? (
                    <SuperadminHub
                      key={view}
                      csrf={csrf}
                      go={go}
                      initialSection={
                        view === "aprobaciones" ? "aprobaciones" : "resumen"
                      }
                    />
                  ) : (
                    <Dashboard go={go} csrf={csrf} session={session} />
                  )
                ) : view === "configuracion" || view === "mis_solicitudes" ? (
                  session.role === "superadmin" && view === "configuracion" ? (
                    <BusinessRulesPanel csrf={csrf} role={session.role} />
                  ) : session.role === "operador" ? (
                    <OperatorHub
                      key={view}
                      csrf={csrf}
                      initialSection={
                        view === "mis_solicitudes" ? "solicitudes" : "reglas"
                      }
                    />
                  ) : (
                    <Dashboard go={go} csrf={csrf} session={session} />
                  )
                ) : view === "pagares" ? (
                  <PromissoryNotesScreen
                    csrf={csrf}
                    role={session.role}
                    go={go}
                  />
                ) : view === "cobros" ? (
                  <PayrollCollectionsScreen
                    csrf={csrf}
                    role={session.role}
                    go={go}
                  />
                ) : view === "creditos" ? (
                  <CreditScreen csrf={csrf} role={session.role} go={go} />
                ) : view === "ahorros" ? (
                  <FinanceScreen type="ahorro" csrf={csrf} go={go} />
                ) : (
                  <ListScreen
                    key={view}
                    view={view}
                    csrf={csrf}
                    role={session.role}
                    go={go}
                  />
                )}
              </Suspense>
            </ModuleBoundary>
            <ModuleGuide view={view} role={session.role} />
          </main>
        </div>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogContent className="associate-dialog sm:max-w-2xl">
            <DialogHeader>
              <p className="dialog-eyebrow">AFILIACIONES</p>
              <DialogTitle>Crear asociado</DialogTitle>
              <DialogDescription>
                {session.role === "operador"
                  ? "Al guardar, la solicitud quedará pendiente de revisión."
                  : "El registro quedará activo al guardarlo y la acción se añadirá a la bitácora."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={create} className="new-form">
              <div>
                <label>
                  Nombres
                  <Input name="first" autoComplete="given-name" required />
                </label>
                <label>
                  Apellidos
                  <Input name="last" autoComplete="family-name" required />
                </label>
                <label>
                  Documento
                  <Input name="doc" inputMode="numeric" required />
                </label>
                <label>
                  Empresa
                  <select
                    name="company"
                    className="w-full rounded-md border p-2"
                  >
                    <option value="">Sin empresa / independiente</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.name}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  {companiesError ? (
                    <small role="alert">
                      No se pudo consultar la lista de empresas. Puedes guardar
                      el asociado sin asignarla y completar ese dato después.
                    </small>
                  ) : companiesLoading ? (
                    <small>Consultando empresas…</small>
                  ) : (
                    !companies.length && (
                      <small>
                        Si pertenece a una empresa con libranza, regístrala
                        antes en Empresas.
                      </small>
                    )
                  )}
                </label>
                <label>
                  Correo electrónico
                  <Input name="email" type="email" autoComplete="email" />
                </label>
                <label>
                  Celular
                  <Input name="phone" type="tel" autoComplete="tel" />
                </label>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setNewOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="violet-button"
                  aria-label="Guardar asociado"
                  disabled={creatingAssociate}
                >
                  {creatingAssociate
                    ? "Guardando…"
                    : session.role === "operador"
                      ? "Enviar para revisión"
                      : "Guardar asociado"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog
          open={Boolean(editingAssociate)}
          onOpenChange={(open) => {
            if (!open && !savingAssociateChange) setEditingAssociate(null);
          }}
        >
          <DialogContent className="associate-dialog sm:max-w-2xl">
            <DialogHeader>
              <p className="dialog-eyebrow">DIRECTORIO FEGCON</p>
              <DialogTitle>Editar datos del asociado</DialogTitle>
              <DialogDescription>
                {session.role === "operador"
                  ? "El cambio quedará pendiente de revisión antes de aplicarse."
                  : "Los cambios se aplicarán y quedarán registrados en la bitácora."}
              </DialogDescription>
            </DialogHeader>
            {editingAssociate && (
              <form onSubmit={updateAssociate} className="new-form">
                <div>
                  <label>
                    Nombres
                    <Input
                      name="first"
                      defaultValue={editingAssociate.firstName}
                      autoComplete="given-name"
                      required
                    />
                  </label>
                  <label>
                    Apellidos
                    <Input
                      name="last"
                      defaultValue={editingAssociate.lastName}
                      autoComplete="family-name"
                      required
                    />
                  </label>
                  <label>
                    Documento
                    <Input
                      name="doc"
                      defaultValue={editingAssociate.document}
                      inputMode="numeric"
                      required
                    />
                  </label>
                  <label>
                    Empresa
                    <select
                      name="company"
                      defaultValue={
                        editingAssociate.company === "Sin empresa asignada"
                          ? ""
                          : editingAssociate.company
                      }
                      className="w-full rounded-md border p-2"
                    >
                      <option value="">Sin empresa / independiente</option>
                      {editingAssociate.company &&
                        editingAssociate.company !== "Sin empresa asignada" &&
                        !companies.some(
                          (company) =>
                            company.name === editingAssociate.company,
                        ) && (
                          <option value={editingAssociate.company}>
                            {editingAssociate.company} · empresa actual
                          </option>
                        )}
                      {companies.map((company) => (
                        <option key={company.id} value={company.name}>
                          {company.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Correo electrónico
                    <Input
                      name="email"
                      type="email"
                      defaultValue={editingAssociate.email}
                      autoComplete="email"
                    />
                  </label>
                  <label>
                    Celular
                    <Input
                      name="phone"
                      defaultValue={editingAssociate.phone}
                      type="tel"
                      autoComplete="tel"
                    />
                  </label>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditingAssociate(null)}
                    disabled={savingAssociateChange}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="violet-button"
                    disabled={savingAssociateChange}
                  >
                    {savingAssociateChange
                      ? "Guardando…"
                      : session.role === "operador"
                        ? "Enviar cambio"
                        : "Guardar cambios"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
        <Dialog
          open={Boolean(retiringAssociate)}
          onOpenChange={(open) => {
            if (!open && !savingAssociateChange) setRetiringAssociate(null);
          }}
        >
          <DialogContent className="approval-dialog">
            <DialogHeader>
              <p className="dialog-eyebrow">DIRECTORIO FEGCON</p>
              <DialogTitle>Retirar asociado</DialogTitle>
              <DialogDescription>
                {retiringAssociate?.name} dejará de estar activo. Los créditos,
                pagos y movimientos anteriores se conservarán.{" "}
                {session.role === "operador"
                  ? "El retiro quedará pendiente de revisión."
                  : "El retiro quedará registrado en la bitácora."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setRetiringAssociate(null)}
                disabled={savingAssociateChange}
              >
                Cancelar
              </Button>
              <Button
                className="violet-button"
                onClick={() => void retireAssociate()}
                disabled={savingAssociateChange}
              >
                {savingAssociateChange
                  ? "Procesando…"
                  : session.role === "operador"
                    ? "Enviar solicitud"
                    : "Confirmar retiro"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionContext.Provider>
  );
}
