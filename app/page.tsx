"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle, ArrowUpRight, Banknote, Building2,
  Check, ChevronDown, ChevronRight, ClipboardList, Command, CreditCard,
  FileCheck2, FileText, HandCoins, LayoutDashboard, LogOut, Menu, Plus,
  ReceiptText, Search, Settings, ShieldCheck, Users, WalletCards, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type View = "inicio" | "asociados" | "afiliaciones" | "ahorros" | "creditos" | "pagares" | "cartera" | "cobros" | "convenios" | "pagos" | "reportes" | "configuracion" | "administracion" | "aprobaciones" | "mis_solicitudes" | "perfil";
type Associate = { id: number; name: string; firstName: string; lastName: string; document: string; company: string; email: string; phone: string; status: "Activo" | "Pendiente" | "Retirado"; updated: string };
type SessionUser = { id: number; name: string; email: string; role: string };
type Nav = { id: View; label: string; icon: LucideIcon };

type ApiJson = ReturnType<typeof JSON.parse>;
const readJson = <T = ApiJson>(response: Response): Promise<T> => response.json() as Promise<T>;
const money = (v: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(v);
const nav: { label: string; items: Nav[] }[] = [
  { label: "ESPACIO DE TRABAJO", items: [{ id: "inicio", label: "Vista general", icon: LayoutDashboard }, { id: "asociados", label: "Asociados", icon: Users }, { id: "afiliaciones", label: "Afiliaciones", icon: ClipboardList }] },
  { label: "TESORERÍA", items: [{ id: "ahorros", label: "Ahorros y aportes", icon: WalletCards }, { id: "creditos", label: "Créditos", icon: HandCoins }, { id: "pagares", label: "Pagarés", icon: FileCheck2 }, { id: "cartera", label: "Cartera", icon: ReceiptText }, { id: "cobros", label: "Cobros de nómina", icon: Banknote }, { id: "pagos", label: "Pagos", icon: CreditCard }] },
  { label: "INTELIGENCIA", items: [{ id: "convenios", label: "Convenios", icon: Building2 }, { id: "reportes", label: "Reportes", icon: FileText }] },
];
const titles: Record<View, string> = { inicio: "Inicio", asociados: "Asociados", afiliaciones: "Afiliaciones", ahorros: "Ahorros y aportes", creditos: "Créditos", pagares: "Pagarés", cartera: "Cartera", cobros: "Cobros de nómina", convenios: "Convenios", pagos: "Pagos", reportes: "Reportes", configuracion: "Reglas y solicitudes", administracion: "Centro Superadmin", aprobaciones: "Aprobaciones", mis_solicitudes: "Mis solicitudes", perfil: "Ficha del asociado" };
function Avatar({ name, large = false }: { name: string; large?: boolean }) { return <span className={large ? "avatar avatar-lg" : "avatar"}>{name.split(" ").slice(0, 2).map((s) => s[0]).join("")}</span>; }
function Status({ children, tone = "neutral" }: { children: ReactNode; tone?: "good" | "warn" | "bad" | "neutral" | "violet" }) { return <span className={`status status-${tone}`}><i />{children}</span>; }
function StatusFor({ value }: { value: string }) { const normalized = value.toLowerCase().replaceAll("_", " "); const labels: Record<string, string> = { activo: "Activo", vigente: "Vigente", pagado: "Pagado", aplicada: "Aplicada", aplicado: "Aplicado", custodiado: "Custodiado", pendiente: "Pendiente", en_revision: "En revisión", "en revision": "En revisión", por_vencer: "Por vencer", vencida: "Vencida", vencido: "Vencido", aprobado: "Aprobado", aprobada: "Aprobada", rechazado: "Rechazado", rechazada: "Rechazada", desembolsada: "Desembolsada", borrador: "Borrador", inactivo: "Inactivo", anulado: "Anulado", anulada: "Anulada", recibido: "Recibido", conciliado: "Conciliado", firmado: "Firmado", pendiente_firma: "Pendiente de firma" }; const label = labels[normalized] || value; const tone = ["activo", "vigente", "pagado", "aplicado", "aplicada", "custodiado", "aprobado", "aprobada", "desembolsada", "firmado", "recibido", "conciliado"].includes(normalized) ? "good" : ["pendiente", "en revision", "por vencer", "borrador", "pendiente firma"].includes(normalized) ? "warn" : ["anulado", "anulada", "rechazado", "rechazada", "vencida", "vencido", "inactivo"].includes(normalized) ? "bad" : "neutral"; return <Status tone={tone}>{label}</Status>; }
function IconButton({ label, children, onClick }: { label: string; children: ReactNode; onClick?: () => void }) { return <button className="round-button" aria-label={label} onClick={onClick}>{children}</button>; }

export default function Home() {
  const [view, setView] = useState<View>("inicio");
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [creatingAssociate, setCreatingAssociate] = useState(false);
  const [editingAssociate, setEditingAssociate] = useState<Associate | null>(null);
  const [retiringAssociate, setRetiringAssociate] = useState<Associate | null>(null);
  const [savingAssociateChange, setSavingAssociateChange] = useState(false);
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "error" | "info">("success");
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [selectedAssociate, setSelectedAssociate] = useState<Associate | null>(null);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [csrf, setCsrf] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => { const q = query.toLowerCase(); return q ? associates.filter((a) => `${a.name} ${a.document} ${a.company}`.toLowerCase().includes(q)) : associates; }, [query, associates]);
  const go = (v: View) => { setView(v); setMenuOpen(false); };
  const notify = (message: string, tone: "success" | "error" | "info" = "success") => { setNotice(message); setNoticeTone(tone); };
  const logout = async () => {
    try {
      const response = await fetch("/api/?action=logout", { method: "POST", credentials: "same-origin", headers: { "X-CSRF-Token": csrf } });
      if (!response.ok) throw new Error("No fue posible cerrar la sesión.");
      setSession(null); setCsrf(""); setAssociates([]); setSelectedAssociate(null); setAccountOpen(false); setView("inicio");
    } catch { notify("No se pudo cerrar la sesión. Revisa tu conexión e inténtalo de nuevo.", "error"); }
  };
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => { fetch("/api/?action=me", { credentials: "same-origin" }).then((r) => r.ok ? readJson(r) : { user: null }).then((data) => { if (data.user) { setSession(data.user); setCsrf(data.csrf || ""); } }).catch(() => undefined).finally(() => setAuthReady(true)); }, []);
  useEffect(() => { if (!session || !["asociados", "perfil"].includes(view)) return; fetch("/api/?action=associates", { credentials: "same-origin" }).then((r) => r.ok ? readJson(r) : null).then((data) => { if (data?.associates) setAssociates(data.associates.map((a: { id: number; first_name: string; last_name: string; document_number: string; company: string | null; email: string | null; phone: string | null; status: string; created_at: string }) => ({ id: a.id, name: `${a.first_name} ${a.last_name}`, firstName: a.first_name, lastName: a.last_name, document: a.document_number, company: a.company || "Sin empresa asignada", email: a.email || "", phone: a.phone || "", status: a.status === "activo" ? "Activo" : a.status === "retirado" ? "Retirado" : "Pendiente", updated: new Date(a.created_at).toLocaleDateString("es-CO") }))); }).catch(() => undefined); }, [session, view]);
  const create = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = new FormData(e.currentTarget); const first = String(form.get("first") || "").trim(), last = String(form.get("last") || "").trim(), doc = String(form.get("doc") || "").trim();
    if (!first || !last || !doc || creatingAssociate) return;
    const payload = { firstName: first, lastName: last, documentNumber: doc, company: String(form.get("company") || ""), email: String(form.get("email") || ""), phone: String(form.get("phone") || "") };
    setCreatingAssociate(true);
    try {
      const response = await fetch("/api/?action=associates", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify(payload) });
      const data = await readJson(response);
      if (!response.ok) { notify(data.error || "No fue posible guardar el asociado.", "error"); return; }
      setNewOpen(false);
      if (data.pending_approval) { notify(data.message, "info"); go("mis_solicitudes"); return; }
      const a = data.associate;
      setAssociates((items) => [{ id: a.id, name: `${a.firstName} ${a.lastName}`, firstName: a.firstName, lastName: a.lastName, document: a.documentNumber, company: a.company || "Sin empresa asignada", email: a.email || "", phone: a.phone || "", status: "Activo", updated: new Date().toLocaleDateString("es-CO") }, ...items]);
      go("asociados"); notify("Asociado creado y activo.");
    } catch { notify("No se pudo conectar con el servidor.", "error"); }
    finally { setCreatingAssociate(false); }
  };
  const updateAssociate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!editingAssociate || savingAssociateChange) return;
    const form = new FormData(event.currentTarget);
    const payload = { id: editingAssociate.id, documentType: "CC", documentNumber: String(form.get("doc") || "").trim(), firstName: String(form.get("first") || "").trim(), lastName: String(form.get("last") || "").trim(), company: String(form.get("company") || "").trim(), email: String(form.get("email") || "").trim(), phone: String(form.get("phone") || "").trim() };
    setSavingAssociateChange(true);
    try {
      const response = await fetch("/api/?action=associates", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify(payload) });
      const data = await readJson(response);
      if (!response.ok) { notify(data.error || "No fue posible actualizar el asociado.", "error"); return; }
      setEditingAssociate(null);
      if (data.pending_approval) { notify(data.message, "info"); go("mis_solicitudes"); return; }
      const updated: Associate = { ...editingAssociate, document: payload.documentNumber, firstName: payload.firstName, lastName: payload.lastName, name: `${payload.firstName} ${payload.lastName}`, company: payload.company || "Sin empresa asignada", email: payload.email, phone: payload.phone, updated: new Date().toLocaleDateString("es-CO") };
      setAssociates((items) => items.map((item) => item.id === updated.id ? updated : item));
      setSelectedAssociate((current) => current?.id === updated.id ? updated : current); notify("Datos del asociado actualizados.");
    } catch { notify("No se pudo conectar con el servidor.", "error"); }
    finally { setSavingAssociateChange(false); }
  };
  const retireAssociate = async () => {
    if (!retiringAssociate || savingAssociateChange) return;
    setSavingAssociateChange(true);
    try {
      const response = await fetch(`/api/?action=associates&id=${retiringAssociate.id}`, { method: "DELETE", credentials: "same-origin", headers: { "X-CSRF-Token": csrf } });
      const data = await readJson(response);
      if (!response.ok) { notify(data.error || "No fue posible retirar el asociado.", "error"); return; }
      setRetiringAssociate(null);
      if (data.pending_approval) { notify(data.message, "info"); go("mis_solicitudes"); return; }
      const retired = { ...retiringAssociate, status: "Retirado" as const };
      setAssociates((items) => items.map((item) => item.id === retired.id ? retired : item));
      setSelectedAssociate((current) => current?.id === retired.id ? retired : current); notify("Asociado retirado. Su historial financiero se conservó.");
    } catch { notify("No se pudo conectar con el servidor.", "error"); }
    finally { setSavingAssociateChange(false); }
  };
  const login = async (email: string, password: string) => { setAuthError(""); try { const response = await fetch("/api/?action=login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ email, password }) }); const data = await readJson(response); if (!response.ok) { setAuthError(data.error || "No fue posible iniciar sesión."); return; } setSession(data.user); setCsrf(data.csrf); } catch { setAuthError("No se pudo conectar con el servidor."); } };
  if (!authReady) return <div className="auth-loading">Cargando Gestión FEGCON…</div>;
  if (!session) return <Login error={authError} onLogin={login} />;
  return <div className="fegcon-app">
    <aside className={`app-rail ${menuOpen ? "rail-open" : ""}`}>
      <div className="brand"><span className="brand-mark">F</span><span><b>FEGCON</b><small>Gestión interna</small></span><button onClick={() => setMenuOpen(false)} className="rail-close"><X /></button></div>
      <nav>{nav.map((group) => <div className="nav-group" key={group.label}><p>{group.label}</p>{group.items.map(({ id, label, icon: Icon }) => <button onClick={() => go(id)} className={view === id ? "is-active" : ""} key={id}><Icon /><span>{label}</span></button>)}</div>)}
        <div className="nav-group"><p>ADMINISTRACIÓN</p>{session.role === "superadmin" ? <button onClick={() => go("administracion")} className={view === "administracion" || view === "aprobaciones" ? "is-active" : ""}><ShieldCheck /><span>Centro Superadmin</span></button> : <button onClick={() => go("configuracion")} className={view === "configuracion" || view === "mis_solicitudes" ? "is-active" : ""}><Settings /><span>Reglas y solicitudes</span></button>}</div>
      </nav>
      <div className="rail-bottom"><div className="account-wrap"><button className="profile-chip" aria-expanded={accountOpen} onClick={() => setAccountOpen((open) => !open)}><Avatar name={session.name} /><span><b>{session.name}</b><small>{session.role === "superadmin" ? "Superadmin" : "Operador"}</small></span><ChevronDown /></button>{accountOpen && <div className="account-menu"><div><b>{session.name}</b><small>{session.email}</small></div><button onClick={logout}><LogOut /><span>Cerrar sesión</span></button></div>}</div></div>
    </aside>
    {menuOpen && <button aria-label="Cerrar menú" className="rail-scrim" onClick={() => setMenuOpen(false)} />}
    <div className="app-area">
      <header className="app-topbar"><div className="location"><IconButton label="Abrir menú" onClick={() => setMenuOpen(true)}><Menu /></IconButton><span>FEGCON <i /> Gestión financiera</span><b>{titles[view]}</b></div><form className="global-search" role="search" onSubmit={(event) => { event.preventDefault(); go("asociados"); }}><Search /><input ref={searchRef} aria-label="Buscar asociados por nombre o documento" placeholder="Buscar asociado por nombre o documento" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd><Command /> K</kbd></form><div className="top-actions"><Button aria-label="Crear nuevo asociado" onClick={() => setNewOpen(true)} className="violet-button"><Plus />Nuevo asociado</Button></div></header>
      <main className="app-content">{notice && <div className={`flash-message ${noticeTone}`} role="status">{noticeTone === "success" ? <Check /> : null}{notice}<button aria-label="Cerrar mensaje" onClick={() => setNotice("")}><X /></button></div>}
        {view === "inicio" ? <Dashboard go={go} csrf={csrf} role={session.role} /> : view === "asociados" ? <Associates data={filtered} role={session.role} onOpen={(associate) => { setSelectedAssociate(associate); go("perfil"); }} onEdit={setEditingAssociate} onRetire={setRetiringAssociate} onNew={() => setNewOpen(true)} query={query} onQueryChange={setQuery} /> : view === "perfil" && selectedAssociate ? <Record associate={selectedAssociate} onBack={() => go("asociados")} /> : view === "perfil" ? <Associates data={filtered} role={session.role} onOpen={(associate) => { setSelectedAssociate(associate); go("perfil"); }} onEdit={setEditingAssociate} onRetire={setRetiringAssociate} onNew={() => setNewOpen(true)} query={query} onQueryChange={setQuery} /> : view === "reportes" ? <Reports go={go} /> : (view === "administracion" || view === "aprobaciones") ? session.role === "superadmin" ? <SuperadminHub key={view} csrf={csrf} go={go} initialSection={view === "aprobaciones" ? "aprobaciones" : "resumen"} /> : <Dashboard go={go} csrf={csrf} role={session.role} /> : (view === "configuracion" || view === "mis_solicitudes") ? session.role === "operador" ? <OperatorHub key={view} csrf={csrf} initialSection={view === "mis_solicitudes" ? "solicitudes" : "reglas"} /> : <Dashboard go={go} csrf={csrf} role={session.role} /> : view === "pagares" ? <PromissoryNotesScreen csrf={csrf} role={session.role} go={go} /> : view === "cobros" ? <PayrollCollectionsScreen csrf={csrf} role={session.role} go={go} /> : view === "creditos" ? <CreditScreen csrf={csrf} role={session.role} go={go} /> : view === "ahorros" ? <FinanceScreen type="ahorro" csrf={csrf} go={go} /> : <ListScreen key={view} view={view} csrf={csrf} role={session.role} go={go} />}
      </main>
    </div>
    <Dialog open={newOpen} onOpenChange={setNewOpen}><DialogContent className="associate-dialog sm:max-w-2xl"><DialogHeader><p className="dialog-eyebrow">AFILIACIONES</p><DialogTitle>Crear asociado</DialogTitle><DialogDescription>{session.role === "operador" ? "La Superadmin debe autorizar este registro antes de que aparezca como asociado activo." : "Tu acceso Superadmin autoriza el registro. El asociado quedará activo al guardar."}</DialogDescription></DialogHeader><form onSubmit={create} className="new-form"><div><label>Nombres<Input name="first" required /></label><label>Apellidos<Input name="last" required /></label><label>Documento<Input name="doc" required /></label><label>Empresa<Input name="company" /></label><label>Correo electrónico<Input name="email" type="email" /></label><label>Celular<Input name="phone" /></label></div><DialogFooter><Button type="button" variant="ghost" onClick={() => setNewOpen(false)}>Cancelar</Button><Button type="submit" className="violet-button" aria-label="Guardar asociado" disabled={creatingAssociate}>{creatingAssociate ? "Guardando…" : session.role === "operador" ? "Enviar a Superadmin" : "Guardar asociado"}</Button></DialogFooter></form></DialogContent></Dialog>
    <Dialog open={Boolean(editingAssociate)} onOpenChange={(open) => { if (!open && !savingAssociateChange) setEditingAssociate(null); }}><DialogContent className="associate-dialog sm:max-w-2xl"><DialogHeader><p className="dialog-eyebrow">DIRECTORIO FEGCON</p><DialogTitle>Editar datos del asociado</DialogTitle><DialogDescription>{session.role === "operador" ? "La Superadmin revisará estos datos antes de aplicarlos." : "Los cambios se aplicarán y quedarán en la bitácora."}</DialogDescription></DialogHeader>{editingAssociate && <form onSubmit={updateAssociate} className="new-form"><div><label>Nombres<Input name="first" defaultValue={editingAssociate.firstName} required /></label><label>Apellidos<Input name="last" defaultValue={editingAssociate.lastName} required /></label><label>Documento<Input name="doc" defaultValue={editingAssociate.document} required /></label><label>Empresa<Input name="company" defaultValue={editingAssociate.company === "Sin empresa asignada" ? "" : editingAssociate.company} /></label><label>Correo electrónico<Input name="email" type="email" defaultValue={editingAssociate.email} /></label><label>Celular<Input name="phone" defaultValue={editingAssociate.phone} /></label></div><DialogFooter><Button type="button" variant="ghost" onClick={() => setEditingAssociate(null)} disabled={savingAssociateChange}>Cancelar</Button><Button type="submit" className="violet-button" disabled={savingAssociateChange}>{savingAssociateChange ? "Guardando…" : session.role === "operador" ? "Enviar cambio" : "Guardar cambios"}</Button></DialogFooter></form>}</DialogContent></Dialog>
    <Dialog open={Boolean(retiringAssociate)} onOpenChange={(open) => { if (!open && !savingAssociateChange) setRetiringAssociate(null); }}><DialogContent className="approval-dialog"><DialogHeader><p className="dialog-eyebrow">DIRECTORIO FEGCON</p><DialogTitle>Retirar asociado</DialogTitle><DialogDescription>{retiringAssociate?.name} dejará de estar activo. Los créditos, pagos y movimientos anteriores se conservarán. {session.role === "operador" ? "La Superadmin debe autorizar este cambio." : "La operación quedará registrada en la bitácora."}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setRetiringAssociate(null)} disabled={savingAssociateChange}>Cancelar</Button><Button className="violet-button" onClick={() => void retireAssociate()} disabled={savingAssociateChange}>{savingAssociateChange ? "Procesando…" : session.role === "operador" ? "Enviar solicitud" : "Confirmar retiro"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

type DashboardItem = { title: string; person: string; detail: string; value: string; state: string; icon: LucideIcon; tone: "bad" | "warn"; target: View };

function Dashboard({ go, csrf, role }: { go: (view: View) => void; csrf: string; role: string }) {
  const [live, setLive] = useState({ asociados: 0, afiliaciones_pendientes: 0, pagos_aplicados: 0, cartera_abierta: 0 });
  const [attention, setAttention] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const read = (action: string) => fetch(`/api/?action=${action}`, { credentials: "same-origin" }).then(async (response) => response.ok ? readJson(response) : Promise.reject(new Error("No fue posible consultar la base de datos.")));
    Promise.allSettled([read("dashboard"), read("affiliations"), read("receivables"), read("promissory-notes"), read("approval-requests")]).then((results) => {
      if (cancelled) return;
      const [dashboard, affiliations, receivables, notes, approvals] = results.map((result) => result.status === "fulfilled" ? result.value : null);
      if (dashboard?.metrics) setLive(dashboard.metrics);
      const items: DashboardItem[] = [];
      for (const row of (affiliations?.requests || []).filter((item: ApiJson) => item.status === "en_revision")) items.push({ title: "Afiliación en revisión", person: `${row.first_name} ${row.last_name}`, detail: `Documento ${row.document_number}`, value: "", state: "En revisión", icon: ClipboardList, tone: "warn", target: "afiliaciones" });
      for (const row of (receivables?.receivables || []).filter((item: ApiJson) => item.status === "vencida" || (item.status === "por_vencer" && item.due_date < new Date().toISOString().slice(0, 10)))) items.push({ title: row.status === "vencida" || row.due_date < new Date().toISOString().slice(0, 10) ? "Obligación vencida" : "Obligación próxima a vencer", person: `${row.first_name} ${row.last_name}`, detail: `${row.reference} · ${row.due_date}`, value: money(Number(row.amount)), state: "Revisar", icon: AlertTriangle, tone: "bad", target: "cartera" });
      for (const row of (notes?.notes || []).filter((item: ApiJson) => ["pendiente_firma", "borrador"].includes(item.status))) items.push({ title: "Pagaré pendiente", person: `${row.first_name} ${row.last_name}`, detail: row.note_number, value: "", state: row.status === "borrador" ? "Borrador" : "Pendiente", icon: FileCheck2, tone: "warn", target: "pagares" });
      if (role === "superadmin") for (const row of (approvals?.requests || []).filter((item: ApiJson) => item.status === "pendiente")) items.push({ title: "Cambio por autorizar", person: row.requested_by_name || "Operador", detail: row.summary, value: "", state: "Pendiente", icon: ClipboardList, tone: "warn", target: "aprobaciones" });
      setAttention(items.slice(0, 6));
      if (!dashboard) setLoadError("No se pudieron cargar las cifras de la base de datos.");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [csrf, role]);
  const metrics = [
    [String(live.afiliaciones_pendientes), "Afiliaciones por revisar", "Solicitudes pendientes", "pink"],
    [money(live.cartera_abierta), "Cartera abierta", "Obligaciones registradas", "orange"],
    [money(live.pagos_aplicados), "Pagos aplicados", "Pagos en la base de datos", "aqua"],
    [String(live.asociados), "Asociados activos", "Registros vigentes", "lime"],
  ];
  return <div className="dashboard">
    <section className="hero-surface"><div className="hero-copy"><p>GESTIÓN FEGCON</p><h1>La operación<br /><span>en un solo lugar.</span></h1><small>Información tomada de los registros reales del sistema. Las cifras empiezan en cero hasta que registres operaciones.</small><div><Button onClick={() => go("asociados")} className="light-button"><Users />Ver asociados</Button><button onClick={() => go(role === "superadmin" ? "aprobaciones" : "mis_solicitudes")} className="text-button">Ver solicitudes <ArrowUpRight /></button></div></div><div className="hero-chart"><div className="chart-top"><span>ASOCIADOS ACTIVOS</span><Status tone={loading ? "warn" : loadError ? "bad" : "good"}>{loading ? "Cargando" : loadError ? "Sin conexión" : "Datos actuales"}</Status></div><strong>{live.asociados}</strong><p><span>Registros vigentes</span></p><div className="hero-live-mark" aria-hidden="true"><span /><span /><span /></div></div><div className="hero-disc" aria-hidden="true" /></section>
    {loadError && <div className="auth-error" role="status">{loadError}</div>}
    <section className="metrics">{metrics.map(([n, label, detail, color]) => <Metric key={label} n={n} label={label} detail={detail} color={color} />)}</section>
    <section className="dashboard-grid"><div className="decision-board"><div className="board-header"><div><p>OPERACIÓN</p><h2>Requieren atención</h2></div><button onClick={() => go(role === "superadmin" ? "aprobaciones" : "mis_solicitudes")}>Ver solicitudes <ChevronRight /></button></div>{attention.length ? attention.map((item, index) => { const Icon = item.icon; return <button className="decision-row" key={`${item.title}-${item.detail}-${index}`} onClick={() => go(item.target)}><span className={`decision-icon ${item.tone}`}><Icon /></span><span className="decision-copy"><b>{item.title}</b><small>{item.person} · {item.detail}</small></span>{item.value && <strong>{item.value}</strong>}<Status tone={item.tone}>{item.state}</Status><ChevronRight /></button>; }) : <div className="empty-state"><b>{loading ? "Consultando registros…" : "No hay asuntos pendientes"}</b><small>{loading ? "La vista general está consultando la base de datos." : "Las solicitudes y obligaciones por atender aparecerán aquí cuando existan."}</small></div>}</div>
      <aside className="recaudo-card"><div><p>RESUMEN DEL SISTEMA</p><h2>Datos registrados</h2></div><section className="dashboard-summary">{[[live.asociados, "Asociados activos"], [live.afiliaciones_pendientes, "Afiliaciones por revisar"], [money(live.pagos_aplicados), "Pagos aplicados"], [money(live.cartera_abierta), "Cartera abierta"]].map(([value, label]) => <div key={String(label)}><strong>{value}</strong><small>{label}</small></div>)}</section><button onClick={() => go("reportes")} className="card-link">Consultar reportes <ArrowUpRight /></button></aside>
    </section>
    <section className="quick-routes"><div><p>ACCESOS</p><h2>Ir a un módulo.</h2></div><div>{[[ClipboardList, "Afiliaciones", "Solicitudes de vinculación", "afiliaciones"], [FileCheck2, "Pagarés", "Documentos registrados", "pagares"], [CreditCard, "Pagos", "Movimientos de recaudo", "pagos"]].map(([Icon, title, detail, target]) => { const I = Icon as LucideIcon; return <button onClick={() => go(target as View)} key={String(title)}><span><I /></span><b>{String(title)}</b><small>{String(detail)}</small><ArrowUpRight /></button>; })}</div></section>
  </div>;
}
function Metric({ n, label, detail, color }: { n: string; label: string; detail: string; color: string }) { return <div className={`metric-card ${color}`}><i /><p>{label}</p><strong>{n}</strong><small>{detail}</small></div>; }

function Login({ error, onLogin }: { error: string; onLogin: (email: string, password: string) => Promise<void> }) { const [sending, setSending] = useState(false); const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const data = new FormData(event.currentTarget); setSending(true); await onLogin(String(data.get("email") || ""), String(data.get("password") || "")); setSending(false); }; return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><span>F</span><div><b>FEGCON</b><small>Gestión interna</small></div></div><p>ACCESO RESTRINGIDO</p><h1>Bienvenido de nuevo.</h1><small>Ingresa con tu cuenta interna para administrar la operación del fondo.</small><form onSubmit={submit}><label>Correo electrónico<Input name="email" type="email" autoComplete="email" required /></label><label>Contraseña<Input name="password" type="password" autoComplete="current-password" minLength={12} required /></label>{error && <div className="auth-error">{error}</div>}<Button className="violet-button" type="submit" disabled={sending}>{sending ? "Verificando…" : "Iniciar sesión"}</Button></form><em>Uso exclusivo del personal autorizado de FEGCON.</em></section></main>; }

function BusinessRulesPanel({ csrf, role, embedded = false }: { csrf: string; role: string; embedded?: boolean }) {
  const [rate, setRate] = useState<number | null>(null), [month, setMonth] = useState(""), [notice, setNotice] = useState("");
  useEffect(() => { fetch("/api/?action=business-rules", { credentials: "same-origin" }).then(r => r.ok ? readJson(r) : null).then(x => { const rule = x?.rules?.late_interest; if (rule) { setRate(rule.usury_rate_percent); setMonth(rule.effective_month || ""); } }); }, []);
  const saveRate = (e: FormEvent) => { e.preventDefault(); fetch("/api/?action=business-rules", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ effective_month: month, usury_rate_percent: rate }) }).then(async r => ({ ok: r.ok, data: await readJson(r) })).then(x => setNotice(x.data.error || "Tasa de usura del período guardada.")).catch(() => setNotice("No fue posible guardar la tasa.")); };
  return <div className={embedded ? "rules-content" : "page"}>{!embedded && <Heading eyebrow="REGLAS DEL FONDO" title="Políticas financieras" text="Las condiciones del fondo son fijas. La tasa de usura se registra cada mes." />}
    <section className="data-panel"><div className="table-tools"><b>Ahorros y aportes</b><small>Distribución fija del ahorro total del asociado</small></div><div className="p-6 grid gap-3 md:grid-cols-2"><div className="rounded-xl border p-4"><b>30% · Ahorro a la vista</b><p>Disponibilidad inmediata para el asociado.</p></div><div className="rounded-xl border p-4"><b>70% · Aportes</b><p>Base para calcular el cupo de crédito: 3, 4 o 5 veces este saldo, según decisión de la Superadmin para cada solicitud.</p></div></div></section>
    <section className="data-panel mt-6"><div className="table-tools"><b>Crédito de libre inversión</b><small>Única línea de crédito definida por FEGCON</small></div><div className="p-6 grid gap-3 md:grid-cols-2"><p><b>Tasa:</b> 2% mensual fija, aplicada al saldo pendiente.</p><p><b>Plazo:</b> de 1 a 60 meses.</p><p><b>Libranza:</b> dos últimos desprendibles de pago y certificación laboral.</p><p><b>Independiente:</b> declaración de renta y uno o dos codeudores, según el monto evaluado por la Superadmin.</p></div></section>
    <section className="data-panel mt-6"><div className="table-tools"><b>Interés de mora</b><small>Base de 360 días · tasa de usura vigente para el período</small></div><div className="p-6"><p className="font-semibold">Capital de la cuota × (tasa de usura vigente ÷ 100) ÷ 360 × días en mora</p>{role === "superadmin" ? <form onSubmit={saveRate} className="mt-4 flex flex-wrap items-end gap-3"><label>Mes aplicable<Input type="month" value={month} onChange={e => setMonth(e.target.value)} required /></label><label>Tasa de usura vigente (%)<Input type="number" min="0.01" max="100" step="0.01" value={rate ?? ""} onChange={e => setRate(Number(e.target.value))} required /></label><Button className="violet-button" type="submit">Guardar tasa del mes</Button>{notice && <small>{notice}</small>}</form> : <p className="mt-3">Tasa registrada para {month || "el mes aún no está configurado"}: {rate == null ? "pendiente" : `${rate}%`}.</p>}</div></section>
    <section className="data-panel mt-6"><div className="table-tools"><b>Cobros y recaudo</b><small>Reglas de periodicidad y envío</small></div><div className="p-6 grid gap-2"><p>Al asociado se le cobra quincenal o mensualmente por WhatsApp: aportes y cuotas de crédito.</p><p>Los cobros por libranza se envían a las empresas los días 10 y 20 de cada mes e incluyen aportes, cuotas de crédito y convenios cuando aplique.</p></div></section>
    <section className="data-panel mt-6"><div className="table-tools"><b>Pagarés y documentos</b><small>Expediente digital por asociado</small></div><div className="p-6"><p>FEGCON conserva aproximadamente siete documentos por crédito. Se escanean y se guardan en la carpeta digital del asociado; sus nombres y la política exacta de copias aún deben definirse.</p></div></section>
    <section className="data-panel mt-6"><div className="table-tools"><b>Accesos</b><small>Dos roles</small></div><div className="p-6 grid gap-3 md:grid-cols-2"><p><b>Operador:</b> trabajo diario; sus altas, ediciones y eliminaciones requieren autorización.</p><p><b>Superadmin:</b> administra usuarios y aprueba o rechaza las solicitudes de cambio.</p></div></section>
  </div>;
}

type AdminSection = "resumen" | "aprobaciones" | "usuarios" | "reglas" | "organizacion" | "auditoria";
const adminSections: { id: AdminSection; label: string; help: string }[] = [
  { id: "resumen", label: "Resumen", help: "Estado y próximos pasos" },
  { id: "aprobaciones", label: "Aprobaciones", help: "Cambios que esperan revisión" },
  { id: "usuarios", label: "Usuarios", help: "Accesos del equipo" },
  { id: "reglas", label: "Reglas financieras", help: "Tasas y condiciones vigentes" },
  { id: "organizacion", label: "Datos del fondo", help: "Identificación institucional" },
  { id: "auditoria", label: "Bitácora", help: "Actividad y decisiones registradas" },
];

function SuperadminHub({ csrf, go, initialSection = "resumen" }: { csrf: string; go: (view: View) => void; initialSection?: AdminSection }) {
  const [section, setSection] = useState<AdminSection>(initialSection);
  return <div className="page superadmin-page">
    <Heading eyebrow="CONTROL DEL FONDO" title="Centro Superadmin" text="Administra accesos, revisa cambios y consulta las reglas de FEGCON." />
    <nav className="admin-tabs" aria-label="Secciones de administración">
      {adminSections.map((item) => <button key={item.id} className={section === item.id ? "active" : ""} aria-current={section === item.id ? "page" : undefined} onClick={() => setSection(item.id)}><b>{item.label}</b><small>{item.help}</small></button>)}
    </nav>
    {section === "resumen" && <AdminOverview go={go} setSection={setSection} />}
    {section === "aprobaciones" && <ApprovalRequestsPanel csrf={csrf} role="superadmin" />}
    {section === "usuarios" && <UsersPanel csrf={csrf} />}
    {section === "reglas" && <BusinessRulesPanel csrf={csrf} role="superadmin" embedded />}
    {section === "organizacion" && <SettingsPanel csrf={csrf} embedded />}
    {section === "auditoria" && <AdminAuditPanel />}
  </div>;
}

function OperatorHub({ csrf, initialSection = "reglas" }: { csrf: string; initialSection?: "reglas" | "solicitudes" }) {
  const [section, setSection] = useState<"reglas" | "solicitudes">(initialSection);
  return <div className="page superadmin-page">
    <Heading eyebrow="AYUDA PARA LA OPERACIÓN" title="Reglas y solicitudes" text="Consulta las condiciones vigentes y sigue los cambios que enviaste a aprobación." />
    <nav className="admin-tabs" aria-label="Reglas y solicitudes"><button className={section === "reglas" ? "active" : ""} aria-current={section === "reglas" ? "page" : undefined} onClick={() => setSection("reglas")}><b>Reglas del fondo</b><small>Condiciones vigentes</small></button><button className={section === "solicitudes" ? "active" : ""} aria-current={section === "solicitudes" ? "page" : undefined} onClick={() => setSection("solicitudes")}><b>Mis solicitudes</b><small>Estado de mis cambios</small></button></nav>
    {section === "reglas" ? <BusinessRulesPanel csrf={csrf} role="operador" embedded /> : <ApprovalRequestsPanel csrf={csrf} role="operador" />}
  </div>;
}

function AdminOverview({ go, setSection }: { go: (view: View) => void; setSection: (section: AdminSection) => void }) {
  const [summary, setSummary] = useState({ associates: 0, affiliations: 0, receivables: 0, payments: 0, approvals: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/?action=dashboard", { credentials: "same-origin" }).then((response) => response.ok ? readJson(response) : Promise.reject()),
      fetch("/api/?action=approval-requests", { credentials: "same-origin" }).then((response) => response.ok ? readJson(response) : Promise.reject()),
    ]).then(([dashboard, requests]) => {
      if (cancelled) return;
      const metrics = dashboard.metrics || {};
      setSummary({ associates: Number(metrics.asociados || 0), affiliations: Number(metrics.afiliaciones_pendientes || 0), receivables: Number(metrics.cartera_abierta || 0), payments: Number(metrics.pagos_aplicados || 0), approvals: (requests.requests || []).filter((request: ApiJson) => request.status === "pendiente").length });
    }).catch(() => { if (!cancelled) setError("No pudimos consultar los datos del sistema. Recarga esta página o verifica la conexión."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return <div className="admin-overview">
    <section className={`admin-welcome ${summary.associates || summary.affiliations ? "has-data" : "is-empty"}`}>
      <div><p>ESTADO DE LA OPERACIÓN</p><h2>{loading ? "Consultando el sistema…" : summary.associates || summary.affiliations || summary.receivables || summary.payments ? "El sistema está listo para operar" : "FEGCON está listo para comenzar"}</h2><small>{loading ? "Estamos leyendo los datos guardados." : "Aquí solo verás información registrada por tu equipo. No hay datos de muestra."}</small></div>
      <Button className="violet-button" onClick={() => go("afiliaciones")}><Plus />Registrar una afiliación</Button>
    </section>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <section className="admin-stat-grid" aria-label="Indicadores del sistema">
      <AdminStat label="Asociados activos" value={String(summary.associates)} onClick={() => go("asociados")} />
      <AdminStat label="Afiliaciones por revisar" value={String(summary.affiliations)} onClick={() => go("afiliaciones")} />
      <AdminStat label="Cambios pendientes" value={String(summary.approvals)} onClick={() => setSection("aprobaciones")} />
      <AdminStat label="Cartera registrada" value={money(summary.receivables)} onClick={() => go("cartera")} />
    </section>
    <section className="admin-next-steps">
      <div className="admin-panel-heading"><div><p>PRIMEROS PASOS</p><h2>Deja el espacio listo para el equipo</h2></div><small>Los pasos se pueden hacer en cualquier momento.</small></div>
      <div className="admin-step-grid">
        <button onClick={() => setSection("usuarios")}><span>01</span><b>Invita al operador</b><small>Crea el acceso de la persona que llevará el trabajo diario.</small><em>Administrar usuarios <ChevronRight /></em></button>
        <button onClick={() => setSection("reglas")}><span>02</span><b>Revisa las reglas</b><small>Confirma el 2% mensual y registra la tasa de usura del mes.</small><em>Ver reglas financieras <ChevronRight /></em></button>
        <button onClick={() => go("afiliaciones")}><span>03</span><b>Registra la primera afiliación</b><small>La persona aparecerá en el directorio cuando se apruebe.</small><em>Abrir afiliaciones <ChevronRight /></em></button>
      </div>
    </section>
    <section className="admin-quick-links"><button onClick={() => setSection("aprobaciones")}><ClipboardList /><span><b>Revisar solicitudes</b><small>{summary.approvals ? `${summary.approvals} esperan tu decisión` : "No hay cambios pendientes"}</small></span><ChevronRight /></button><button onClick={() => setSection("organizacion")}><Building2 /><span><b>Datos del fondo</b><small>Nombre, NIT y correo institucional</small></span><ChevronRight /></button><button onClick={() => go("reportes")}><FileText /><span><b>Consultar reportes</b><small>Ver registros guardados por módulo</small></span><ChevronRight /></button></section>
  </div>;
}

function AdminStat({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return <button className="admin-stat" onClick={onClick}><small>{label}</small><b>{value}</b><span>Ver detalle <ChevronRight /></span></button>;
}

type AuditEntry = { id: number; entity: string; entity_id: number; action: string; detail: string; created_at: string; user_name?: string };

function AdminAuditPanel() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    fetch("/api/?action=audit-log", { credentials: "same-origin" }).then(async (response) => {
      if (!response.ok) throw new Error("No fue posible consultar la bitácora.");
      return readJson(response) as Promise<{ entries?: AuditEntry[] }>;
    }).then((data) => { if (!cancelled) setEntries(data.entries || []); }).catch(() => { if (!cancelled) setError("No pudimos cargar la actividad. Vuelve a intentarlo."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const filtered = entries.filter((entry) => `${entry.user_name || ""} ${entry.entity} ${entry.action} ${entry.detail}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="data-panel mt-6">
    <div className="table-tools audit-tools"><div><b>Bitácora de actividad</b><small>Altas, movimientos y decisiones registradas por el sistema.</small></div><Input aria-label="Filtrar actividad" placeholder="Filtrar por usuario o acción" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
    {loading ? <div className="empty-state">Cargando actividad…</div> : error ? <div className="empty-state"><b>No se pudo abrir la bitácora</b><small>{error}</small></div> : filtered.length ? <Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Usuario</TableHead><TableHead>Registro</TableHead><TableHead>Acción</TableHead><TableHead>Detalle</TableHead></TableRow></TableHeader><TableBody>{filtered.map((entry) => <TableRow key={entry.id}><TableCell>{new Date(entry.created_at).toLocaleString("es-CO")}</TableCell><TableCell>{entry.user_name || "Usuario retirado"}</TableCell><TableCell>{entry.entity.replaceAll("_", " ")} · #{entry.entity_id}</TableCell><TableCell><StatusFor value={entry.action} /></TableCell><TableCell>{entry.detail || "—"}</TableCell></TableRow>)}</TableBody></Table> : <div className="empty-state"><b>{query ? "No hay coincidencias" : "La bitácora aún está vacía"}</b><small>{query ? "Prueba con otro usuario o acción." : "Las operaciones y decisiones del equipo aparecerán aquí."}</small></div>}
  </section>;
}

type ApprovalRequest = {
  id: number;
  operation: string;
  summary: string;
  payload?: Record<string, unknown>;
  status: string;
  created_at: string;
  requested_by_name?: string;
};

type ApprovalDecision = { request: ApprovalRequest; decision: "aprobada" | "rechazada" };

const approvalOperationNames: Record<string, string> = {
  associate_create: "Alta de asociado",
  associate_update: "Edición de asociado",
  associate_retire: "Retiro de asociado",
  promissory_document_create: "Nuevo documento de pagaré",
  promissory_document_delete: "Retiro de documento de pagaré",
  savings_transaction: "Movimiento de ahorro o aporte",
  credit_application: "Solicitud de crédito",
  credit_decision: "Decisión sobre crédito",
  affiliation_create: "Nueva afiliación",
  affiliation_decision: "Decisión sobre afiliación",
  payment_create: "Registro de pago",
  payroll_collection_create: "Relación de cobro de nómina",
  promissory_note_create: "Registro de pagaré",
  receivable_create: "Obligación de cartera",
  catalog_item_create: "Nuevo convenio",
};

const approvalFieldNames: Record<string, string> = {
  id: "Identificador", name: "Asociado", firstName: "Nombres", lastName: "Apellidos", documentType: "Tipo de documento", documentNumber: "Documento", document_number: "Documento",
  document_id: "Documento digital", note_id: "Pagaré", original_name: "Nombre del archivo", mime_type: "Formato", byte_size: "Peso en bytes",
  email: "Correo", phone: "Celular", company: "Empresa", associate_id: "Asociado", product_id: "Producto",
  movement_type: "Movimiento", amount: "Valor", term_months: "Plazo en meses", purpose: "Destino",
  period_label: "Período", expected_amount: "Valor esperado", note_number: "Número de pagaré",
  reference: "Referencia", due_date: "Vencimiento", concept: "Concepto", received_on: "Fecha de pago",
  status: "Estado solicitado", category: "Tipo de registro", label: "Nombre",
};

function ApprovalRequestsPanel({ csrf, role }: { csrf: string; role: string }) {
  const [rows, setRows] = useState<ApprovalRequest[]>([]);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<ApprovalDecision | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/?action=approval-requests", { credentials: "same-origin" });
      if (!response.ok) throw new Error("No fue posible consultar las solicitudes.");
      const data = await readJson(response) as { requests?: ApprovalRequest[] };
      setRows(data.requests || []);
    } catch {
      setLoadError("No pudimos cargar las solicitudes. Revisa tu conexión e inténtalo de nuevo.");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/?action=approval-requests", { credentials: "same-origin" }).then(async (response) => {
      if (!response.ok) throw new Error("No fue posible consultar las solicitudes.");
      return await readJson(response) as { requests?: ApprovalRequest[] };
    }).then((data) => { if (!cancelled) setRows(data.requests || []); }).catch(() => { if (!cancelled) setLoadError("No pudimos cargar las solicitudes. Revisa tu conexión e inténtalo de nuevo."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const decide = async () => {
    if (!decision) return;
    setSaving(true);
    try {
      const response = await fetch("/api/?action=approval-requests", {
        method: "PATCH", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ id: decision.request.id, decision: decision.decision }),
      });
      const data = await readJson(response) as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "No fue posible procesar la solicitud.");
      setNotice(data.message || "Solicitud actualizada.");
      setDecision(null);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No fue posible procesar la solicitud.");
    } finally { setSaving(false); }
  };

  const pendingCount = rows.filter((row) => row.status === "pendiente").length;
  const isSuperadmin = role === "superadmin";
  const payloadEntries = Object.entries(decision?.request.payload || {}).filter(([key]) => !["password", "password_hash"].includes(key));

  return <>
    <section className="data-panel mt-6">
      <div className="table-tools"><div><b>{isSuperadmin ? "Cambios por revisar" : "Mis solicitudes"}</b><small>{isSuperadmin ? "Revisa la información antes de autorizar su aplicación." : "Consulta si la Superadmin ya atendió tus cambios."}</small></div><small>{pendingCount} pendientes</small></div>
      {notice && <div className="px-6 pt-4" role="status">{notice}</div>}
      {loadError ? <div className="empty-state"><b>No se pudo abrir la bandeja</b><small>{loadError}</small><Button variant="outline" onClick={() => void load()}>Reintentar</Button></div> : loading ? <div className="empty-state">Cargando solicitudes…</div> : rows.length ? <div className="approval-list">
        {rows.map((row) => <article className="approval-item" key={row.id}>
          <div className="approval-main"><span className="approval-type">{approvalOperationNames[row.operation] || "Cambio solicitado"}</span><b>{row.summary}</b><small>{row.requested_by_name ? `${row.requested_by_name} · ` : ""}{new Date(row.created_at).toLocaleString("es-CO")} · {row.status.replaceAll("_", " ")}</small>
            {isSuperadmin && row.payload && <dl className="approval-details">{Object.entries(row.payload).filter(([key]) => !["password", "password_hash"].includes(key)).map(([key, value]) => <div key={key}><dt>{approvalFieldNames[key] || key.replaceAll("_", " ")}</dt><dd>{Array.isArray(value) ? value.join(", ") : String(value ?? "—")}</dd></div>)}</dl>}
            {isSuperadmin && row.status === "pendiente" && row.operation === "promissory_document_create" && Number(row.payload?.document_id) > 0 && <a className="text-button mt-3 inline-flex" href={"/api/?action=promissory-document-file&id=" + row.payload?.document_id}>Descargar archivo privado para revisar</a>}
          </div>
          {isSuperadmin && row.status === "pendiente" && <div className="approval-actions"><Button className="violet-button" onClick={() => setDecision({ request: row, decision: "aprobada" })}>Revisar y aprobar</Button><Button variant="outline" onClick={() => setDecision({ request: row, decision: "rechazada" })}>Rechazar</Button></div>}
          {row.status !== "pendiente" && <StatusFor value={row.status} />}
        </article>)}
      </div> : <div className="empty-state"><b>{isSuperadmin ? "No tienes cambios pendientes" : "Todavía no has enviado cambios"}</b><small>{isSuperadmin ? "Cuando el Operador envíe una operación, podrás revisar sus datos y aprobarla aquí." : "Las operaciones que requieren autorización aparecerán aquí con su estado."}</small></div>}
    </section>
    <Dialog open={Boolean(decision)} onOpenChange={(open) => { if (!open && !saving) setDecision(null); }}>
      <DialogContent className="approval-dialog">
        <DialogHeader><p className="dialog-eyebrow">REVISIÓN DE CAMBIO</p><DialogTitle>{decision?.decision === "aprobada" ? "¿Aprobar y aplicar este cambio?" : "¿Rechazar esta solicitud?"}</DialogTitle><DialogDescription>{decision?.request.summary}. Esta decisión quedará registrada en la auditoría del sistema.</DialogDescription></DialogHeader>
        {decision && <div className="approval-confirm"><b>{approvalOperationNames[decision.request.operation] || "Cambio solicitado"}</b>{payloadEntries.length > 0 && <dl className="approval-details">{payloadEntries.map(([key, value]) => <div key={key}><dt>{approvalFieldNames[key] || key.replaceAll("_", " ")}</dt><dd>{Array.isArray(value) ? value.join(", ") : String(value ?? "—")}</dd></div>)}</dl>}</div>}
        <DialogFooter><Button variant="outline" disabled={saving} onClick={() => setDecision(null)}>Volver</Button><Button className="violet-button" disabled={saving} onClick={() => void decide()}>{saving ? "Procesando…" : decision?.decision === "aprobada" ? "Confirmar aprobación" : "Confirmar rechazo"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

function SettingsPanel({ csrf, embedded = false }: { csrf: string; embedded?: boolean }) { const [org, setOrg] = useState({ name: "FEGCON", nit: "", email: "" }); const [notice, setNotice] = useState(""); useEffect(() => { fetch("/api/?action=settings", { credentials: "same-origin" }).then(r => r.ok ? readJson(r) : null).then(data => { if (data?.settings?.organization) setOrg(data.settings.organization); }); }, []); const save = (e: FormEvent) => { e.preventDefault(); fetch("/api/?action=settings", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ organization: org }) }).then(r => r.ok ? readJson(r) : Promise.reject()).then(() => setNotice("Datos institucionales guardados.")).catch(() => setNotice("No fue posible guardar los datos.")); }; return <div className={embedded ? "settings-content" : "page"}>{!embedded && <Heading eyebrow="ADMINISTRACIÓN" title="Datos del fondo" text="Información que identifica a FEGCON en el sistema." />}<form className="data-panel" onSubmit={save}><div className="table-tools"><b>Identificación institucional</b><small>Se muestra en las comunicaciones del sistema.</small></div><div className="p-6 grid gap-4 md:grid-cols-2"><label>Nombre del fondo<Input value={org.name} onChange={e => setOrg({ ...org, name: e.target.value })} required /></label><label>NIT<Input value={org.nit} onChange={e => setOrg({ ...org, nit: e.target.value })} /></label><label className="md:col-span-2">Correo institucional<Input type="email" value={org.email} onChange={e => setOrg({ ...org, email: e.target.value })} /></label></div><div className="p-6 pt-0 flex items-center gap-4"><Button className="violet-button" type="submit">Guardar datos del fondo</Button>{notice && <small role="status">{notice}</small>}</div></form></div>; }

function Heading({ eyebrow, title, text, children }: { eyebrow: string; title: string; text: string; children?: ReactNode }) { return <div className="page-heading"><div><p>{eyebrow}</p><h1>{title}</h1><small>{text}</small></div>{children}</div>; }
function Associates({ data, role, onOpen, onEdit, onRetire, onNew, query, onQueryChange }: { data: Associate[]; role: string; onOpen: (associate: Associate) => void; onEdit: (associate: Associate) => void; onRetire: (associate: Associate) => void; onNew: () => void; query: string; onQueryChange: (value: string) => void }) {
  return <div className="page"><Heading eyebrow="DIRECTORIO FEGCON" title="Asociados" text="Consulta, actualiza y retira asociados. Los cambios del Operador pasan a revisión de la Superadmin."><Button onClick={onNew} className="violet-button"><Plus />Nuevo asociado</Button></Heading><section className="data-panel"><div className="table-tools"><div><Search /><Input placeholder="Buscar por nombre, documento o empresa" value={query} onChange={(event) => onQueryChange(event.target.value)} /></div><small>{data.length} registros</small></div>{data.length ? <Table><TableHeader><TableRow><TableHead>Asociado</TableHead><TableHead>Empresa</TableHead><TableHead>Estado</TableHead><TableHead>Registro</TableHead><TableHead>Acciones</TableHead></TableRow></TableHeader><TableBody>{data.map((associate) => <TableRow className="data-row" key={associate.id}><TableCell><button type="button" className="person person-link" aria-label={`Abrir ficha de ${associate.name}`} onClick={() => onOpen(associate)}><Avatar name={associate.name} /><span><b>{associate.name}</b><small>CC {associate.document}</small></span></button></TableCell><TableCell className="text-slate-500">{associate.company}</TableCell><TableCell><StatusFor value={associate.status} /></TableCell><TableCell className="text-slate-500">{associate.updated}</TableCell><TableCell><div className="flex gap-2"><Button variant="outline" onClick={() => onEdit(associate)}>Editar</Button>{associate.status !== "Retirado" && <Button variant="outline" onClick={() => onRetire(associate)}>{role === "operador" ? "Solicitar retiro" : "Retirar"}</Button>}</div></TableCell></TableRow>)}</TableBody></Table> : <div className="empty-state"><b>{query ? "No hay coincidencias" : "Aún no hay asociados"}</b><small>{query ? "Prueba con otro nombre, documento o empresa." : "Cuando registres o apruebes una afiliación, aparecerá aquí."}</small>{!query && <Button onClick={onNew} className="violet-button"><Plus />Registrar asociado</Button>}</div>}</section></div>;
}

function Record({ associate, onBack }: { associate: Associate; onBack: () => void }) {
  const [tab, setTab] = useState("Resumen");
  const [records, setRecords] = useState<{ movements: string[][]; credits: string[][]; notes: string[][] }>({ movements: [], credits: [], notes: [] });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const read = (action: string) => fetch(`/api/?action=${action}`, { credentials: "same-origin" }).then((response) => response.ok ? readJson(response) : Promise.reject());
    Promise.allSettled([read("savings-transactions"), read("payments"), read("credit-applications"), read("promissory-notes")]).then((results) => {
      if (cancelled) return;
      const [savings, payments, credits, notes] = results.map((result) => result.status === "fulfilled" ? result.value : null);
      const movementRows = [
        ...(savings?.transactions || []).filter((row: ApiJson) => Number(row.associate_id) === associate.id).map((row: ApiJson) => [new Date(row.created_at).toLocaleDateString("es-CO"), row.movement_type, row.product_name, money(Number(row.amount)), row.status]),
        ...(payments?.payments || []).filter((row: ApiJson) => Number(row.associate_id) === associate.id).map((row: ApiJson) => [row.received_on, "Pago", row.concept, money(Number(row.amount)), row.status]),
      ];
      const creditRows = (credits?.applications || []).filter((row: ApiJson) => Number(row.associate_id) === associate.id).map((row: ApiJson) => [String(row.id), row.product_name, `${row.requested_term_months} meses`, money(Number(row.requested_amount)), row.status]);
      const noteRows = (notes?.notes || []).filter((row: ApiJson) => Number(row.associate_id) === associate.id).map((row: ApiJson) => [row.note_number, row.credit_application_id ? `Solicitud #${row.credit_application_id}` : "Sin solicitud asociada", new Date(row.created_at).toLocaleDateString("es-CO"), row.status]);
      setRecords({ movements: movementRows, credits: creditRows, notes: noteRows });
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [associate.id]);
  const tabs = ["Resumen", "Movimientos", "Créditos", "Pagarés"];
  return <div className="record"><button onClick={onBack} className="back">‹ Volver a asociados</button><section className="record-hero"><div><Avatar name={associate.name} large /><span><StatusFor value={associate.status} /><h1>{associate.name}</h1><p>CC {associate.document} · {associate.company}</p></span></div></section><nav className="record-nav">{tabs.map((item) => <button key={item} className={tab === item ? "selected" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav>{tab === "Resumen" ? <section className="record-grid"><div className="profile-data"><p>DATOS REGISTRADOS</p><h2>Perfil y contacto</h2>{[["Correo electrónico", associate.email || "Sin registrar"], ["Celular", associate.phone || "Sin registrar"], ["Empresa", associate.company], ["Documento", associate.document], ["Estado", associate.status], ["Fecha de registro", associate.updated]].map(([label, value]) => <span key={label}><small>{label}</small><b>{value}</b></span>)}</div><div className="watch-data"><p>RESUMEN</p><h2>Actividad registrada</h2><div><span><b>{records.movements.length}</b><small>Movimientos</small></span></div><div><span><b>{records.credits.length}</b><small>Solicitudes de crédito</small></span></div><div><span><b>{records.notes.length}</b><small>Pagarés</small></span></div></div></section> : tab === "Movimientos" ? <RecordTable loading={loading} headers={["Fecha", "Tipo", "Detalle", "Valor", "Estado"]} rows={records.movements} /> : tab === "Créditos" ? <RecordTable loading={loading} headers={["Solicitud", "Línea", "Plazo", "Monto", "Estado"]} rows={records.credits} /> : <RecordTable loading={loading} headers={["Número", "Solicitud", "Registro", "Estado"]} rows={records.notes} />}</div>;
}

function RecordTable({ loading, headers, rows }: { loading: boolean; headers: string[]; rows: string[][] }) {
  if (loading) return <div className="empty-state">Cargando datos del asociado…</div>;
  if (!rows.length) return <div className="empty-state"><b>Sin registros todavía</b><small>Los movimientos asociados a esta persona aparecerán aquí al registrarlos.</small></div>;
  return <section className="data-panel history"><Table><TableHeader><TableRow>{headers.map((header) => <TableHead key={header}>{header}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow className="data-row" key={row.join("-")}>{row.map((cell, index) => <TableCell className={index === 0 ? "font-semibold" : ""} key={`${index}-${cell}`}>{index === row.length - 1 ? <StatusFor value={cell} /> : cell}</TableCell>)}</TableRow>)}</TableBody></Table></section>;
}

function CreditScreen({ csrf, role, go }: { csrf: string; role: string; go: (view: View) => void }) {
  const [associates, setAssociates] = useState<ApiJson[]>([]), [products, setProducts] = useState<ApiJson[]>([]), [rows, setRows] = useState<ApiJson[]>([]);
  const [associateId, setAssociateId] = useState(""), [amount, setAmount] = useState(""), [term, setTerm] = useState(""), [purpose, setPurpose] = useState("");
  const [capacity, setCapacity] = useState<ApiJson | null>(null), [multiplier, setMultiplier] = useState("3"), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    fetch("/api/?action=associates", { credentials: "same-origin" }).then((response) => response.ok ? readJson(response) : Promise.reject()).then((data) => setAssociates(data.associates || [])).catch(() => setAssociates([]));
    fetch("/api/?action=products&type=credito", { credentials: "same-origin" }).then((response) => response.ok ? readJson(response) : Promise.reject()).then((data) => setProducts(data.products || [])).catch(() => setProducts([]));
    fetch("/api/?action=credit-applications", { credentials: "same-origin" }).then((response) => response.ok ? readJson(response) : Promise.reject()).then((data) => setRows(data.applications || [])).catch(() => setRows([]));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!associateId) return;
    let cancelled = false;
    fetch(`/api/?action=credit-capacity&associate_id=${associateId}`, { credentials: "same-origin" }).then((response) => response.ok ? readJson(response) : Promise.reject()).then((data) => { if (!cancelled) setCapacity(data); }).catch(() => { if (!cancelled) setCapacity(null); });
    return () => { cancelled = true; };
  }, [associateId]);
  const numericAmount = Number(amount) || 0, months = Number(term) || 0;
  const estimatedInstallment = numericAmount > 0 && months > 0 ? numericAmount * .02 / (1 - Math.pow(1.02, -months)) : 0;
  const decide = async (application: ApiJson, status: "aprobada" | "rechazada") => {
    const quote = Number(application.requested_amount) * .02 / (1 - Math.pow(1.02, -Number(application.requested_term_months)));
    if (status === "aprobada" && !window.confirm(`¿Aprobar el crédito #${application.id} con cupo de ${multiplier} veces los aportes? La cuota estimada es ${money(quote)} al mes.`)) return;
    setBusy(true);
    try {
      const response = await fetch("/api/?action=credit-applications", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ id: Number(application.id), status, multiplier: Number(multiplier) }) });
      const data = await readJson(response);
      if (!response.ok) { setNotice(data.error || "No fue posible procesar la solicitud."); return; }
      setNotice(status === "aprobada" ? "Crédito aprobado. La cuota quedó registrada en la solicitud." : "Solicitud de crédito rechazada."); load();
    } catch { setNotice("No se pudo conectar con el servidor."); }
    finally { setBusy(false); }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy) return; setBusy(true);
    try {
      const response = await fetch("/api/?action=credit-applications", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ associate_id: Number(associateId), product_id: Number(products[0]?.id), amount: numericAmount, term_months: months, purpose }) });
      const data = await readJson(response);
      if (!response.ok) { setNotice(data.error || "No fue posible crear la solicitud."); return; }
      if (data.pending_approval) { go("mis_solicitudes"); return; }
      setNotice("Solicitud de crédito creada y lista para revisión."); setAmount(""); setTerm(""); setPurpose(""); load();
    } catch { setNotice("No se pudo conectar con el servidor."); }
    finally { setBusy(false); }
  };
  return <div className="page"><Heading eyebrow="TESORERÍA" title="Créditos" text="Solicita y revisa créditos de libre inversión. La Superadmin decide el multiplicador de cupo para cada caso." />
    <section className="data-panel"><form className="p-6 grid gap-4 md:grid-cols-2" onSubmit={submit}>
      {!associates.length && <div className="form-guidance md:col-span-2"><div><b>Primero necesitas un asociado activo</b><small>Después de registrar sus aportes, se calculará el cupo disponible para crédito.</small></div><Button type="button" variant="outline" onClick={() => go("asociados")}>Abrir asociados <ChevronRight /></Button></div>}
      <label>Asociado<select value={associateId} onChange={(event) => { setCapacity(null); setAssociateId(event.target.value); }} required className="w-full rounded-md border p-2" disabled={!associates.length}><option value="">Selecciona</option>{associates.map((associate) => <option key={associate.id} value={associate.id}>{associate.first_name} {associate.last_name} · {associate.document_number}</option>)}</select></label>
      <label>Monto solicitado<Input type="number" min="1" step="1000" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
      <label>Plazo<Input type="number" min="1" max="60" value={term} onChange={(event) => setTerm(event.target.value)} required /></label>
      <label>Destino del crédito<Input value={purpose} onChange={(event) => setPurpose(event.target.value)} maxLength={255} /></label>
      {capacity && <div className="credit-capacity md:col-span-2"><div><small>Ahorro total registrado</small><b>{money(Number(capacity.total_savings))}</b></div><div><small>Ahorro a la vista · 30%</small><b>{money(Number(capacity.vista_balance))}</b></div><div><small>Aportes base · 70%</small><b>{money(Number(capacity.contributions_balance))}</b></div><div><small>Cupo máximo · x5</small><b>{money(Number(capacity.credit_limits["5"]))}</b></div>{numericAmount > Number(capacity.credit_limits["5"]) && <p role="alert">El valor excede el máximo de cinco veces los aportes base.</p>}{estimatedInstallment > 0 && <p className="md:col-span-4">Cuota estimada a {months} meses y 2% mensual sobre saldo pendiente: <b>{money(estimatedInstallment)}</b>. La cuota definitiva se fija al aprobar.</p>}</div>}
      <div className="md:col-span-2"><Button className="violet-button" type="submit" disabled={busy || !associates.length || !products.length || numericAmount <= 0 || months < 1 || months > 60 || !capacity || numericAmount > Number(capacity.credit_limits["5"])}>{busy ? "Guardando…" : role === "operador" ? "Enviar a revisión" : "Crear solicitud de crédito"}</Button>{notice && <small className="ml-3" role="status">{notice}</small>}</div>
    </form></section>
    <section className="data-panel mt-6"><div className="table-tools"><div><b>Solicitudes de crédito</b><small>El cupo aprobado y la cuota se guardan en el historial de cada solicitud.</small></div><small>{rows.length} registros</small></div>{rows.length ? <Table><TableHeader><TableRow><TableHead>Asociado</TableHead><TableHead>Solicitud</TableHead><TableHead>Plazo</TableHead><TableHead>Cupo aprobado</TableHead><TableHead>Cuota mensual</TableHead><TableHead>Estado</TableHead>{role === "superadmin" && <TableHead>Decisión</TableHead>}</TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell>{row.first_name} {row.last_name}</TableCell><TableCell>{money(Number(row.requested_amount))}</TableCell><TableCell>{row.requested_term_months} meses</TableCell><TableCell>{row.approved_multiplier ? `x${row.approved_multiplier}` : "Pendiente"}</TableCell><TableCell>{row.monthly_installment ? money(Number(row.monthly_installment)) : "—"}</TableCell><TableCell><StatusFor value={row.status} /></TableCell>{role === "superadmin" && <TableCell>{row.status === "en_revision" ? <div className="flex items-center gap-2"><select aria-label={`Multiplicador de cupo para solicitud ${row.id}`} className="rounded-md border p-2" value={multiplier} onChange={(event) => setMultiplier(event.target.value)}><option value="3">x3</option><option value="4">x4</option><option value="5">x5</option></select><Button disabled={busy} onClick={() => decide(row, "aprobada")}>Aprobar</Button><Button variant="outline" disabled={busy} onClick={() => decide(row, "rechazada")}>Rechazar</Button></div> : "—"}</TableCell>}</TableRow>)}</TableBody></Table> : <div className="empty-state"><b>Aún no hay solicitudes</b><small>Al crear una solicitud, aparecerá aquí para seguimiento y decisión.</small></div>}</section>
  </div>;
}

function FinanceScreen({ type, csrf, go }: { type: "ahorro"; csrf: string; go: (view: View) => void }) { const [associates, setAssociates] = useState<ApiJson[]>([]), [products, setProducts] = useState<ApiJson[]>([]), [rows, setRows] = useState<ApiJson[]>([]), [notice, setNotice] = useState(""); const title = "Ahorros y aportes"; const reload = () => { fetch("/api/?action=associates", { credentials: "same-origin" }).then(r => readJson(r)).then(x => setAssociates(x.associates || [])); fetch(`/api/?action=products&type=${type}`, { credentials: "same-origin" }).then(r => readJson(r)).then(x => setProducts(x.products || [])); fetch("/api/?action=savings-transactions", { credentials: "same-origin" }).then(r => readJson(r)).then(x => setRows(x.transactions || [])); }; useEffect(reload, [type]); const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); const payload = { associate_id: Number(f.get("associate")), product_id: Number(f.get("product")), movement_type: f.get("movement"), amount: Number(f.get("amount")), reference: f.get("reference") }; fetch("/api/?action=savings-transactions", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify(payload) }).then(r => readJson(r)).then(x => { setNotice(x.message || x.error || "Operación guardada correctamente."); if (x.pending_approval) { go("mis_solicitudes"); return; } if (x.ok) { (e.target as HTMLFormElement).reset(); reload(); } }); }; return <div className="page"><Heading eyebrow="OPERACIÓN" title={title} text="Registra movimientos y consulta los saldos derivados de los aportes aplicados." /><section className="data-panel"><form className="p-6 grid gap-3 md:grid-cols-2" onSubmit={submit}>{!associates.length && <div className="form-guidance md:col-span-2"><div><b>Primero necesitas un asociado activo</b><small>Después de registrarlo o aprobarlo, podrás agregar aportes o solicitudes de crédito.</small></div><Button type="button" variant="outline" onClick={() => go("asociados")}>Abrir asociados <ChevronRight /></Button></div>}<label>Asociado<select name="associate" required className="w-full rounded-md border p-2" disabled={!associates.length}><option value="">Selecciona</option>{associates.map(a => <option value={a.id} key={a.id}>{a.first_name} {a.last_name} · {a.document_number}</option>)}</select></label><label>Producto<select name="product" required className="w-full rounded-md border p-2"><option value="">Selecciona</option>{products.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>Movimiento<select name="movement" className="w-full rounded-md border p-2"><option value="aporte">Aporte</option><option value="retiro">Retiro</option></select></label><label>Valor<Input name="amount" type="number" min="1" required /></label><label className="md:col-span-2">Referencia<Input name="reference" /></label><div><Button className="violet-button" type="submit" disabled={!associates.length || !products.length}>Registrar movimiento</Button>{notice && <small className="ml-3">{notice}</small>}</div></form></section><section className="data-panel mt-6"><div className="table-tools"><b>Operaciones registradas</b></div><Table><TableHeader><TableRow><TableHead>Asociado</TableHead><TableHead>Producto</TableHead><TableHead>Valor</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{rows.length ? rows.map(r => <TableRow key={r.id}><TableCell>{r.first_name} {r.last_name}</TableCell><TableCell>{r.product_name}</TableCell><TableCell>{money(Number(r.amount))}</TableCell><TableCell><StatusFor value={r.status === "en_revision" ? "En revisión" : r.status === "aplicado" ? "Aplicado" : r.status || "Pendiente"} /></TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="py-10 text-center text-slate-500">Aún no hay operaciones registradas.</TableCell></TableRow>}</TableBody></Table></section></div>; }
function UsersPanel({ csrf }: { csrf: string }) { const [users, setUsers] = useState<ApiJson[]>([]), [notice, setNotice] = useState(""); const load = () => fetch("/api/?action=users", { credentials: "same-origin" }).then(r => r.ok ? readJson(r) : null).then(x => setUsers(x?.users || [])).catch(() => setUsers([])); useEffect(() => { void load(); }, []); const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); fetch("/api/?action=users", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ full_name: f.get("full_name"), email: f.get("email"), role: "operador", password: f.get("password") }) }).then(async r => ({ ok: r.ok, data: await readJson(r) })).then(x => { setNotice(x.data.error || "Usuario creado. Comparta la contraseña por un canal seguro."); if (x.ok) { (e.target as HTMLFormElement).reset(); load(); } }).catch(() => setNotice("No fue posible guardar el usuario.")); }; return <section className="data-panel mt-6"><div className="table-tools"><b>Usuarios internos</b><small>La cuenta Superadmin es única. Desde aquí solo se crean cuentas Operador.</small></div><form className="p-6 grid gap-3 md:grid-cols-2" onSubmit={submit}><label>Nombre completo<Input name="full_name" required /></label><label>Correo electrónico<Input name="email" type="email" required /></label><label>Rol<input value="Operador" readOnly className="w-full rounded-md border p-2" /></label><label>Contraseña inicial<Input name="password" type="password" minLength={12} required /></label><div className="md:col-span-2"><Button className="violet-button" type="submit">Crear usuario</Button>{notice && <small className="ml-3">{notice}</small>}</div></form><Table><TableHeader><TableRow><TableHead>Nombre</TableHead><TableHead>Correo</TableHead><TableHead>Rol</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{users.length ? users.map(u => <TableRow key={u.id}><TableCell>{u.full_name}</TableCell><TableCell>{u.email}</TableCell><TableCell>{u.role}</TableCell><TableCell><StatusFor value={Number(u.active) ? "Activo" : "Retirado"} /></TableCell></TableRow>) : <TableRow><TableCell colSpan={4} className="py-10 text-center text-slate-500">No hay usuarios Operador registrados.</TableCell></TableRow>}</TableBody></Table></section>; }

function PromissoryNotesScreen({ csrf, role, go }: { csrf: string; role: string; go: (view: View) => void }) {
  const [notes, setNotes] = useState<ApiJson[]>([]);
  const [credits, setCredits] = useState<ApiJson[]>([]);
  const [associates, setAssociates] = useState<ApiJson[]>([]);
  const [associateId, setAssociateId] = useState("");
  const [selectedNote, setSelectedNote] = useState<ApiJson | null>(null);
  const [documents, setDocuments] = useState<ApiJson[]>([]);
  const [notice, setNotice] = useState("");
  const [documentNotice, setDocumentNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [noteResponse, creditResponse, associateResponse] = await Promise.all([
        fetch("/api/?action=promissory-notes", { credentials: "same-origin" }),
        fetch("/api/?action=credit-applications", { credentials: "same-origin" }),
        fetch("/api/?action=associates", { credentials: "same-origin" }),
      ]);
      if (!noteResponse.ok || !creditResponse.ok || !associateResponse.ok) throw new Error("No fue posible consultar los registros.");
      const [noteData, creditData, associateData] = await Promise.all([readJson(noteResponse), readJson(creditResponse), readJson(associateResponse)]);
      setNotes(noteData.notes || []);
      setCredits((creditData.applications || []).filter((credit: ApiJson) => ["aprobada", "desembolsada"].includes(credit.status)));
      setAssociates((associateData.associates || []).filter((associate: ApiJson) => associate.status === "activo"));
    } catch { setNotice("No se pudieron cargar los pagarés y créditos aprobados."); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const availableCredits = credits.filter((credit) => String(credit.associate_id) === associateId);
  const openDocuments = async (note: ApiJson) => {
    setSelectedNote(note); setDocuments([]); setDocumentNotice("");
    try {
      const response = await fetch("/api/?action=promissory-documents&note_id=" + note.id, { credentials: "same-origin" });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || "No fue posible cargar los documentos.");
      setDocuments(data.documents || []);
    } catch (error) { setDocumentNotice(error instanceof Error ? error.message : "No fue posible cargar los documentos."); }
  };
  const createNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy) return;
    const formElement = event.currentTarget; const form = new FormData(formElement); setBusy(true);
    try {
      const response = await fetch("/api/?action=promissory-notes", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ associate_id: Number(associateId), credit_application_id: Number(form.get("credit")), note_number: form.get("number"), notes: form.get("notes") }) });
      const data = await readJson(response);
      if (!response.ok) { setNotice(data.error || "No fue posible registrar el pagaré."); return; }
      if (data.pending_approval) { go("mis_solicitudes"); return; }
      setNotice("Pagaré registrado para el crédito aprobado."); formElement.reset(); setAssociateId(""); await load();
    } catch { setNotice("No se pudo conectar con el servidor."); }
    finally { setBusy(false); }
  };
  const uploadDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selectedNote || busy) return;
    const formElement = event.currentTarget; const body = new FormData(formElement); body.set("note_id", String(selectedNote.id)); setBusy(true);
    try {
      const response = await fetch("/api/?action=promissory-documents", { method: "POST", credentials: "same-origin", headers: { "X-CSRF-Token": csrf }, body });
      const data = await readJson(response);
      if (!response.ok) { setDocumentNotice(data.error || "No fue posible guardar el archivo."); return; }
      if (data.pending_approval) { setSelectedNote(null); go("mis_solicitudes"); return; }
      setDocumentNotice(data.message || "Documento guardado."); formElement.reset(); await openDocuments(selectedNote); await load();
    } catch { setDocumentNotice("No se pudo conectar con el servidor."); }
    finally { setBusy(false); }
  };
  const retireDocument = async (document: ApiJson) => {
    if (!window.confirm("¿Retirar \"" + document.label + "\"? El archivo seguirá bajo custodia privada.")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/?action=promissory-documents&id=" + document.id, { method: "DELETE", credentials: "same-origin", headers: { "X-CSRF-Token": csrf } });
      const data = await readJson(response);
      if (!response.ok) { setDocumentNotice(data.error || "No fue posible retirar el documento."); return; }
      if (data.pending_approval) { setSelectedNote(null); go("mis_solicitudes"); return; }
      setDocumentNotice(data.message || "Documento retirado."); await openDocuments(selectedNote); await load();
    } catch { setDocumentNotice("No se pudo conectar con el servidor."); }
    finally { setBusy(false); }
  };
  return <div className="page">
    <Heading eyebrow="TESORERÍA" title="Pagarés" text="Cada pagaré se vincula a un crédito aprobado. Sus archivos se guardan en una carpeta privada, fuera del sitio público." />
    <section className="data-panel"><form className="p-6 grid gap-3 md:grid-cols-2" onSubmit={createNote}>
      {!credits.length && <div className="form-guidance md:col-span-2"><div><b>Necesitas un crédito aprobado</b><small>Al aprobar un crédito, aparecerá aquí para registrar su pagaré y los documentos de custodia.</small></div><Button type="button" variant="outline" onClick={() => go("creditos")}>Abrir créditos <ChevronRight /></Button></div>}
      <label>Asociado<select value={associateId} onChange={(event) => setAssociateId(event.target.value)} required className="w-full rounded-md border p-2" disabled={!associates.length}><option value="">Selecciona</option>{associates.map((associate) => <option key={associate.id} value={associate.id}>{associate.first_name} {associate.last_name} · {associate.document_number}</option>)}</select></label>
      <label>Crédito aprobado<select name="credit" required className="w-full rounded-md border p-2" disabled={!availableCredits.length}><option value="">Selecciona un crédito</option>{availableCredits.map((credit) => <option key={credit.id} value={credit.id}>#{credit.id} · {money(Number(credit.requested_amount))}</option>)}</select></label>
      <label>Número de pagaré<Input name="number" required /></label><label>Observaciones<Input name="notes" maxLength={255} /></label>
      <div className="md:col-span-2"><Button type="submit" className="violet-button" disabled={busy || !availableCredits.length}>{busy ? "Guardando…" : role === "operador" ? "Enviar registro a aprobación" : "Registrar pagaré"}</Button>{notice && <small className="ml-3" role="status">{notice}</small>}</div>
    </form></section>
    <section className="data-panel mt-6"><div className="table-tools"><div><b>Registro de pagarés</b><small>Los escaneos solo se descargan después de iniciar sesión.</small></div><small>{notes.length} registros</small></div>
      {notes.length ? <Table><TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Asociado</TableHead><TableHead>Crédito</TableHead><TableHead>Documentos</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{notes.map((note) => <TableRow key={note.id}><TableCell>{note.note_number}</TableCell><TableCell>{note.first_name} {note.last_name}</TableCell><TableCell>#{note.credit_application_id}</TableCell><TableCell><Button variant="outline" onClick={() => void openDocuments(note)}>Ver documentos ({note.document_count || 0})</Button></TableCell><TableCell><StatusFor value={note.status} /></TableCell></TableRow>)}</TableBody></Table> : <div className="empty-state"><b>Aún no hay pagarés</b><small>Se registran cuando un crédito queda aprobado.</small></div>}
    </section>
    <Dialog open={Boolean(selectedNote)} onOpenChange={(open) => { if (!open && !busy) setSelectedNote(null); }}>
      <DialogContent className="associate-dialog sm:max-w-2xl">
        <DialogHeader><p className="dialog-eyebrow">CUSTODIA PRIVADA</p><DialogTitle>Documentos del pagaré {selectedNote?.note_number}</DialogTitle><DialogDescription>{role === "operador" ? "Los archivos que agregues esperan autorización de la Superadmin." : "Los archivos se almacenan fuera de la carpeta pública del sitio."}</DialogDescription></DialogHeader>
        <form className="grid gap-3" onSubmit={uploadDocument}><label>Nombre del documento<Input name="label" maxLength={120} placeholder="Ej. Pagaré firmado" required /></label><label>Archivo PDF, JPG o PNG · máximo 15 MB<Input name="file" type="file" accept="application/pdf,image/jpeg,image/png" required /></label><Button type="submit" className="violet-button" disabled={busy}>{busy ? "Guardando…" : role === "operador" ? "Enviar documento a aprobación" : "Guardar en custodia"}</Button></form>
        {documentNotice && <p role="status">{documentNotice}</p>}
        <div className="approval-list">{documents.length ? documents.map((document) => <article className="approval-item" key={document.id}><div className="approval-main"><b>{document.label}</b><small>{document.original_name} · {(Number(document.byte_size) / 1024 / 1024).toFixed(2)} MB</small><div className="mt-2"><StatusFor value={document.status} /></div></div><div className="approval-actions">{(role === "superadmin" || document.status === "custodiado") && <a className="text-button" href={"/api/?action=promissory-document-file&id=" + document.id}>Descargar</a>}{document.status === "custodiado" && <Button variant="outline" disabled={busy} onClick={() => void retireDocument(document)}>{role === "operador" ? "Solicitar retiro" : "Retirar"}</Button>}</div></article>) : <div className="empty-state"><b>No hay archivos adjuntos</b><small>Los documentos autorizados aparecerán aquí.</small></div>}</div>
      </DialogContent>
    </Dialog>
  </div>;
}

function PayrollCollectionsScreen({ csrf, role, go }: { csrf: string; role: string; go: (view: View) => void }) {
  const [rows, setRows] = useState<ApiJson[]>([]), [companies, setCompanies] = useState<ApiJson[]>([]), [associates, setAssociates] = useState<ApiJson[]>([]), [credits, setCredits] = useState<ApiJson[]>([]), [items, setItems] = useState<ApiJson[]>([]);
  const [selected, setSelected] = useState<ApiJson | null>(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const today = new Date(); const nextDay = today.getDate() < 10 ? 10 : today.getDate() < 20 ? 20 : 10; const nextMonth = nextDay === 10 && today.getDate() >= 20 ? new Date(today.getFullYear(), today.getMonth() + 1, 1) : today; const defaultDate = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const [collectionData, companyData, associateData, creditData] = await Promise.all(["payroll-collections", "companies", "associates", "credit-applications"].map(async (action) => { const response = await fetch(`/api/?action=${action}`, { credentials: "same-origin" }); if (!response.ok) throw new Error("No fue posible consultar los registros de nómina."); return readJson(response); }));
      setRows(collectionData.collections || []); setCompanies(companyData.companies || []); setAssociates((associateData.associates || []).filter((a: ApiJson) => a.status === "activo")); setCredits((creditData.applications || []).filter((credit: ApiJson) => ["aprobada", "desembolsada"].includes(String(credit.status)) && Number(credit.monthly_installment) > 0));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible cargar las relaciones."); } finally { setLoading(false); }
  }, []);
  const loadItems = useCallback(async (collection: ApiJson) => { setSelected(collection); setItems([]); setError(""); try { const response = await fetch(`/api/?action=payroll-items&collection_id=${collection.id}`, { credentials: "same-origin" }); const data = await readJson(response); if (!response.ok) throw new Error(data.error || "No fue posible abrir el detalle."); setItems(data.items || []); } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible abrir el detalle."); } }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const send = async (url: string, method: string, payload: ApiJson, form?: HTMLFormElement) => { setBusy(true); setNotice(""); setError(""); try { const response = await fetch(url, { method, credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify(payload) }); const data = await readJson(response); if (!response.ok) throw new Error(data.error || "No fue posible guardar los cambios."); if (data.pending_approval) { go("mis_solicitudes"); return false; } setNotice(data.message || "Cambios guardados."); form?.reset(); await load(); if (selected) { const collectionData = await readJson<ApiJson>(await fetch("/api/?action=payroll-collections", { credentials: "same-origin" })); const fresh = collectionData.collections?.find((row: ApiJson) => Number(row.id) === Number(selected.id)); if (fresh) await loadItems(fresh); } return true; } catch (reason) { setError(reason instanceof Error ? reason.message : "No fue posible guardar los cambios."); return false; } finally { setBusy(false); } };
  const exportCsv = () => { if (!selected) return; const safe = (value: unknown) => { const text = String(value ?? ""); const protectedText = /^[=+@-]/.test(text) ? `'${text}` : text; return `"${protectedText.replaceAll('"', '""')}"`; }; const content = [["Documento", "Asociado", "Tipo", "Concepto", "Valor"], ...items.filter((item) => item.status !== "anulado").map((item) => [item.document_number, `${item.first_name} ${item.last_name}`, item.charge_type, item.reference, item.amount])].map((line) => line.map(safe).join(",")).join("\r\n"); const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = `relacion-nomina-${selected.collection_date || selected.id}.csv`; link.click(); URL.revokeObjectURL(url); };
  const advance = async (status: string) => { if (!selected) return; const ok = await send("/api/?action=payroll-collections", "PATCH", { id: Number(selected.id), status }); if (ok) { const collectionData = await readJson<ApiJson>(await fetch("/api/?action=payroll-collections", { credentials: "same-origin" })); await loadItems(collectionData.collections?.find((row: ApiJson) => Number(row.id) === Number(selected.id)) || selected); } };
  const activeAssociates = selected ? associates.filter((associate) => Number(associate.company_id) === Number(selected.company_id)) : [];
  const draft = selected?.status === "borrador"; const nextStatus: Record<string, string> = { borrador: "enviado", enviado: "recibido", recibido: "conciliado" };
  return <div className="page">
    <Heading eyebrow="TESORERÍA" title="Cobros de nómina" text="Prepara la relación de cada empresa para los días 10 y 20, registra aportes, cuotas y convenios, y concilia lo recibido." />
    {error && <div className="auth-error" role="alert">{error}</div>}{notice && <p className="form-guidance" role="status">{notice}</p>}
    <section className="data-panel"><div className="table-tools"><div><b>Nueva relación</b><small>El valor esperado se calcula desde los conceptos agregados.</small></div></div>
      <form className="p-6 grid gap-3 md:grid-cols-3" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void send("/api/?action=payroll-collections", "POST", { company_id: Number(data.get("company_id")), collection_date: data.get("collection_date") }, form); }}>
        <label>Empresa<select name="company_id" required className="w-full rounded-md border p-2"><option value="">Selecciona una empresa</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select>{!companies.length && <small>Registra la empresa desde la afiliación de un asociado antes de crear la relación.</small>}</label>
        <label>Fecha de cobro<Input name="collection_date" type="date" defaultValue={defaultDate} required /></label>
        <div className="flex items-end"><Button className="violet-button" type="submit" disabled={busy || !companies.length}>{busy ? "Guardando…" : role === "operador" ? "Solicitar relación" : "Crear borrador"}</Button></div>
      </form>
    </section>
    <section className="data-panel mt-6"><div className="table-tools"><div><b>Relaciones por empresa</b><small>Selecciona una relación para editarla o revisar su recaudo.</small></div><small>{rows.length} registros</small></div>
      {loading ? <div className="empty-state">Cargando relaciones…</div> : rows.length ? <Table><TableHeader><TableRow><TableHead>Empresa</TableHead><TableHead>Fecha</TableHead><TableHead>Conceptos</TableHead><TableHead>Esperado</TableHead><TableHead>Recaudado</TableHead><TableHead>Estado</TableHead><TableHead>Detalle</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell>{row.company_name || "Empresa no disponible"}</TableCell><TableCell>{row.collection_date || row.period_label}</TableCell><TableCell>{row.item_count}</TableCell><TableCell>{money(Number(row.expected_amount))}</TableCell><TableCell>{money(Number(row.collected_amount))}</TableCell><TableCell><StatusFor value={String(row.status).replaceAll("_", " ")} /></TableCell><TableCell><Button variant="outline" onClick={() => void loadItems(row)}>Abrir relación</Button></TableCell></TableRow>)}</TableBody></Table> : <div className="empty-state"><b>Aún no hay relaciones</b><small>Cuando registres la primera empresa y sus asociados activos, podrás crear aquí el cobro de nómina.</small></div>}
    </section>
    {selected && <section className="data-panel mt-6"><div className="table-tools"><div><b>{selected.company_name} · {selected.collection_date || selected.period_label}</b><small>Estado: {String(selected.status).replaceAll("_", " ")} · {money(Number(selected.expected_amount))} esperado</small></div><div className="flex gap-2"><Button variant="outline" onClick={exportCsv} disabled={!items.length}>Descargar CSV</Button><Button variant="outline" onClick={() => setSelected(null)}>Cerrar</Button></div></div>
      {draft && <form className="p-6 grid gap-3 border-b md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const type = String(data.get("charge_type")); void send("/api/?action=payroll-items", "POST", { payroll_collection_id: Number(selected.id), associate_id: Number(data.get("associate_id")), charge_type: type, credit_application_id: type === "cuota_credito" ? Number(data.get("credit_application_id")) : null, amount: Number(data.get("amount")), reference: data.get("reference") }, form); }}>
        <label>Asociado<select name="associate_id" required className="w-full rounded-md border p-2"><option value="">Selecciona</option>{activeAssociates.map((associate) => <option key={associate.id} value={associate.id}>{associate.first_name} {associate.last_name} · {associate.document_number}</option>)}</select>{!activeAssociates.length && <small>No hay asociados activos registrados para esta empresa.</small>}</label>
        <label>Concepto<select name="charge_type" required className="w-full rounded-md border p-2"><option value="aporte">Aporte</option><option value="cuota_credito">Cuota de crédito</option><option value="convenio">Convenio</option></select></label>
        <label>Crédito aprobado<select name="credit_application_id" className="w-full rounded-md border p-2"><option value="">Selecciona si es cuota de crédito</option>{credits.filter((credit) => activeAssociates.some((associate) => Number(associate.id) === Number(credit.associate_id))).map((credit) => <option key={credit.id} value={credit.id}>#{credit.id} · {credit.first_name} {credit.last_name} · cuota {money(Number(credit.monthly_installment))}</option>)}</select><small>El valor de la cuota se ingresa abajo para el período de cobro.</small></label>
        <label>Valor del concepto<Input name="amount" type="number" min="1" step="1" required /></label><label>Detalle o referencia<Input name="reference" maxLength={190} required /></label>
        <div className="md:col-span-2"><Button className="violet-button" type="submit" disabled={busy || !activeAssociates.length}>{busy ? "Guardando…" : role === "operador" ? "Solicitar concepto" : "Agregar a la relación"}</Button></div>
      </form>}
      {items.length ? <Table><TableHeader><TableRow><TableHead>Asociado</TableHead><TableHead>Concepto</TableHead><TableHead>Valor cobrado</TableHead><TableHead>Recaudado</TableHead><TableHead>Estado</TableHead>{(draft || selected.status === "recibido") && <TableHead>Acción</TableHead>}</TableRow></TableHeader><TableBody>{items.map((item) => <TableRow key={item.id}><TableCell>{item.first_name} {item.last_name}<small className="block">{item.document_number}</small></TableCell><TableCell>{String(item.charge_type).replaceAll("_", " ")} · {item.reference}</TableCell><TableCell>{money(Number(item.amount))}</TableCell><TableCell>{selected.status === "recibido" ? <Input aria-label={`Valor recaudado para ${item.first_name} ${item.last_name}`} name="collected" type="number" min="0" max={Number(item.amount)} step="1" defaultValue={item.collected_amount} /> : money(Number(item.collected_amount))}</TableCell><TableCell><StatusFor value={String(item.status).replaceAll("_", " ")} /></TableCell>{(draft || selected.status === "recibido") && <TableCell>{draft && <Button variant="outline" disabled={busy || item.status === "anulado"} onClick={() => void send(`/api/?action=payroll-items&id=${item.id}`, "DELETE", { id: Number(item.id) })}>Retirar</Button>}{selected.status === "recibido" && <Button variant="outline" disabled={busy} onClick={() => { const input = document.querySelector<HTMLInputElement>(`[aria-label="Valor recaudado para ${item.first_name} ${item.last_name}"]`); if (input) void send("/api/?action=payroll-items", "PATCH", { id: Number(item.id), collected_amount: Number(input.value) }); }}>Guardar recaudo</Button>}</TableCell>}</TableRow>)}</TableBody></Table> : <div className="empty-state"><b>La relación todavía no tiene conceptos</b><small>Agrega los valores reales de aportes, cuotas de crédito y convenios para esta empresa.</small></div>}
      <div className="p-6 flex flex-wrap gap-3">{selected.status !== "conciliado" && nextStatus[String(selected.status)] && <Button className="violet-button" disabled={busy || (selected.status === "recibido" && items.some((item) => item.status !== "anulado" && Number(item.collected_amount) < Number(item.amount)))} onClick={() => void advance(nextStatus[String(selected.status)])}>{role === "operador" ? "Solicitar cambio de etapa" : `Marcar como ${String(nextStatus[String(selected.status)]).replaceAll("_", " ")}`}</Button>}{selected.status === "recibido" && items.some((item) => item.status !== "anulado" && Number(item.collected_amount) < Number(item.amount)) && <small className="self-center">Completa la conciliación de cada concepto antes del cierre.</small>}</div>
    </section>}
  </div>;
}

const liveScreens = {
  afiliaciones: { eyebrow: "VINCULACIÓN", title: "Afiliaciones", text: "Solicitudes de afiliación registradas en el sistema.", action: "Nueva solicitud", heads: ["Solicitante", "Empresa", "Fecha", "Documentos", "Estado"], endpoint: "affiliations", key: "requests" },
  cartera: { eyebrow: "SEGUIMIENTO", title: "Cartera", text: "Consulta vencimientos, días en mora e interés estimado con la tasa de usura del mes.", action: "Nueva obligación", heads: ["Asociado", "Obligación", "Vencimiento", "Capital de cuota", "Días en mora", "Mora estimada", "Estado"], endpoint: "receivables", key: "receivables" },
  convenios: { eyebrow: "BENEFICIOS", title: "Convenios", text: "Convenios que FEGCON haya registrado.", action: "Nuevo convenio", heads: ["Convenio", "Beneficio", "Vigencia", "Estado"], endpoint: "catalog&category=convenio", key: "items" },
  pagos: { eyebrow: "RECAUDO", title: "Pagos", text: "Pagos registrados en la base de datos.", action: "Registrar pago", heads: ["Fecha", "Asociado", "Concepto", "Valor", "Estado"], endpoint: "payments", key: "payments" },
} as const;
type LiveScreenView = keyof typeof liveScreens;
type LiveRow = { id: number | string; cells: string[]; status: string };

function ListScreen({ view, csrf, role, go }: { view: View; csrf: string; role: string; go: (view: View) => void }) {
  const screen = liveScreens[view as LiveScreenView];
  const [rows, setRows] = useState<LiveRow[]>([]), [associates, setAssociates] = useState<ApiJson[]>([]), [notice, setNotice] = useState(""), [error, setError] = useState(""), [loading, setLoading] = useState(true), [formOpen, setFormOpen] = useState(false);
  const load = useCallback(() => { fetch(`/api/?action=${screen.endpoint}`, { credentials: "same-origin" }).then(async (response) => response.ok ? readJson(response) : Promise.reject(new Error("No fue posible consultar los registros."))).then((data) => {
    const source = data[screen.key] || [];
    const mapped: LiveRow[] = source.map((row: ApiJson) => {
      if (view === "afiliaciones") return { id: row.id, cells: [`${row.first_name} ${row.last_name}`, row.company_name || "Sin empresa", new Date(row.created_at).toLocaleDateString("es-CO"), row.documents_status === "completos" ? "Completos" : "Pendientes"], status: row.status };
      if (view === "cartera") { const days = Number(row.days_overdue || 0); return { id: row.id, cells: [`${row.first_name} ${row.last_name}`, row.reference, row.due_date, money(Number(row.amount)), `${days} días`, days > 0 && row.late_interest == null ? "Falta tasa del mes" : money(Number(row.late_interest || 0))], status: row.status } }
      if (view === "pagos") return { id: row.id, cells: [row.received_on, `${row.first_name} ${row.last_name}`, row.concept, money(Number(row.amount))], status: row.status };
      const payload = row.payload || {}; return { id: row.id, cells: [row.label, payload.benefit || "Sin descripción", payload.end_date || "Sin fecha de vencimiento"], status: Number(row.active) ? "Activo" : "Inactivo" };
    });
    setRows(mapped);
  }).catch((cause) => setError(cause instanceof Error ? cause.message : "No fue posible consultar los registros.")).finally(() => setLoading(false)); }, [screen, view]);
  useEffect(() => { load(); if (view === "pagos" || view === "cartera") fetch("/api/?action=associates", { credentials: "same-origin" }).then(r => r.ok ? readJson(r) : null).then(x => setAssociates(x?.associates || [])).catch(() => setAssociates([])); }, [load, view]);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); const action = screen.endpoint.split("&")[0]; let payload: Record<string, unknown>;
    if (view === "afiliaciones") payload = { document_number: form.get("document"), first_name: form.get("first"), last_name: form.get("last"), email: form.get("email"), phone: form.get("phone"), company: form.get("company"), documents_status: "pendientes" };
    else if (view === "cartera") payload = { associate_id: Number(form.get("associate")), reference: form.get("reference"), due_date: form.get("due_date"), amount: Number(form.get("amount")) };
    else if (view === "pagos") payload = { associate_id: Number(form.get("associate")), concept: form.get("concept"), amount: Number(form.get("amount")), reference: form.get("reference"), received_on: form.get("received_on") };
    else payload = { category: "convenio", label: form.get("label"), payload: { benefit: form.get("benefit"), start_date: form.get("start_date"), end_date: form.get("end_date") } };
    fetch(`/api/?action=${action}`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify(payload) }).then(async (response) => ({ ok: response.ok, data: await readJson(response) })).then(({ ok, data }) => { setNotice(data.message || data.error || (ok ? "Registro guardado." : "No fue posible guardar el registro.")); if (data.pending_approval) { go("mis_solicitudes"); return; } if (ok) { (event.target as HTMLFormElement).reset(); setFormOpen(false); load(); } }).catch(() => setNotice("No fue posible conectar con el servidor."));
  };
  const decide = (id: number, status: "aprobada" | "rechazada") => fetch("/api/?action=affiliations", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ id, status }) }).then(async r => ({ ok: r.ok, data: await readJson(r) })).then(({ ok, data }) => { setNotice(data.message || data.error || "Solicitud actualizada."); if (ok) load(); }).catch(() => setNotice("No fue posible procesar la solicitud."));
  return <div className="page"><Heading eyebrow={screen.eyebrow} title={screen.title} text={screen.text}><Button onClick={() => setFormOpen((open) => !open)} className="violet-button"><Plus />{formOpen ? "Cerrar formulario" : screen.action}</Button></Heading>
    {notice && <div className="success-note" role="status">{notice}<button onClick={() => setNotice("")}><X /></button></div>}
    {formOpen && <section className="data-panel mb-6"><form className="p-6 grid gap-3 md:grid-cols-2" onSubmit={submit}>
      {view === "afiliaciones" && <><label>Documento<Input name="document" required /></label><label>Nombres<Input name="first" required /></label><label>Apellidos<Input name="last" required /></label><label>Empresa<Input name="company" /></label><label>Correo electrónico<Input name="email" type="email" /></label><label>Celular<Input name="phone" /></label></>}
      {(view === "pagos" || view === "cartera") && <><label className="md:col-span-2">Asociado<select name="associate" required className="w-full rounded-md border p-2"><option value="">Selecciona un asociado</option>{associates.map((item) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name} · {item.document_number}</option>)}</select>{!associates.length && <small>Registra o aprueba un asociado antes de continuar.</small>}</label>{view === "pagos" ? <><label>Concepto<Input name="concept" required /></label><label>Fecha<Input type="date" name="received_on" required /></label></> : <><label>Referencia<Input name="reference" required /></label><label>Vencimiento<Input type="date" name="due_date" required /></label></>}<label>Valor<Input name="amount" type="number" min="1" step="1" required /></label>{view === "pagos" && <label>Referencia de pago<Input name="reference" /></label>}</>}
      {view === "convenios" && <><label>Nombre del convenio<Input name="label" required /></label><label>Beneficio o descripción<Input name="benefit" required /></label><label>Fecha de inicio<Input name="start_date" type="date" /></label><label>Vigencia hasta<Input name="end_date" type="date" /></label></>}
      <div className="md:col-span-2"><Button className="violet-button" type="submit" disabled={(view === "pagos" || view === "cartera") && !associates.length}>Guardar</Button></div>
    </form></section>}
    {error && <div className="auth-error" role="alert">{error}</div>}
    <section className="data-panel"><div className="table-tools"><b>Registros</b><small>{rows.length} registros</small></div>{loading ? <div className="empty-state">Cargando registros…</div> : rows.length ? <Table><TableHeader><TableRow>{screen.heads.map((head) => <TableHead key={head}>{head}</TableHead>)}{view === "afiliaciones" && role === "superadmin" && <TableHead>Acciones</TableHead>}</TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id} className="data-row">{row.cells.map((cell, index) => <TableCell className={index === 0 ? "font-semibold" : ""} key={`${row.id}-${index}`}>{cell}</TableCell>)}<TableCell><StatusFor value={row.status.replaceAll("_", " ")} /></TableCell>{view === "afiliaciones" && role === "superadmin" && <TableCell>{row.status === "en_revision" ? <div className="flex gap-2"><Button onClick={() => decide(Number(row.id), "aprobada")}>Aprobar</Button><Button variant="outline" onClick={() => decide(Number(row.id), "rechazada")}>Rechazar</Button></div> : "—"}</TableCell>}</TableRow>)}</TableBody></Table> : <div className="empty-state"><b>{error ? "No se pudieron cargar los registros" : "Sin registros todavía"}</b><small>{error || "Los datos aparecerán aquí cuando se realicen las primeras operaciones."}</small>{!error && <Button onClick={() => setFormOpen(true)} className="violet-button"><Plus />{screen.action}</Button>}</div>}</section>
  </div>;
}

function Reports({ go }: { go: (view: View) => void }) {
  const reports: [LucideIcon, string, string, View][] = [
    [Users, "Asociados", "Consultar el directorio actualizado.", "asociados"],
    [HandCoins, "Créditos", "Consultar solicitudes y productos registrados.", "creditos"],
    [ReceiptText, "Cartera", "Revisar obligaciones y vencimientos registrados.", "cartera"],
    [Banknote, "Cobros de nómina", "Consultar relaciones creadas.", "cobros"],
    [WalletCards, "Ahorros y aportes", "Consultar movimientos registrados.", "ahorros"],
    [Building2, "Convenios", "Consultar convenios registrados.", "convenios"],
  ];
  return <div className="page"><Heading eyebrow="CONSULTA Y CONTROL" title="Reportes" text="Abre cada módulo para consultar los datos vigentes del sistema." /><section className="reports">{reports.map(([Icon, title, description, target], index) => <button key={title} onClick={() => go(target)}><span className={`report-mark mark-${index}`}><Icon /></span><b>{title}</b><small>{description}</small><em>Ver registros <ArrowUpRight /></em></button>)}</section></div>;
}
