"use client";

import { apiFetch, readJson } from "@/lib/fegcon-api";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

type PersonOption = {
  id: number;
  first_name: string;
  last_name: string;
  document_number: string;
  status?: string;
  company_id?: number;
};

/** Keeps native select validation while searching the database beyond the initial 100 records. */
export function AssociateSelect({
  initialOptions,
  value,
  onChange,
  onSelect,
  name,
  activeOnly = false,
  companyId,
}: {
  initialOptions: PersonOption[];
  value?: string;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
  onSelect?: (person: PersonOption) => void;
  name?: string;
  activeOnly?: boolean;
  companyId?: number;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonOption[] | null>(null);
  const [selected, setSelected] = useState<PersonOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [localValue, setLocalValue] = useState("");
  const currentValue = value ?? localValue;
  useEffect(() => {
    const form = root.current?.closest("form");
    const reset = () => {
      setLocalValue("");
      setSelected(null);
      setQuery("");
      setResults(null);
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, []);
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await apiFetch(
          `/api/?action=associates&q=${encodeURIComponent(query.trim())}`,
          {
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(20000),
            ]),
          },
        );
        const data = await readJson(response);
        if (!response.ok)
          throw new Error(data.error || "No fue posible buscar asociados.");
        if (!controller.signal.aborted) setResults(data.associates || []);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setResults([]);
          setError(
            cause instanceof Error
              ? cause.message
              : "No fue posible buscar asociados.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  const options = (results ?? initialOptions).filter(
    (person) =>
      (!activeOnly || person.status === "activo") &&
      (!companyId || Number(person.company_id) === companyId),
  );
  if (
    selected &&
    String(selected.id) === currentValue &&
    !options.some((person) => person.id === selected.id)
  )
    options.unshift(selected);
  return (
    <span className="associate-picker" ref={root}>
      <input
        type="search"
        aria-label="Buscar asociado por nombre o documento"
        placeholder="Busca por nombre o documento…"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setResults(null);
          setLoading(event.target.value.trim().length >= 2);
        }}
      />
      <select
        name={name}
        aria-label="Seleccionar asociado"
        value={currentValue}
        required
        onChange={(event) => {
          setLocalValue(event.target.value);
          const person = options.find(
            (person) => String(person.id) === event.target.value,
          );
          setSelected(person ?? null);
          if (person) onSelect?.(person);
          onChange?.(event);
        }}
      >
        <option value="">Selecciona un asociado</option>
        {options.map((person) => (
          <option key={person.id} value={person.id}>
            {person.first_name} {person.last_name} · {person.document_number}
          </option>
        ))}
      </select>
      <small role="status">
        {loading
          ? "Buscando en el directorio…"
          : error ||
            (results && !options.length
              ? "No hay coincidencias. Prueba con el documento o con otro nombre."
              : query.trim().length === 1
                ? "Escribe al menos dos caracteres para buscar."
                : "Busca y selecciona la persona por su nombre y documento.")}
      </small>
    </span>
  );
}
