import { test } from "node:test";
import assert from "node:assert/strict";
import { handleDemoRequest } from "../lib/demo/api.ts";
import {
  DEMO_ACTIVE_KEY,
  DEMO_DATA_KEY,
  isDemoActive,
  resetDemo,
  exitDemo,
} from "../lib/demo/session.ts";
import { apiFetch } from "../lib/fegcon-api.ts";

const memoryStorage = () => {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
};
const call = (storage, action, method = "GET", body) =>
  handleDemoRequest(
    `/api/?action=${action}`,
    { method, ...(body ? { body: JSON.stringify(body) } : {}) },
    storage,
  );
const login = (storage) =>
  call(storage, "login", "POST", { email: "demo", password: "demo" });

test("demo / demo opens only a local fictitious session and rejects another password", async () => {
  const storage = memoryStorage();
  assert.equal(
    (await call(storage, "login", "POST", { email: "demo", password: "wrong" }))
      .status,
    401,
  );
  assert.equal(isDemoActive(storage), false);
  const response = await login(storage);
  const body = await response.json();
  assert.equal(body.user.demo, true);
  assert.equal(body.user.role, "superadmin");
  assert.equal(isDemoActive(storage), true);
  assert.ok(!body.user.email.endsWith(".com.co"));
  assert.equal((await (await call(storage, "me")).json()).user.demo, true);
});

test("demo includes usable data across all main modules and never impersonates a real list", async () => {
  const storage = memoryStorage();
  await login(storage);
  for (const [action, key] of [
    ["associates", "associates"],
    ["companies", "companies"],
    ["savings-transactions", "transactions"],
    ["credit-applications", "applications"],
    ["credit-installments", "installments"],
    ["affiliations", "requests"],
    ["payments", "payments"],
    ["receivables", "receivables"],
    ["promissory-notes", "notes"],
    ["payroll-collections", "collections"],
    ["catalog&category=convenio", "items"],
    ["users", "users"],
    ["approval-requests", "requests"],
    ["audit-log", "entries"],
  ]) {
    const response = await call(storage, action);
    assert.equal(response.status, 200, action);
    assert.ok((await response.json())[key].length > 0, action);
  }
  const people = (await (await call(storage, "associates")).json()).associates;
  assert.ok(people.every((p) => p.document_number.startsWith("DEMO-")));
  assert.ok(people.every((p) => p.email.endsWith("@example.com")));
});

test("demo savings change the local balance; an invalid withdrawal preserves stored state", async () => {
  const storage = memoryStorage();
  await login(storage);
  const before = await (
    await call(storage, "savings-balance&associate_id=1")
  ).json();
  assert.equal(
    (
      await call(storage, "savings-transactions", "POST", {
        associate_id: 1,
        product_id: 1,
        movement_type: "aporte",
        amount: 100000,
        reference: "TEST-DEMO",
      })
    ).status,
    201,
  );
  const after = await (
    await call(storage, "savings-balance&associate_id=1")
  ).json();
  assert.equal(after.vista_balance, before.vista_balance + 30000);
  assert.equal(
    after.contributions_balance,
    before.contributions_balance + 70000,
  );
  const saved = storage.getItem(DEMO_DATA_KEY);
  assert.equal(
    (
      await call(storage, "savings-transactions", "POST", {
        associate_id: 1,
        movement_type: "retiro",
        amount: 999999999,
      })
    ).status,
    422,
  );
  assert.equal(storage.getItem(DEMO_DATA_KEY), saved);
});

test("demo payment reduces only the selected person’s quota and disallows an excessive payment", async () => {
  const storage = memoryStorage();
  await login(storage);
  assert.equal(
    (
      await call(storage, "payments", "POST", {
        associate_id: 2,
        credit_installment_id: 1,
        amount: 1000,
      })
    ).status,
    422,
  );
  const rows = await (
    await call(storage, "credit-installments&associate_id=1")
  ).json();
  const quota = rows.installments.find((i) => i.id === 1);
  assert.equal(
    (
      await call(storage, "payments", "POST", {
        associate_id: 1,
        credit_installment_id: 1,
        amount: 10000,
        received_on: "2026-11-05",
        concept: "Demo",
      })
    ).status,
    201,
  );
  const changed = (
    await (await call(storage, "credit-installments&associate_id=1")).json()
  ).installments.find((i) => i.id === 1);
  assert.equal(changed.paid_amount, quota.paid_amount + 10000);
  assert.equal(
    (
      await call(storage, "payments", "POST", {
        associate_id: 1,
        credit_installment_id: 1,
        amount: 999999,
      })
    ).status,
    422,
  );
});

test("demo credit follows supports → approval → disbursement with a real local installment schedule", async () => {
  const storage = memoryStorage();
  await login(storage);
  const created = await (
    await call(storage, "credit-applications", "POST", {
      associate_id: 1,
      product_id: 2,
      amount: 300000,
      term_months: 3,
      credit_channel: "libranza",
      purpose: "Prueba ficticia",
    })
  ).json();
  assert.ok(created.id);
  assert.equal(
    (
      await call(storage, "credit-applications", "PATCH", {
        id: created.id,
        status: "aprobada",
        multiplier: 3,
      })
    ).status,
    422,
  );
  for (const label of [
    "desprendible_1",
    "desprendible_2",
    "certificacion_laboral",
  ]) {
    const body = new FormData();
    body.set("credit_application_id", String(created.id));
    body.set("label", label);
    body.set(
      "file",
      new File(["PRIVATE-CONTENTS-MUST-NOT-PERSIST"], "ejemplo.pdf", {
        type: "application/pdf",
      }),
    );
    assert.equal(
      (
        await handleDemoRequest(
          "/api/?action=credit-documents",
          { method: "POST", body },
          storage,
        )
      ).status,
      201,
    );
  }
  assert.ok(
    !storage
      .getItem(DEMO_DATA_KEY)
      .includes("PRIVATE-CONTENTS-MUST-NOT-PERSIST"),
  );
  assert.equal(
    (
      await call(storage, "credit-applications", "PATCH", {
        id: created.id,
        status: "aprobada",
        multiplier: 3,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call(storage, "credit-applications", "PATCH", {
        id: created.id,
        status: "desembolsada",
        disbursed_on: "2026-11-05",
        first_due_date: "2026-12-05",
      })
    ).status,
    200,
  );
  const installments = (
    await (
      await call(
        storage,
        `credit-installments&credit_application_id=${created.id}`,
      )
    ).json()
  ).installments;
  assert.equal(installments.length, 3);
  assert.ok(
    Math.abs(
      installments.reduce((sum, i) => sum + i.principal_amount, 0) - 300000,
    ) < 0.01,
  );
  assert.equal(
    (
      await call(storage, "credit-applications", "PATCH", {
        id: created.id,
        status: "desembolsada",
        disbursed_on: "2026-11-05",
        first_due_date: "2026-12-05",
      })
    ).status,
    422,
  );
});

test("demo approval applies the change once and affiliate approval creates the associated local record", async () => {
  const storage = memoryStorage();
  await login(storage);
  assert.equal(
    (
      await call(storage, "approval-requests", "PATCH", {
        id: 1,
        decision: "aprobada",
      })
    ).status,
    200,
  );
  const approvals = (await (await call(storage, "approval-requests")).json())
    .requests;
  assert.equal(approvals[0].status, "aprobada");
  const person = (await (await call(storage, "associates&q=DEMO-1002")).json())
    .associates[0];
  assert.equal(person.email, "contacto-nuevo@example.com");
  assert.equal(
    (
      await call(storage, "approval-requests", "PATCH", {
        id: 1,
        decision: "aprobada",
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await call(storage, "affiliations", "PATCH", {
        id: 1,
        status: "aprobada",
      })
    ).status,
    200,
  );
  assert.equal(
    (await (await call(storage, "associates&q=DEMO-2001")).json()).associates
      .length,
    1,
  );
  assert.equal(
    (
      await call(storage, "affiliations", "PATCH", {
        id: 1,
        status: "aprobada",
      })
    ).status,
    422,
  );
});

test("reset and logout touch only demo storage, retaining unrelated real-session settings", async () => {
  const storage = memoryStorage();
  storage.setItem("existing-setting", "keep");
  await login(storage);
  await call(storage, "companies", "POST", { name: "Cambio local" });
  resetDemo(storage);
  assert.equal(isDemoActive(storage), true);
  assert.equal(
    (await (await call(storage, "companies")).json()).companies.length,
    3,
  );
  await call(storage, "logout", "POST");
  assert.equal(isDemoActive(storage), false);
  assert.equal(storage.getItem(DEMO_DATA_KEY), null);
  assert.equal(storage.getItem("existing-setting"), "keep");
  assert.equal(await call(storage, "dashboard"), null);
});

test("active demo has no network fallback, including unsupported routes and after storage is cleared", async (t) => {
  const storage = memoryStorage();
  Object.defineProperty(globalThis, "window", {
    value: { sessionStorage: storage },
    configurable: true,
  });
  t.after(() => {
    exitDemo(storage);
    delete globalThis.window;
  });
  let networkCalls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    networkCalls++;
    return Response.json({ real: true });
  });
  await apiFetch("/api/?action=login", {
    method: "POST",
    body: JSON.stringify({ email: "demo", password: "demo" }),
  });
  assert.equal((await apiFetch("/api/?action=dashboard")).status, 200);
  assert.equal(
    (await apiFetch("/api/?action=not-implemented", { method: "POST" })).status,
    404,
  );
  storage.removeItem(DEMO_ACTIVE_KEY);
  assert.equal((await apiFetch("/api/?action=payments")).status, 200);
  assert.equal(networkCalls, 0);
  await apiFetch("/api/?action=logout", { method: "POST" });
  assert.equal((await (await apiFetch("/api/?action=me")).json()).real, true);
  assert.equal(networkCalls, 1);
});

test("demo document links do not expose real file routes, even for open-in-new-tab", async () => {
  const { privateDocumentHref } = await import("../lib/private-document.ts");
  const storage = memoryStorage();
  const route = "/api/?action=credit-document-file&id=1";
  assert.equal(privateDocumentHref(route, storage), route);
  await login(storage);
  assert.equal(privateDocumentHref(route, storage), "#demo-document");
});
