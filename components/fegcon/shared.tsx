"use client";

import type { PermissionSet, SessionUser } from "@/lib/permissions";
export { readJson } from "@/lib/fegcon-api";
export {
  hasAccess,
  roleLabel,
  type PermissionSet,
  type SessionUser,
} from "@/lib/permissions";

import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Building2,
  ClipboardList,
  CreditCard,
  FileCheck2,
  FileText,
  HandCoins,
  LayoutDashboard,
  ReceiptText,
  Users,
  WalletCards,
} from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";

import { type ModuleView } from "@/components/fegcon/module-guide";

export type View = ModuleView;
export type Associate = {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  document: string;
  company: string;
  email: string;
  phone: string;
  status: "Activo" | "Pendiente" | "Retirado";
  updated: string;
};
export const PermissionContext = createContext<SessionUser["permissions"]>({});
export function useCapability(
  module: string,
  action: "view" | "manage" = "manage",
) {
  const permissions = useContext(PermissionContext);
  return (
    "all" in permissions ||
    Boolean((permissions as PermissionSet)[module]?.[action])
  );
}
export type Nav = { id: View; label: string; icon: LucideIcon };

export type ApiJson = ReturnType<typeof JSON.parse>;
export const money = (v: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(v);
export const nav: { label: string; items: Nav[] }[] = [
  {
    label: "PERSONAS Y EMPRESAS",
    items: [
      { id: "inicio", label: "Vista general", icon: LayoutDashboard },
      { id: "asociados", label: "Asociados", icon: Users },
      { id: "afiliaciones", label: "Afiliaciones", icon: ClipboardList },
      { id: "empresas", label: "Empresas", icon: Building2 },
    ],
  },
  {
    label: "OPERACIÓN DEL FONDO",
    items: [
      { id: "ahorros", label: "Ahorros y aportes", icon: WalletCards },
      { id: "creditos", label: "Créditos", icon: HandCoins },
      { id: "pagares", label: "Pagarés", icon: FileCheck2 },
      { id: "cartera", label: "Cartera", icon: ReceiptText },
      { id: "cobros", label: "Cobros", icon: Banknote },
      { id: "pagos", label: "Pagos", icon: CreditCard },
    ],
  },
  {
    label: "BENEFICIOS E INFORMACIÓN",
    items: [
      { id: "convenios", label: "Convenios", icon: Building2 },
      { id: "reportes", label: "Reportes", icon: FileText },
    ],
  },
];
export const titles: Record<View, string> = {
  inicio: "Inicio",
  asociados: "Asociados",
  afiliaciones: "Afiliaciones",
  empresas: "Empresas",
  ahorros: "Ahorros y aportes",
  creditos: "Créditos",
  pagares: "Pagarés",
  cartera: "Cartera",
  cobros: "Cobros",
  convenios: "Convenios",
  pagos: "Pagos",
  reportes: "Reportes",
  configuracion: "Reglas y solicitudes",
  administracion: "Centro de control",
  aprobaciones: "Aprobaciones",
  mis_solicitudes: "Mis solicitudes",
  perfil: "Ficha del asociado",
};
export const viewModules: Partial<Record<View, string>> = {
  inicio: "inicio",
  asociados: "associates",
  perfil: "associates",
  afiliaciones: "affiliations",
  empresas: "companies",
  ahorros: "savings",
  creditos: "credits",
  pagares: "promissory",
  cartera: "receivables",
  cobros: "payroll",
  convenios: "convenios",
  pagos: "payments",
  reportes: "reports",
  configuracion: "rules",
  mis_solicitudes: "approvals",
  aprobaciones: "approvals",
  administracion: "roles",
};
export function Avatar({
  name,
  large = false,
}: {
  name: string;
  large?: boolean;
}) {
  return (
    <span className={large ? "avatar avatar-lg" : "avatar"}>
      {name
        .split(" ")
        .slice(0, 2)
        .map((s) => s[0])
        .join("")}
    </span>
  );
}
export function Status({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "good" | "warn" | "bad" | "neutral" | "violet";
}) {
  return (
    <span className={`status status-${tone}`}>
      <i />
      {children}
    </span>
  );
}
export function StatusFor({ value }: { value: string }) {
  const normalized = value.toLowerCase().replaceAll("_", " ");
  const labels: Record<string, string> = {
    enviado: "Enviado",
    parcial: "Parcial",
    retirado: "Retirado",
    activo: "Activo",
    vigente: "Vigente",
    pagado: "Pagado",
    aplicada: "Aplicada",
    aplicado: "Aplicado",
    custodiado: "Custodiado",
    pendiente: "Pendiente",
    en_revision: "En revisión",
    "en revision": "En revisión",
    "por vencer": "Por vencer",
    vencida: "Vencida",
    vencido: "Vencido",
    aprobado: "Aprobado",
    aprobada: "Aprobada",
    rechazado: "Rechazado",
    rechazada: "Rechazada",
    desembolsada: "Desembolsada",
    borrador: "Borrador",
    inactivo: "Inactivo",
    anulado: "Anulado",
    anulada: "Anulada",
    recibido: "Recibido",
    conciliado: "Conciliado",
    firmado: "Firmado",
    "pendiente firma": "Pendiente de firma",
  };
  const label = labels[normalized] || value;
  const tone = [
    "activo",
    "vigente",
    "pagado",
    "aplicado",
    "aplicada",
    "custodiado",
    "aprobado",
    "aprobada",
    "desembolsada",
    "firmado",
    "recibido",
    "conciliado",
  ].includes(normalized)
    ? "good"
    : [
          "pendiente",
          "en revision",
          "por vencer",
          "borrador",
          "pendiente firma",
          "parcial",
        ].includes(normalized)
      ? "warn"
      : [
            "anulado",
            "anulada",
            "rechazado",
            "rechazada",
            "vencida",
            "vencido",
            "inactivo",
          ].includes(normalized)
        ? "bad"
        : "neutral";
  return <Status tone={tone}>{label}</Status>;
}
export function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button className="round-button" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}
