"use client";

import { AssociateSelect } from "./associate-select";

import { apiFetch } from "@/lib/fegcon-api";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

import { FirstActionPanel, Heading } from "@/components/fegcon/associates";
import {
  ApiJson,
  money,
  readJson,
  StatusFor,
  useCapability,
  View,
} from "@/components/fegcon/shared";

export function PromissoryNotesScreen({
  csrf,
  role,
  go,
}: {
  csrf: string;
  role: string;
  go: (view: View) => void;
}) {
  const canManage = useCapability("promissory");
  const [notes, setNotes] = useState<ApiJson[]>([]);
  const [credits, setCredits] = useState<ApiJson[]>([]);
  const [associates, setAssociates] = useState<ApiJson[]>([]);
  const [associateId, setAssociateId] = useState("");
  const [selectedNote, setSelectedNote] = useState<ApiJson | null>(null);
  const [documents, setDocuments] = useState<ApiJson[]>([]);
  const [notice, setNotice] = useState("");
  const [documentNotice, setDocumentNotice] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [noteResponse, creditResponse, associateResponse] =
        await Promise.all([
          apiFetch("/api/?action=promissory-notes", {
            credentials: "same-origin",
          }),
          apiFetch("/api/?action=credit-applications", {
            credentials: "same-origin",
          }),
          apiFetch("/api/?action=associates", { credentials: "same-origin" }),
        ]);
      if (!noteResponse.ok || !creditResponse.ok || !associateResponse.ok)
        throw new Error("No fue posible consultar los registros.");
      const [noteData, creditData, associateData] = await Promise.all([
        readJson(noteResponse),
        readJson(creditResponse),
        readJson(associateResponse),
      ]);
      setNotes(noteData.notes || []);
      setCredits(
        (creditData.applications || []).filter((credit: ApiJson) =>
          ["aprobada", "desembolsada"].includes(credit.status),
        ),
      );
      setAssociates(
        (associateData.associates || []).filter(
          (associate: ApiJson) => associate.status === "activo",
        ),
      );
    } catch {
      setLoadError(
        "No pudimos consultar los pagarés ni los créditos aprobados.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);
  const availableCredits = credits.filter(
    (credit) => String(credit.associate_id) === associateId,
  );
  const openDocuments = async (note: ApiJson) => {
    setSelectedNote(note);
    setDocuments([]);
    setDocumentNotice("");
    try {
      const response = await apiFetch(
        "/api/?action=promissory-documents&note_id=" + note.id,
        { credentials: "same-origin" },
      );
      const data = await readJson(response);
      if (!response.ok)
        throw new Error(data.error || "No fue posible cargar los documentos.");
      setDocuments(data.documents || []);
    } catch (error) {
      setDocumentNotice(
        error instanceof Error
          ? error.message
          : "No fue posible cargar los documentos.",
      );
    }
  };
  const createNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    try {
      const response = await apiFetch("/api/?action=promissory-notes", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
        body: JSON.stringify({
          associate_id: Number(associateId),
          credit_application_id: Number(form.get("credit")),
          note_number: form.get("number"),
          notes: form.get("notes"),
        }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setNotice(data.error || "No fue posible registrar el pagaré.");
        return;
      }
      if (data.pending_approval) {
        go("mis_solicitudes");
        return;
      }
      setNotice("Pagaré registrado para el crédito aprobado.");
      formElement.reset();
      setAssociateId("");
      await load();
    } catch {
      setNotice("No se pudo conectar con el servidor.");
    } finally {
      setBusy(false);
    }
  };
  const uploadDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedNote || busy) return;
    const formElement = event.currentTarget;
    const body = new FormData(formElement);
    body.set("note_id", String(selectedNote.id));
    setBusy(true);
    try {
      const response = await apiFetch("/api/?action=promissory-documents", {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-CSRF-Token": csrf },
        body,
      });
      const data = await readJson(response);
      if (!response.ok) {
        setDocumentNotice(data.error || "No fue posible guardar el archivo.");
        return;
      }
      if (data.pending_approval) {
        setSelectedNote(null);
        go("mis_solicitudes");
        return;
      }
      setDocumentNotice(data.message || "Documento guardado.");
      formElement.reset();
      await openDocuments(selectedNote);
      await load();
    } catch {
      setDocumentNotice("No se pudo conectar con el servidor.");
    } finally {
      setBusy(false);
    }
  };
  const retireDocument = async (document: ApiJson) => {
    if (
      !window.confirm(
        '¿Retirar "' +
          document.label +
          '"? El archivo seguirá bajo custodia privada.',
      )
    )
      return;
    setBusy(true);
    try {
      const response = await apiFetch(
        "/api/?action=promissory-documents&id=" + document.id,
        {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "X-CSRF-Token": csrf },
        },
      );
      const data = await readJson(response);
      if (!response.ok) {
        setDocumentNotice(data.error || "No fue posible retirar el documento.");
        return;
      }
      if (data.pending_approval) {
        setSelectedNote(null);
        go("mis_solicitudes");
        return;
      }
      setDocumentNotice(data.message || "Documento retirado.");
      await openDocuments(selectedNote);
      await load();
    } catch {
      setDocumentNotice("No se pudo conectar con el servidor.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page">
      <Heading
        eyebrow="TESORERÍA"
        title="Pagarés"
        text="Cada pagaré se vincula a un crédito aprobado. Sus archivos se guardan en una carpeta privada, fuera del sitio público."
      />
      <section className="data-panel">
        {!canManage ? (
          <div className="empty-state role-read-only-note">
            <b>Vista de consulta</b>
            <small>
              Este perfil puede consultar pagarés y documentos autorizados.
            </small>
          </div>
        ) : !associates.length || !credits.length ? (
          <FirstActionPanel
            title={
              associates.length
                ? "Necesitas un crédito aprobado"
                : "Registra primero un asociado activo"
            }
            detail={
              associates.length
                ? "Cuando el crédito esté aprobado, podrás registrar su pagaré y guardar los documentos bajo custodia."
                : "El pagaré se vincula al asociado y a su crédito aprobado. Después podrás guardar sus documentos bajo custodia."
            }
            action={associates.length ? "Ir a créditos" : "Ir a asociados"}
            onAction={() => go(associates.length ? "creditos" : "asociados")}
            loading={loading}
            error={loadError}
            onRetry={() => void load()}
          />
        ) : (
          <form className="p-6 grid gap-3 md:grid-cols-2" onSubmit={createNote}>
            <label>
              Asociado
              <AssociateSelect
                initialOptions={associates}
                value={associateId}
                onChange={(event) => setAssociateId(event.target.value)}
                activeOnly
              />
            </label>
            <label>
              Crédito aprobado
              <select
                name="credit"
                required
                className="w-full rounded-md border p-2"
                disabled={!availableCredits.length}
              >
                <option value="">Selecciona un crédito</option>
                {availableCredits.map((credit) => (
                  <option key={credit.id} value={credit.id}>
                    #{credit.id} · {money(Number(credit.requested_amount))}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Número de pagaré
              <Input name="number" required />
            </label>
            <label>
              Observaciones
              <Input name="notes" maxLength={255} />
            </label>
            <div className="md:col-span-2">
              <Button
                type="submit"
                className="violet-button"
                disabled={busy || !availableCredits.length}
              >
                {busy
                  ? "Guardando…"
                  : role === "operador"
                    ? "Enviar para revisión"
                    : "Registrar pagaré"}
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
          <div>
            <b>Registro de pagarés</b>
            <small>
              Los escaneos solo se descargan después de iniciar sesión.
            </small>
          </div>
          <Button
            variant="outline"
            onClick={() => void load()}
            disabled={loading}
          >
            Actualizar
          </Button>
          <small>{notes.length} registros</small>
        </div>
        {loading ? (
          <div className="empty-state">Consultando pagarés…</div>
        ) : loadError ? (
          <div className="empty-state">
            <b>No se pudieron cargar los pagarés</b>
            <small>{loadError}</small>
            <Button variant="outline" onClick={() => void load()}>
              Reintentar
            </Button>
          </div>
        ) : notes.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Asociado</TableHead>
                <TableHead>Crédito</TableHead>
                <TableHead>Documentos</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.map((note) => (
                <TableRow key={note.id}>
                  <TableCell>{note.note_number}</TableCell>
                  <TableCell>
                    {note.first_name} {note.last_name}
                  </TableCell>
                  <TableCell>#{note.credit_application_id}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      onClick={() => void openDocuments(note)}
                    >
                      Ver documentos ({note.document_count || 0})
                    </Button>
                  </TableCell>
                  <TableCell>
                    <StatusFor value={note.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="empty-state">
            <b>Aún no hay pagarés</b>
            <small>
              Al aprobar el primer crédito, el pagaré aparecerá aquí para
              seguimiento.
            </small>
          </div>
        )}
      </section>
      <Dialog
        open={Boolean(selectedNote)}
        onOpenChange={(open) => {
          if (!open && !busy) setSelectedNote(null);
        }}
      >
        <DialogContent className="associate-dialog sm:max-w-2xl">
          <DialogHeader>
            <p className="dialog-eyebrow">CUSTODIA PRIVADA</p>
            <DialogTitle>
              Documentos del pagaré {selectedNote?.note_number}
            </DialogTitle>
            <DialogDescription>
              {role === "operador"
                ? "Los archivos quedarán pendientes de revisión antes de pasar a custodia."
                : "Los archivos se almacenan fuera de la carpeta pública del sitio."}
            </DialogDescription>
          </DialogHeader>
          {canManage && (
            <form className="grid gap-3" onSubmit={uploadDocument}>
              <label>
                Nombre del documento
                <Input name="label" maxLength={120} required />
              </label>
              <label>
                Archivo PDF, JPG o PNG · máximo 15 MB
                <Input
                  name="file"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  required
                />
              </label>
              <Button type="submit" className="violet-button" disabled={busy}>
                {busy
                  ? "Guardando…"
                  : role === "operador"
                    ? "Enviar documento"
                    : "Guardar en custodia"}
              </Button>
            </form>
          )}
          {documentNotice && <p role="status">{documentNotice}</p>}
          <div className="approval-list">
            {documents.length ? (
              documents.map((document) => (
                <article className="approval-item" key={document.id}>
                  <div className="approval-main">
                    <b>{document.label}</b>
                    <small>
                      {document.original_name} ·{" "}
                      {(Number(document.byte_size) / 1024 / 1024).toFixed(2)} MB
                    </small>
                    <div className="mt-2">
                      <StatusFor value={document.status} />
                    </div>
                  </div>
                  <div className="approval-actions">
                    {(role === "superadmin" ||
                      document.status === "custodiado") && (
                      <a
                        className="text-button"
                        href={
                          "/api/?action=promissory-document-file&id=" +
                          document.id
                        }
                      >
                        Descargar
                      </a>
                    )}
                    {canManage && document.status === "custodiado" && (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void retireDocument(document)}
                      >
                        {role === "operador" ? "Solicitar retiro" : "Retirar"}
                      </Button>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                <b>No hay archivos adjuntos</b>
                <small>Los documentos autorizados aparecerán aquí.</small>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
