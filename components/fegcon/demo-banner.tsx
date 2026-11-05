"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resetDemo } from "@/lib/demo/session";
import { FlaskConical, RotateCcw, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function DemoBanner() {
  const banner = useRef<HTMLElement>(null);
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
          <span>Datos ficticios · cambios solo en esta pestaña</span>
        </div>
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
          No cargues documentos reales. Para salir, usa «Cerrar sesión» en tu
          cuenta.
        </small>
      </section>
      <Dialog open={fileOpen} onOpenChange={setFileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Soporte de demostración</DialogTitle>
            <DialogDescription>
              Este expediente contiene referencias ficticias. No hay documentos
              de personas reales. Al simular una carga solo se guarda el nombre
              del archivo en esta pestaña; su contenido no se envía al servidor
              ni se conserva.
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
