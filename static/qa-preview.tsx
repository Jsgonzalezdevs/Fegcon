import { BrandLogo } from "@/components/fegcon/brand-logo";
/** Development-only visual review. No fabricated operational data or successful API responses. */
import { createRoot } from "react-dom/client";
import { useState } from "react";
import "../app/globals.css";
import "../app/workspace.css";
import { ModuleGuide } from "../components/fegcon/module-guide";
import { TaskFinder } from "../components/fegcon/task-finder";
import {
  PermissionContext,
  nav,
  titles,
  type View,
} from "../components/fegcon/shared";
import { Dashboard, Login } from "../components/fegcon/dashboard";
import { Associates } from "../components/fegcon/associates";
import { CreditScreen } from "../components/fegcon/credits";
import { FinanceScreen } from "../components/fegcon/savings";
import { ListScreen, Reports } from "../components/fegcon/records";
import { CompaniesPanel } from "../components/fegcon/companies";
import { PromissoryNotesScreen } from "../components/fegcon/promissory";
import { PayrollCollectionsScreen } from "../components/fegcon/payroll";
import { SuperadminHub } from "../components/fegcon/administration";

if (!import.meta.env.DEV)
  throw new Error("Esta revisión solo está disponible en desarrollo.");
function Review() {
  const [view, go] = useState<View>("inicio");
  const [login, setLogin] = useState(false);
  const reviewSession = {
    id: 0,
    name: "Revisión local",
    email: "",
    role: "superadmin",
    role_label: "Revisión visual",
    permissions: { all: true as const },
  };
  if (login) return <Login error="" onLogin={async () => setLogin(false)} />;
  return (
    <PermissionContext.Provider value={{ all: true }}>
      <div className="fegcon-app">
        <aside className="app-rail">
          <div className="brand">
            <div className="brand-identity">
              <BrandLogo />
              <small>Revisión de interfaz</small>
            </div>
          </div>
          <nav aria-label="Módulos">
            {nav.map((group) => (
              <div className="nav-group" key={group.label}>
                <p>{group.label}</p>
                {group.items.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    className={view === id ? "is-active" : ""}
                    onClick={() => go(id)}
                  >
                    <Icon />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            ))}
            <div className="nav-group">
              <p>ADMINISTRACIÓN</p>
              <button onClick={() => go("administracion")}>
                Centro de control
              </button>
              <button onClick={() => setLogin(true)}>Revisar acceso</button>
            </div>
          </nav>
          <div className="rail-bottom">
            <TaskFinder go={go} canAccess={() => true} />
          </div>
        </aside>
        <div className="app-area">
          <header className="app-topbar">
            <b>{titles[view]}</b>
            <small>Revisión local · API no conectada</small>
          </header>
          <main className="app-content">
            <ModuleGuide view={view} role="superadmin" />
            {view === "inicio" ? (
              <Dashboard go={go} csrf="" session={reviewSession} />
            ) : view === "asociados" ? (
              <Associates
                data={[]}
                role="superadmin"
                onOpen={() => {}}
                onEdit={() => {}}
                onRetire={() => {}}
                onNew={() => {}}
                query=""
                onQueryChange={() => {}}
                loading={false}
                error=""
                onRetry={() => {}}
              />
            ) : view === "creditos" ? (
              <CreditScreen csrf="" role="superadmin" go={go} />
            ) : view === "ahorros" ? (
              <FinanceScreen type="ahorro" csrf="" go={go} />
            ) : view === "empresas" ? (
              <CompaniesPanel csrf="" role="superadmin" go={go} />
            ) : view === "pagares" ? (
              <PromissoryNotesScreen csrf="" role="superadmin" go={go} />
            ) : view === "cobros" ? (
              <PayrollCollectionsScreen csrf="" role="superadmin" go={go} />
            ) : view === "reportes" ? (
              <Reports go={go} />
            ) : view === "administracion" ? (
              <SuperadminHub csrf="" go={go} />
            ) : (
              <ListScreen
                key={view}
                view={view}
                csrf=""
                role="superadmin"
                go={go}
              />
            )}
          </main>
        </div>
      </div>
    </PermissionContext.Provider>
  );
}
createRoot(document.getElementById("root")!).render(<Review />);
