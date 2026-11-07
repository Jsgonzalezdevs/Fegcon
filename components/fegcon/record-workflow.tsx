"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateRecordButton({ id, open, onOpen, children }: {
  id: string; open: boolean; onOpen: () => void; children: ReactNode;
}) {
  return <Button type="button" className="violet-button" aria-expanded={open}
    aria-controls={id} onClick={onOpen} disabled={open}>
    <Plus aria-hidden="true" />{children}
  </Button>;
}

export function RecordFormPanel({ id, title, description, busy, onClose, children }: {
  id: string; title: string; description: string; busy: boolean;
  onClose: () => void; children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  function close() {
    onClose();
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`button[aria-controls="${id}"]`)?.focus();
    });
  }
  return <section id={id} className="data-panel record-form-panel" aria-labelledby={`${id}-title`}>
    <div className="record-form-heading">
      <div><p>NUEVO REGISTRO</p><h2 ref={heading} tabIndex={-1} id={`${id}-title`}>{title}</h2><small>{description}</small></div>
      <Button type="button" variant="outline" onClick={close} disabled={busy}><X aria-hidden="true" />Cancelar</Button>
    </div>
    {children}
  </section>;
}

export function RecordFilters({ search, onSearch, status, onStatus, statuses, count }: {
  search: string; onSearch: (value: string) => void; status: string;
  onStatus: (value: string) => void; statuses: string[]; count: number;
}) {
  return <div className="record-filters">
    <label className="record-search"><Search aria-hidden="true" /><span className="sr-only">Buscar registros</span>
      <Input type="search" placeholder="Buscar por asociado, referencia o estado…" value={search} onChange={event => onSearch(event.target.value)} />
    </label>
    <label className="record-status"><span>Estado</span><select value={status} onChange={event => onStatus(event.target.value)}>
      <option value="">Todos los estados</option>{statuses.map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
    </select></label>
    <small aria-live="polite">{count} resultado{count === 1 ? "" : "s"}</small>
  </div>;
}
