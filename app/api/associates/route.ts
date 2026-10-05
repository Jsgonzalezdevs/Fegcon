import { and, desc, eq, like, or } from "drizzle-orm";
import { requireRole } from "@/lib/access";
import { associateEvents, associates, companies } from "@/db/schema";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: Request) {
  const access = await requireRole(["administrador", "auxiliar", "cartera", "creditos", "consulta"]);
  if ("error" in access) return access.error;
  const search = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const condition = search ? or(like(associates.firstName, "%" + search + "%"), like(associates.lastName, "%" + search + "%"), like(associates.documentNumber, "%" + search + "%")) : undefined;
  const rows = await access.db.select({
    id: associates.id, firstName: associates.firstName, lastName: associates.lastName, documentNumber: associates.documentNumber,
    email: associates.email, phone: associates.phone, status: associates.status, affiliationDate: associates.affiliationDate,
    company: companies.name,
  }).from(associates).leftJoin(companies, eq(associates.companyId, companies.id)).where(condition).orderBy(desc(associates.createdAt)).limit(100);
  return Response.json({ associates: rows });
}

export async function POST(request: Request) {
  const access = await requireRole(["administrador", "auxiliar"]);
  if ("error" in access) return access.error;
  const input = await request.json() as Record<string, unknown>;
  const firstName = clean(input.firstName), lastName = clean(input.lastName), documentNumber = clean(input.documentNumber);
  if (!firstName || !lastName || !documentNumber) return Response.json({ error: "Nombres, apellidos y documento son obligatorios." }, { status: 400 });
  const [associate] = await access.db.insert(associates).values({
    firstName, lastName, documentNumber, documentType: clean(input.documentType) || "CC",
    email: clean(input.email) || null, phone: clean(input.phone) || null, address: clean(input.address) || null,
    jobTitle: clean(input.jobTitle) || null, status: "pendiente",
  }).returning();
  await access.db.insert(associateEvents).values({
    associateId: associate.id, eventType: "registro", title: "Registro creado",
    description: "El asociado fue registrado con estado pendiente.", createdBy: access.user.id,
  });
  return Response.json({ associate }, { status: 201 });
}
