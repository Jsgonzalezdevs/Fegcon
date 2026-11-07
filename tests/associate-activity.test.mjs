import { test } from "node:test";
import assert from "node:assert/strict";
import { handleDemoRequest } from "../lib/demo/api.ts";
const storage = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
  };
};
const call = (s, action, method = "GET", body) =>
  handleDemoRequest(
    `/api/?action=${action}`,
    { method, ...(body ? { body: JSON.stringify(body) } : {}) },
    s,
  );
const login = (s) =>
  call(s, "login", "POST", { email: "demo", password: "demo" });
test("individual charges retain frequency, person and period, and settle only once", async () => {
  const s = storage();
  await login(s);
  for (const [associate_id, frequency, due_date] of [
    [1, "quincenal", "2026-11-15"],
    [2, "mensual", "2026-11-30"],
  ]) {
    assert.equal(
      (
        await call(s, "associate-charges", "POST", {
          associate_id,
          frequency,
          due_date,
          description: "Aporte",
          amount: 25000,
        })
      ).status,
      201,
    );
  }
  const entries = (
    await (await call(s, "associate-charges&associate_id=1")).json()
  ).entries;
  assert.equal(entries.length, 1);
  assert.equal(entries[0].frequency, "quincenal");
  assert.equal(entries[0].due_date, "2026-11-15");
  assert.equal(
    (
      await call(s, "associate-charges", "PATCH", {
        id: entries[0].id,
        status: "pagado",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call(s, "associate-charges", "PATCH", {
        id: entries[0].id,
        status: "anulado",
      })
    ).status,
    422,
  );
  const invalid = {
    associate_id: 1,
    frequency: "semanal",
    due_date: "2026-11-15",
    description: "Aporte",
    amount: 1,
  };
  assert.equal(
    (await call(s, "associate-charges", "POST", invalid)).status,
    422,
  );
  assert.equal(
    (
      await call(s, "associate-charges", "POST", {
        ...invalid,
        frequency: "mensual",
        due_date: "2026-02-30",
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await call(s, "associate-charges", "POST", {
        ...invalid,
        frequency: "mensual",
        amount: -1,
      })
    ).status,
    422,
  );
});
test("agreement, purchase and benefit usage is scoped per person, including free benefits", async () => {
  const s = storage();
  await login(s);
  const catalog = (await (await call(s, "catalog&category=convenio")).json())
    .items;
  for (const entry_type of ["convenio", "compra", "beneficio"]) {
    assert.equal(
      (
        await call(s, "associate-benefits", "POST", {
          associate_id: 1,
          entry_type,
          catalog_id: entry_type === "convenio" ? catalog[0].id : "",
          used_on: "2026-11-07",
          description: "Uso de prueba",
          amount: 0,
        })
      ).status,
      201,
    );
  }
  assert.equal(
    (await (await call(s, "associate-benefits&associate_id=1")).json()).entries
      .length,
    3,
  );
  assert.equal(
    (await (await call(s, "associate-benefits&associate_id=2")).json()).entries
      .length,
    0,
  );
  const invalid = {
    associate_id: 1,
    entry_type: "convenio",
    catalog_id: 999999,
    used_on: "2026-11-07",
    description: "Prueba",
    amount: 1,
  };
  assert.equal(
    (await call(s, "associate-benefits", "POST", invalid)).status,
    422,
  );
  assert.equal(
    (
      await call(s, "associate-benefits", "POST", {
        ...invalid,
        catalog_id: "",
      })
    ).status,
    422,
  );
});
test("credit payment and priority updates preserve its decision and financial terms", async () => {
  const s = storage();
  await login(s);
  const before = (await (await call(s, "credit-applications")).json())
    .applications[0];
  assert.equal(
    (
      await call(s, "credit-applications", "PATCH", {
        id: before.id,
        operation: "terms",
        payment_method: "transferencia",
        priority: "alta",
      })
    ).status,
    200,
  );
  const after = (
    await (await call(s, "credit-applications")).json()
  ).applications.find((r) => r.id === before.id);
  assert.equal(after.payment_method, "transferencia");
  assert.equal(after.priority, "alta");
  for (const key of [
    "status",
    "requested_amount",
    "requested_term_months",
    "monthly_installment",
  ])
    assert.equal(after[key], before[key]);
  assert.equal(
    (
      await call(s, "credit-applications", "PATCH", {
        id: before.id,
        operation: "terms",
        payment_method: "invalido",
        priority: "alta",
      })
    ).status,
    422,
  );
});
