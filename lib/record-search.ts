// Search only the fields displayed by the module; ignore accents and casing.
export function matchesRecord(search: string, values: unknown[]) {
  const normalize = (value: unknown) => String(value ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replaceAll("_", " ").toLocaleLowerCase("es");
  return normalize(values.join(" ")).includes(normalize(search).trim());
}
