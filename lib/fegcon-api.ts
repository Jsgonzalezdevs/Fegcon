/** Same-origin transport for the existing cPanel PHP/MySQL API. */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input, {
      credentials: "same-origin",
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(20000),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error;
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error(
        "El servidor tardó demasiado en responder. Consulta el historial antes de reenviar una operación para evitar duplicados.",
      );
    }
    throw new Error(
      "No pudimos conectar con FEGCON. Revisa la conexión e inténtalo de nuevo.",
    );
  }
}

export async function readJson<T = ReturnType<typeof JSON.parse>>(
  response: Response,
): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(
      "El servidor no devolvió una respuesta válida. Inténtalo de nuevo; si continúa, solicita revisar la instalación de FEGCON.",
    );
  }
}
