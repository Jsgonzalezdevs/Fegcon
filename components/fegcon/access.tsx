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
import { ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  ApiJson,
  PermissionSet,
  readJson,
  StatusFor,
} from "@/components/fegcon/shared";

export function UsersPanel({ csrf }: { csrf: string }) {
  const [users, setUsers] = useState<ApiJson[]>([]),
    [notice, setNotice] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/?action=users", {
        credentials: "same-origin",
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(data.error || "No fue posible consultar los usuarios.");
      setUsers(data.users || []);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible consultar los usuarios.",
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
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch("/api/?action=users", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({
          full_name: values.get("full_name"),
          email: values.get("email"),
          role: "operador",
          password: values.get("password"),
        }),
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(data.error || "No fue posible crear el usuario.");
      form.reset();
      setNotice(
        "Usuario creado. Comparte la contraseña inicial por un canal seguro.",
      );
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible guardar el usuario.",
      );
    } finally {
      setBusy(false);
    }
  };
  const setActive = async (user: ApiJson) => {
    const activating = !Number(user.active);
    if (
      !activating &&
      !window.confirm(
        `¿Suspender el acceso de ${user.full_name}? Su cuenta dejará de iniciar sesión.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch("/api/?action=users", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ id: Number(user.id), active: activating }),
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(data.error || "No fue posible cambiar el acceso.");
      setNotice(data.message);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible cambiar el acceso.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="data-panel mt-6">
      <div className="table-tools">
        <div>
          <b>Personas y cuentas</b>
          <small>
            Administra quién puede entrar al sistema. Los permisos del perfil se
            ajustan en “Roles y permisos”.
          </small>
        </div>
        <div className="flex items-center gap-2">
          <small>
            {
              users.filter(
                (user) => user.role === "operador" && Number(user.active),
              ).length
            }{" "}
            supervisores activos
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
      {error && (
        <div className="px-6 pt-4">
          <div className="auth-error" role="alert">
            {error}
          </div>
        </div>
      )}
      {notice && (
        <p className="px-6 pt-3" role="status">
          {notice}
        </p>
      )}
      <form className="p-6 grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <label>
          Nombre completo
          <Input name="full_name" autoComplete="name" required />
        </label>
        <label>
          Correo electrónico
          <Input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Perfil de acceso
          <input
            value="Supervisor"
            readOnly
            className="w-full rounded-md border p-2"
          />
        </label>
        <label>
          Contraseña inicial
          <Input
            name="password"
            type="password"
            minLength={12}
            autoComplete="new-password"
            required
          />
          <small>Mínimo 12 caracteres. Compártela por un canal seguro.</small>
        </label>
        <div className="md:col-span-2">
          <Button className="violet-button" type="submit" disabled={busy}>
            {busy ? "Guardando…" : "Crear acceso de Supervisor"}
          </Button>
        </div>
      </form>
      {loading ? (
        <div className="empty-state">Consultando cuentas…</div>
      ) : users.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acceso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.full_name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  {user.role === "superadmin" ? "Superadmin" : "Supervisor"}
                </TableCell>
                <TableCell>
                  <StatusFor
                    value={Number(user.active) ? "Activo" : "Inactivo"}
                  />
                </TableCell>
                <TableCell>
                  {user.role === "operador" && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void setActive(user)}
                    >
                      {Number(user.active)
                        ? "Desactivar cuenta"
                        : "Activar cuenta"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="empty-state">
          <b>Aún no hay supervisores</b>
          <small>Crea una cuenta para quien apoyará la operación diaria.</small>
        </div>
      )}
    </section>
  );
}

export const permissionModuleLabels: Record<string, string> = {
  inicio: "Inicio y resumen",
  associates: "Asociados",
  affiliations: "Afiliaciones",
  companies: "Empresas",
  savings: "Ahorros y aportes",
  credits: "Créditos",
  promissory: "Pagarés",
  receivables: "Cartera",
  payroll: "Cobros de nómina",
  payments: "Pagos",
  convenios: "Convenios",
  reports: "Reportes",
  rules: "Reglas financieras",
  approvals: "Mis solicitudes",
};
export const protectedAccess = [
  "Aprobar solicitudes y decisiones",
  "Administrar cuentas y permisos",
  "Cambiar la configuración del fondo",
  "Consultar la bitácora completa",
];

export function RolePermissionsPanel({ csrf }: { csrf: string }) {
  const [permissions, setPermissions] = useState<PermissionSet>({});
  const [modules, setModules] = useState<PermissionSet>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/?action=role-permissions", {
        credentials: "same-origin",
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(
          data.error || "No fue posible cargar los permisos del perfil.",
        );
      setModules(data.modules || {});
      setPermissions(data.permissions || {});
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible cargar los permisos.",
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
  const toggle = (
    module: string,
    capability: "view" | "manage",
    checked: boolean,
  ) => {
    setNotice("");
    setPermissions((current) => ({
      ...current,
      [module]: {
        view:
          capability === "view" ? checked : (current[module]?.view ?? false),
        manage:
          capability === "manage"
            ? checked
            : capability === "view" && !checked
              ? false
              : (current[module]?.manage ?? false),
      },
    }));
  };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch("/api/?action=role-permissions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({ permissions }),
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(data.error || "No fue posible guardar los permisos.");
      setPermissions(data.permissions || permissions);
      setNotice(data.message || "Cambios guardados.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible guardar los permisos.",
      );
    } finally {
      setSaving(false);
    }
  };
  const visibleModules = Object.entries(permissions)
    .filter(([, access]) => access.view)
    .map(([module]) => permissionModuleLabels[module] || module);
  const manageableModules = Object.entries(permissions)
    .filter(([, access]) => access.view && access.manage)
    .map(([module]) => permissionModuleLabels[module] || module);
  return (
    <section className="data-panel role-permissions-panel">
      <div className="role-permissions-intro">
        <span className="role-permissions-mark">
          <ShieldCheck />
        </span>
        <div>
          <p>PERFIL EDITABLE</p>
          <h2>Supervisor</h2>
          <small>
            Elige qué módulos puede consultar y en cuáles puede registrar o
            proponer cambios. La navegación se ajusta a estos permisos.
          </small>
        </div>
      </div>
      {error && (
        <div className="auth-error mx-5 mt-4" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p className="px-5 pt-4" role="status">
          {notice}
        </p>
      )}
      <div className="role-permissions-table-wrap">
        <table className="role-permissions-table">
          <thead>
            <tr>
              <th>Módulo</th>
              <th>Consultar</th>
              <th>Registrar / proponer</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(modules).map(([module, capability]) => {
              const access = permissions[module] || {
                view: false,
                manage: false,
              };
              const fixed = module === "inicio";
              const adminOnly = module === "approvals";
              return (
                <tr key={module}>
                  <th scope="row">
                    <b>{permissionModuleLabels[module] || module}</b>
                    <small>
                      {fixed
                        ? "Inicio disponible para todos los perfiles"
                        : adminOnly
                          ? "Solo se muestran las solicitudes propias"
                          : access.manage
                            ? "Cambios sujetos a las reglas del módulo"
                            : "Solo lectura"}
                    </small>
                  </th>
                  <td>
                    <label className="permission-switch">
                      <input
                        type="checkbox"
                        checked={access.view}
                        disabled={loading || saving || fixed}
                        onChange={(event) =>
                          toggle(module, "view", event.target.checked)
                        }
                      />
                      <span>{access.view ? "Sí" : "No"}</span>
                    </label>
                  </td>
                  <td>
                    {capability.manage && !adminOnly ? (
                      <label className="permission-switch">
                        <input
                          type="checkbox"
                          checked={access.manage}
                          disabled={loading || saving || !access.view}
                          onChange={(event) =>
                            toggle(module, "manage", event.target.checked)
                          }
                        />
                        <span>{access.manage ? "Sí" : "No"}</span>
                      </label>
                    ) : (
                      <span className="permission-locked">
                        {adminOnly
                          ? "Reservado al Superadmin"
                          : "Solo consulta"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="role-access-preview">
        <div>
          <b>Así quedaría el acceso del Supervisor</b>
          <small>
            {loading
              ? "Cargando permisos…"
              : `${visibleModules.length} módulos visibles · ${manageableModules.length} con registro o propuestas`}
          </small>
        </div>
        <p>
          {visibleModules.length
            ? visibleModules.join(" · ")
            : "No podrá consultar módulos operativos."}
        </p>
      </div>
      <div className="role-permissions-footer">
        <div>
          <b>Acceso completo del Superadmin</b>
          <small>
            El Superadmin conserva acceso a todos los módulos, aprobaciones,
            cuentas, permisos y bitácora. No se limita desde esta pantalla.
          </small>
        </div>
        <Button
          className="violet-button"
          onClick={() => void save()}
          disabled={loading || saving}
        >
          {saving ? "Guardando…" : "Guardar permisos"}
        </Button>
      </div>
      <div
        className="protected-access-list"
        aria-label="Permisos reservados al Superadmin"
      >
        {protectedAccess.map((item) => (
          <span key={item}>
            <ShieldCheck />
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}
