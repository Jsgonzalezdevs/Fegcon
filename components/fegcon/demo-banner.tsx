"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEMO_DATA_KEY, demoStorage, resetDemo } from "@/lib/demo/session";
import { Download, FlaskConical, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function DemoBanner() {
  const banner = useRef<HTMLElement>(null);
  const backupFile = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const element = banner.current;
    if (!element) return;
    const update = () =>
      element.parentElement?.style.setProperty(
        "--demo-banner-height",
        `${element.getBoundingClientRect().height}px`,
      );
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, []);
  const [fileOpen, setFileOpen] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const exportBackup = () => {
    const raw = demoStorage()?.getItem(DEMO_DATA_KEY);
    if (!raw) { setBackupMessage("Aún no hay datos para respaldar."); return; }
    const blob = new Blob([raw], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `respaldo-fegcon-demo-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    setBackupMessage("Respaldo descargado en este dispositivo.");
  };
  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const value = JSON.parse(await file.text());
      const arrays = ["companies", "associates", "transactions", "applications", "installments", "affiliations", "payments", "receivables", "notes", "documents", "collections", "items", "catalog", "users", "approvals", "audit"];
      if (value?.version !== 1 || arrays.some((key) => !Array.isArray(value[key])) || typeof value.settings !== "object" || typeof value.rules !== "object")
        throw new Error("El archivo no es un respaldo FEGCON válido.");
      if (!window.confirm("Restaurar este respaldo reemplazará los datos actuales de la demo en este navegador. ¿Continuar?")) return;
      demoStorage()?.setItem(DEMO_DATA_KEY, JSON.stringify(value));
      window.location.reload();
    } catch (error) {
      setBackupMessage(error instanceof Error ? error.message : "No se pudo leer el respaldo.");
    } finally {
      if (backupFile.current) backupFile.current.value = "";
    }
  };
  useEffect(() => {
    const intercept = (event: MouseEvent) => {
      const link = (event.target as Element)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!link) return;
      const url = new URL(link.href, window.location.href);
      if (
        url.hash === "#demo-document" ||
        (url.pathname.startsWith("/api") &&
          ["credit-document-file", "promissory-document-file"].includes(
            url.searchParams.get("action") ?? "",
          ))
      ) {
        event.preventDefault();
        event.stopPropagation();
        setFileOpen(true);
      }
    };
    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, []);
  return (
    <>
      <section
        className="demo-banner"
        ref={banner}
        aria-label="Entorno de demostración"
      >
        <div className="demo-banner-label">
          <FlaskConical size={17} />
          <b>Estás en la demo</b>
          <span>Datos ficticios · guardados en este navegador</span>
        </div>
        <button type="button" onClick={exportBackup}><Download size={14} /> Descargar respaldo</button>
        <button type="button" onClick={() => backupFile.current?.click()}><Upload size={14} /> Restaurar respaldo</button>
        <input ref={backupFile} type="file" accept="application/json,.json" hidden onChange={(event) => void importBackup(event.target.files?.[0])} />
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "¿Restablecer los datos de ejemplo? Se borrarán únicamente los cambios que hiciste en la demo.",
              )
            ) {
              resetDemo();
              window.location.reload();
            }
          }}
        >
          <RotateCcw size={14} />
          Restablecer demo
        </button>
        <small>
          Los cambios se conservan en este navegador incluso al cerrar sesión. Descarga un respaldo para moverlos o guardarlos en otro lugar. No cargues documentos reales; los archivos solo se simulan.
        </small>
        {backupMessage && <small role="status">{backupMessage}</small>}
      </section>
      <Dialog open={fileOpen} onOpenChange={setFileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Soporte de demostración</DialogTitle>
            <DialogDescription>
              Este expediente contiene referencias ficticias. Al simular una carga solo se guarda el nombre del archivo; su contenido no se envía al servidor ni se conserva.
            </DialogDescription>
          </DialogHeader>
          <div className="demo-document-note">
            <ShieldCheck size={22} />
            <p>
              En el sistema real, aquí se abre el soporte privado después de
              verificar la sesión y los permisos.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
