"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowUpRight,
  Banknote,
  Building2,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileText,
  HandCoins,
  ReceiptText,
  Search,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import type { ModuleView } from "./module-guide";

const tasks = [
  {
    view: "asociados",
    module: "associates",
    icon: Users,
    label: "Consultar o registrar un asociado",
    detail: "Datos personales, ficha e historial",
    keywords: "persona documento buscar crear editar retirar",
  },
  {
    view: "afiliaciones",
    module: "affiliations",
    icon: ClipboardList,
    label: "Revisar una afiliación",
    detail: "Solicitudes para ingresar al fondo",
    keywords: "vincular ingreso aprobar nuevo",
  },
  {
    view: "ahorros",
    module: "savings",
    icon: WalletCards,
    label: "Registrar un aporte o retiro",
    detail: "Movimientos y saldos del asociado",
    keywords: "ahorro dinero saldo",
  },
  {
    view: "creditos",
    module: "credits",
    icon: HandCoins,
    label: "Gestionar una solicitud de crédito",
    detail: "Modalidad, soportes y plan de cuotas",
    keywords: "prestamo préstamo libranza desembolso",
  },
  {
    view: "pagos",
    module: "payments",
    icon: CreditCard,
    label: "Registrar un pago recibido",
    detail: "Recaudos y referencias de pago",
    keywords: "abono consignación transferencia dinero",
  },
  {
    view: "cartera",
    module: "receivables",
    icon: ReceiptText,
    label: "Revisar cuotas y vencimientos",
    detail: "Obligaciones pendientes y mora",
    keywords: "cartera deuda vencida cobrar",
  },
  {
    view: "cobros",
    module: "payroll",
    icon: Banknote,
    label: "Preparar un cobro de nómina",
    detail: "Relaciones de cobro por empresa",
    keywords: "libranza nomina nómina descuento",
  },
  {
    view: "pagares",
    module: "promissory",
    icon: FileCheck2,
    label: "Consultar o custodiar un pagaré",
    detail: "Firmas y documentos de respaldo",
    keywords: "pagare pagaré archivo soporte",
  },
  {
    view: "empresas",
    module: "companies",
    icon: Building2,
    label: "Actualizar una empresa",
    detail: "Identificación y contacto para libranza",
    keywords: "crear registrar nit",
  },
  {
    view: "convenios",
    module: "convenios",
    icon: Building2,
    label: "Consultar un convenio",
    detail: "Beneficios registrados por el fondo",
    keywords: "proveedor beneficio",
  },
  {
    view: "reportes",
    module: "reports",
    icon: FileText,
    label: "Consultar reportes",
    detail: "Información por área del fondo",
    keywords: "informe exportar descargar",
  },
  {
    view: "administracion",
    module: "roles",
    icon: ShieldCheck,
    label: "Administrar el fondo y los accesos",
    detail: "Usuarios, permisos, solicitudes y bitácora",
    keywords: "configurar aprobar contraseña usuario",
  },
] as const;
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function TaskFinder({
  go,
  canAccess,
}: {
  go: (view: ModuleView) => void;
  canAccess: (module: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const allowed = tasks.filter((task) => canAccess(task.module));
  const results = allowed.filter((task) =>
    normalize(`${task.label} ${task.detail} ${task.keywords}`).includes(
      normalize(query.trim()),
    ),
  );
  return (
    <>
      <button
        className="task-finder-trigger"
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
      >
        <Search size={17} />
        <span>¿Qué necesitas hacer?</span>
        <ArrowUpRight size={15} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="task-finder-dialog">
          <DialogHeader>
            <DialogTitle>¿Qué necesitas hacer?</DialogTitle>
            <DialogDescription>
              Escribe una tarea o elige una opción para abrir su módulo.
            </DialogDescription>
          </DialogHeader>
          <label className="task-search">
            <Search size={19} />
            <input
              autoFocus
              aria-label="Buscar una tarea"
              placeholder="Por ejemplo: pago, aporte, préstamo…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="task-results">
            {results.map(({ view, icon: Icon, label, detail }) => (
              <button
                key={view}
                onClick={() => {
                  setOpen(false);
                  go(view);
                }}
              >
                <span>
                  <Icon size={20} />
                </span>
                <div>
                  <b>{label}</b>
                  <small>{detail}</small>
                </div>
                <ArrowUpRight size={16} />
              </button>
            ))}
            {!results.length && (
              <p className="task-no-results">
                No encontramos una tarea con ese texto entre tus accesos. Prueba
                con «asociado», «pago» o «crédito».
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
