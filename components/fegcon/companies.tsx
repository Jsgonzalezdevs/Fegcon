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
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Heading } from "@/components/fegcon/associates";
import {
  ApiJson,
  readJson,
  useCapability,
  View,
} from "@/components/fegcon/shared";

export function CompaniesPanel({
  csrf,
  role,
  go,
}: {
  csrf: string;
  role: string;
  go: (view: View) => void;
}) {
  const canManage = useCapability("companies");
  const [companies, setCompanies] = useState<ApiJson[]>([]),
    [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/api/?action=companies", {
        credentials: "same-origin",
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(data.error || "No fue posible consultar las empresas.");
      setCompanies(data.companies || []);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible consultar las empresas.",
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
    if (saving) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await apiFetch("/api/?action=companies", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({
          name: values.get("name"),
          tax_id: values.get("tax_id"),
          contact_name: values.get("contact_name"),
          contact_email: values.get("contact_email"),
        }),
      });
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(data.error || "No fue posible guardar la empresa.");
      form.reset();
      if (data.pending_approval) {
        setNotice(data.message || "La empresa quedó pendiente de aprobación.");
        go("mis_solicitudes");
        return;
      }
      setNotice("Empresa registrada para los cobros de nómina.");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No fue posible guardar la empresa.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="page">
      <Heading
        eyebrow="NÓMINA"
        title="Empresas"
        text="Registra las empresas que realizan descuentos de libranza y prepara sus relaciones de cobro de los días 10 y 20."
      />
      <section className="data-panel">
        <div className="table-tools">
          <div>
            <b>Empresas de libranza</b>
            <small>Contactos y datos que usarás en los cobros de nómina.</small>
          </div>
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
          >
            Actualizar
          </Button>
          <small>{companies.length} activas</small>
        </div>
        {error && (
          <div className="px-6 pt-4">
            <div
              className="auth-error flex items-center justify-between gap-3"
              role="alert"
            >
              <span>{error}</span>
              <Button
                variant="outline"
                onClick={() => void load()}
                disabled={loading}
              >
                Reintentar
              </Button>
            </div>
          </div>
        )}
        {notice && (
          <p className="px-6 pt-3" role="status">
            {notice}
          </p>
        )}
        {canManage ? (
          <form
            className="p-6 grid gap-3 border-b md:grid-cols-2"
            onSubmit={submit}
          >
            <label>
              Nombre de la empresa
              <Input
                name="name"
                maxLength={190}
                autoComplete="organization"
                required
                disabled={saving}
              />
            </label>
            <label>
              NIT
              <Input
                name="tax_id"
                maxLength={50}
                inputMode="numeric"
                disabled={saving}
              />
            </label>
            <label>
              Nombre de contacto
              <Input
                name="contact_name"
                maxLength={160}
                autoComplete="name"
                disabled={saving}
              />
            </label>
            <label>
              Correo de contacto
              <Input
                name="contact_email"
                type="email"
                maxLength={190}
                autoComplete="email"
                disabled={saving}
              />
            </label>
            <div className="md:col-span-2">
              <Button className="violet-button" type="submit" disabled={saving}>
                {saving
                  ? "Guardando…"
                  : role === "operador"
                    ? "Solicitar registro"
                    : "Registrar empresa"}
              </Button>
              {role === "operador" && (
                <small className="ml-3">
                  La empresa quedará disponible cuando se complete la revisión.
                </small>
              )}
            </div>
          </form>
        ) : (
          <div className="empty-state role-read-only-note">
            <b>Modo de consulta</b>
            <small>
              Este perfil puede consultar las empresas, pero no tiene habilitada
              su gestión.
            </small>
          </div>
        )}
        {loading ? (
          <div className="empty-state">Consultando empresas…</div>
        ) : error ? (
          <div className="empty-state">
            <b>No se pudieron consultar las empresas</b>
            <small>{error}</small>
            <Button variant="outline" onClick={() => void load()}>
              Reintentar
            </Button>
          </div>
        ) : companies.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>NIT</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Correo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-semibold">
                    {company.name}
                  </TableCell>
                  <TableCell>{company.tax_id || "—"}</TableCell>
                  <TableCell>{company.contact_name || "—"}</TableCell>
                  <TableCell>{company.contact_email || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="empty-state">
            <b>Aún no hay empresas de libranza</b>
            <small>
              Registra una empresa para tenerla disponible en los cobros de
              nómina.
            </small>
          </div>
        )}
      </section>
    </div>
  );
}
