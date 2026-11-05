import { test } from "node:test";
import assert from "node:assert/strict";
import { csvContent } from "../lib/csv.ts";
import { apiFetch, readJson } from "../lib/fegcon-api.ts";
import { hasAccess, roleLabel } from "../lib/permissions.ts";

test("CSV preserves Spanish, quoted text, separators and line breaks", () => {
  const csv = csvContent(
    ["Concepto", "Valor"],
    [['Aporte; "quincena"\nNómina', 25000]],
  );
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"Aporte; ""quincena""\nNómina";"25000"'));
});

test("CSV prevents formulas from user-entered references executing in spreadsheets", () => {
  for (const value of [
    '=HYPERLINK("x")',
    "+CMD",
    "-1+2",
    "@SUM(A1)",
    "\t=SUM(A1)",
    " \n+CMD",
  ]) {
    assert.ok(
      csvContent(["Referencia"], [[value]]).includes(
        `"'${value.replaceAll('"', '""')}"`,
      ),
    );
  }
});

test("permissions distinguish viewing, managing, disabled modules, and signed-out users", () => {
  const viewer = {
    id: 1,
    role: "operador",
    role_label: "Supervisor",
    permissions: { payments: { view: true, manage: false } },
  };
  assert.equal(hasAccess(null, "payments"), false);
  assert.equal(hasAccess(viewer, "payments"), true);
  assert.equal(hasAccess(viewer, "payments", "manage"), false);
  assert.equal(hasAccess(viewer, "credits"), false);
  assert.equal(
    hasAccess({ ...viewer, role: "superadmin" }, "credits", "manage"),
    true,
  );
  assert.equal(roleLabel(viewer), "Supervisor");
});

test("API transport preserves CSRF and form payload, and bounds requests", async (t) => {
  let captured;
  t.mock.method(globalThis, "fetch", async (input, init) => {
    captured = { input, init };
    return new Response('{"ok":true}');
  });
  const body = JSON.stringify({ amount: 25000 });
  const response = await apiFetch("/api/?action=payments", {
    method: "POST",
    headers: { "X-CSRF-Token": "unit-test-token" },
    body,
  });
  assert.equal(captured.init.credentials, "same-origin");
  assert.equal(captured.init.headers["X-CSRF-Token"], "unit-test-token");
  assert.equal(captured.init.body, body);
  assert.ok(captured.init.signal instanceof AbortSignal);
  assert.deepEqual(await readJson(response), { ok: true });
});

test("API does not retry an uncertain financial operation automatically", async (t) => {
  let attempts = 0;
  t.mock.method(globalThis, "fetch", async () => {
    attempts++;
    throw new DOMException("timeout", "TimeoutError");
  });
  await assert.rejects(
    apiFetch("/api/?action=payments", { method: "POST" }),
    /historial.*duplicados/,
  );
  assert.equal(attempts, 1);
});

test("non-JSON server errors are readable and do not masquerade as empty data", async () => {
  await assert.rejects(
    readJson(new Response("<html>Hosting unavailable</html>")),
    /respuesta válida/,
  );
});

test("API preserves validation errors from the server", async (t) => {
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response('{"error":"El retiro supera el saldo"}', { status: 422 }),
  );
  const response = await apiFetch("/api/?action=savings-transactions", {
    method: "POST",
  });
  assert.equal(response.status, 422);
  assert.deepEqual(await readJson(response), {
    error: "El retiro supera el saldo",
  });
});

test("Spanish search finds accented names and everyday loan terminology", async () => {
  const { searchText } = await import("../lib/search-text.ts");
  assert.equal(searchText("  José MUÑOZ  "), "jose munoz");
  assert.equal(searchText("Préstamo"), searchText("prestamo"));
});
