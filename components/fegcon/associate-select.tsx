"use client";

import { apiFetch, readJson } from "@/lib/fegcon-api";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const resultsId = useId();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [focused, setFocused] = useState(false);
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
      setEditing(false);
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
  const currentPerson = options.find((person) => String(person.id) === currentValue) ?? selected;
  const personLabel = (person: PersonOption) => `${person.first_name} ${person.last_name} · ${person.document_number}`;
  const visibleOptions = results === null ? [] : options;
  const choose = (person: PersonOption) => {
    setLocalValue(String(person.id));
    setSelected(person);
    setQuery("");
    setEditing(false);
    setFocused(false);
    inputRef.current?.setCustomValidity("");
    const select = selectRef.current;
    if (select) {
      select.value = String(person.id);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };
  const clear = () => {
    setLocalValue("");
    setSelected(null);
    setQuery("");
    setEditing(true);
    const select = selectRef.current;
    if (select) {
      select.value = "";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    inputRef.current?.focus();
  };
  return (
    <span className="associate-picker" ref={root}>
      <span className="associate-picker-control">
        <input
          ref={inputRef}
          type="search"
          required={!currentValue}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={focused && editing && query.trim().length >= 2}
          aria-controls={resultsId}
          aria-label="Buscar asociado por nombre o documento"
          placeholder="Escribe un nombre o número de documento…"
          value={currentPerson && !editing ? personLabel(currentPerson) : query}
          onFocus={() => {
            setFocused(true);
            if (currentValue) inputRef.current?.select();
          }}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          onChange={(event) => {
            setEditing(true);
            setSelected(null);
            setQuery(event.target.value);
            setResults(null);
            setLoading(event.target.value.trim().length >= 2);
            event.currentTarget.setCustomValidity(
              event.target.value ? "Selecciona un asociado de los resultados." : "",
            );
            if (currentValue && selectRef.current) {
              selectRef.current.value = "";
              selectRef.current.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }}
        />
        {currentPerson && !editing && (
          <button type="button" className="associate-picker-clear" onClick={clear} aria-label="Cambiar asociado">Cambiar</button>
        )}
        {focused && editing && query.trim().length >= 2 && (
          <span id={resultsId} className="associate-picker-results" role="listbox" aria-label="Resultados de asociados">
            {loading ? <small role="status">Buscando asociados…</small> : error ? <small role="status">{error}</small> : visibleOptions.length ? visibleOptions.map((person) => (
              <button type="button" role="option" aria-selected={String(person.id) === currentValue} key={person.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(person)}>
                <b>{person.first_name} {person.last_name}</b><small>{person.document_number}</small>
              </button>
            )) : <small role="status">No encontramos a esa persona. Revisa el nombre o documento.</small>}
          </span>
        )}
      </span>
      <select ref={selectRef} className="associate-picker-value" name={name} aria-label="Asociado seleccionado" value={currentValue} onChange={(event) => {
        setLocalValue(event.target.value);
        const person = options.find((person) => String(person.id) === event.target.value);
        setSelected(person ?? null);
        setEditing(false);
        if (person) onSelect?.(person);
        onChange?.(event);
      }} tabIndex={-1} aria-hidden="true">
        <option value=""></option>
        {options.map((person) => <option key={person.id} value={person.id}>{personLabel(person)}</option>)}
      </select>
      <small role="status">
        {loading ? "Buscando en el directorio…" : error || (currentPerson && !editing
          ? "Asociado seleccionado. Sus datos se usarán en este registro."
          : query.trim().length === 1 ? "Escribe al menos dos caracteres para buscar."
          : query.trim().length >= 2 && results !== null && !options.length ? "No encontramos coincidencias. Revisa el documento o prueba otro nombre."
          : "Escribe al menos dos caracteres para buscar un asociado.")}
      </small>
    </span>
  );
}
