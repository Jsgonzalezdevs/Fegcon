import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);

export const internalUsers = sqliteTable("internal_users", {
  id: integer("id").primaryKey({ autoIncrement: true }), authUserId: text("auth_user_id").notNull(), email: text("email").notNull(), fullName: text("full_name").notNull(),
  role: text("role", { enum: ["administrador", "auxiliar", "cartera", "creditos", "consulta"] }).notNull().default("consulta"), active: integer("active", { mode: "boolean" }).notNull().default(true), createdAt,
}, (t) => [uniqueIndex("internal_users_auth_uidx").on(t.authUserId)]);

export const companies = sqliteTable("companies", {
  id: integer("id").primaryKey({ autoIncrement: true }), name: text("name").notNull(), taxId: text("tax_id"), contactName: text("contact_name"), contactEmail: text("contact_email"), active: integer("active", { mode: "boolean" }).notNull().default(true), createdAt,
}, (t) => [uniqueIndex("companies_tax_id_uidx").on(t.taxId)]);

export const associates = sqliteTable("associates", {
  id: integer("id").primaryKey({ autoIncrement: true }), documentType: text("document_type").notNull().default("CC"), documentNumber: text("document_number").notNull(), firstName: text("first_name").notNull(), lastName: text("last_name").notNull(), email: text("email"), phone: text("phone"), address: text("address"), companyId: integer("company_id").references(() => companies.id), jobTitle: text("job_title"), employmentStartDate: text("employment_start_date"), affiliationDate: text("affiliation_date"), status: text("status", { enum: ["activo", "retirado", "suspendido", "pendiente"] }).notNull().default("pendiente"), createdAt, updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [uniqueIndex("associates_document_uidx").on(t.documentNumber), index("associates_status_company_idx").on(t.status, t.companyId)]);

export const beneficiaries = sqliteTable("beneficiaries", {
  id: integer("id").primaryKey({ autoIncrement: true }), associateId: integer("associate_id").notNull().references(() => associates.id, { onDelete: "cascade" }), fullName: text("full_name").notNull(), relationship: text("relationship").notNull(), documentNumber: text("document_number"), phone: text("phone"), createdAt,
}, (t) => [index("beneficiaries_associate_idx").on(t.associateId)]);

export const affiliations = sqliteTable("affiliations", {
  id: integer("id").primaryKey({ autoIncrement: true }), associateId: integer("associate_id").references(() => associates.id), status: text("status", { enum: ["pendiente", "en_revision", "aprobada", "rechazada", "incompleta"] }).notNull().default("pendiente"), admissionFee: real("admission_fee").notNull().default(0), mandatorySavings: real("mandatory_savings").notNull().default(0), plannedSavings: real("planned_savings").notNull().default(0), notes: text("notes"), submittedAt: text("submitted_at").notNull().default(sql`CURRENT_TIMESTAMP`), reviewedAt: text("reviewed_at"), reviewedBy: integer("reviewed_by").references(() => internalUsers.id),
}, (t) => [index("affiliations_status_idx").on(t.status)]);

export const savingsAccounts = sqliteTable("savings_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }), associateId: integer("associate_id").notNull().references(() => associates.id, { onDelete: "cascade" }), type: text("type", { enum: ["obligatorio", "programado", "aporte"] }).notNull(), balance: real("balance").notNull().default(0), active: integer("active", { mode: "boolean" }).notNull().default(true), openedAt: text("opened_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [index("savings_accounts_associate_idx").on(t.associateId, t.type)]);

export const savingsMovements = sqliteTable("savings_movements", {
  id: integer("id").primaryKey({ autoIncrement: true }), accountId: integer("account_id").notNull().references(() => savingsAccounts.id, { onDelete: "cascade" }), movementType: text("movement_type", { enum: ["aporte", "retiro", "ajuste"] }).notNull(), amount: real("amount").notNull(), description: text("description").notNull(), occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`), createdBy: integer("created_by").references(() => internalUsers.id),
}, (t) => [index("savings_movements_account_date_idx").on(t.accountId, t.occurredAt)]);

export const creditApplications = sqliteTable("credit_applications", {
  id: integer("id").primaryKey({ autoIncrement: true }), associateId: integer("associate_id").notNull().references(() => associates.id), creditType: text("credit_type").notNull(), requestedAmount: real("requested_amount").notNull(), interestRate: real("interest_rate").notNull(), termMonths: integer("term_months").notNull(), repaymentFrequency: text("repayment_frequency", { enum: ["quincenal", "mensual"] }).notNull(), status: text("status", { enum: ["solicitado", "en_estudio", "aprobado", "rechazado", "desembolsado", "cancelado"] }).notNull().default("solicitado"), observations: text("observations"), createdAt, decidedAt: text("decided_at"),
}, (t) => [index("credit_applications_status_idx").on(t.status, t.associateId)]);

export const credits = sqliteTable("credits", {
  id: integer("id").primaryKey({ autoIncrement: true }), applicationId: integer("application_id").references(() => creditApplications.id), associateId: integer("associate_id").notNull().references(() => associates.id), creditType: text("credit_type").notNull(), disbursedAmount: real("disbursed_amount").notNull(), interestRate: real("interest_rate").notNull(), termInstallments: integer("term_installments").notNull(), paymentFrequency: text("payment_frequency", { enum: ["quincenal", "mensual"] }).notNull(), disbursementDate: text("disbursement_date"), outstandingBalance: real("outstanding_balance").notNull(), status: text("status", { enum: ["vigente", "en_mora", "pagado", "cancelado"] }).notNull().default("vigente"), observations: text("observations"), createdAt,
}, (t) => [index("credits_status_idx").on(t.status, t.associateId)]);

export const cosigners = sqliteTable("cosigners", {
  id: integer("id").primaryKey({ autoIncrement: true }), creditId: integer("credit_id").notNull().references(() => credits.id, { onDelete: "cascade" }), documentNumber: text("document_number").notNull(), fullName: text("full_name").notNull(), company: text("company"), jobTitle: text("job_title"), phone: text("phone"), email: text("email"), createdAt,
}, (t) => [index("cosigners_credit_idx").on(t.creditId)]);

export const promissoryNotes = sqliteTable("promissory_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }), creditId: integer("credit_id").notNull().references(() => credits.id, { onDelete: "cascade" }), noteNumber: text("note_number").notNull(), issuedDate: text("issued_date").notNull(), value: real("value").notNull(), status: text("status", { enum: ["pendiente", "firmado", "custodiado", "anulado"] }).notNull().default("pendiente"), fileKey: text("file_key"), createdAt,
}, (t) => [uniqueIndex("promissory_notes_number_uidx").on(t.noteNumber)]);

export const installments = sqliteTable("installments", {
  id: integer("id").primaryKey({ autoIncrement: true }), creditId: integer("credit_id").notNull().references(() => credits.id, { onDelete: "cascade" }), installmentNumber: integer("installment_number").notNull(), dueDate: text("due_date").notNull(), amount: real("amount").notNull(), principal: real("principal").notNull(), interest: real("interest").notNull(), outstandingBalance: real("outstanding_balance").notNull(), status: text("status", { enum: ["pendiente", "parcial", "pagada", "vencida"] }).notNull().default("pendiente"), lateDays: integer("late_days").notNull().default(0),
}, (t) => [index("installments_credit_status_due_idx").on(t.creditId, t.status, t.dueDate)]);

export const collectionRuns = sqliteTable("collection_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }), companyId: integer("company_id").references(() => companies.id), period: text("period").notNull(), frequency: text("frequency", { enum: ["quincenal", "mensual"] }).notNull(), status: text("status", { enum: ["borrador", "generado", "enviado", "recibido", "pagado_parcial", "pagado", "rechazado", "aclaracion"] }).notNull().default("borrador"), sentAt: text("sent_at"), receivedAt: text("received_at"), createdAt,
}, (t) => [index("collection_runs_company_period_idx").on(t.companyId, t.period)]);

export const collectionItems = sqliteTable("collection_items", {
  id: integer("id").primaryKey({ autoIncrement: true }), collectionRunId: integer("collection_run_id").notNull().references(() => collectionRuns.id, { onDelete: "cascade" }), associateId: integer("associate_id").notNull().references(() => associates.id), concept: text("concept").notNull(), amount: real("amount").notNull(), status: text("status", { enum: ["pendiente", "pagado", "parcial", "rechazado", "aclaracion"] }).notNull().default("pendiente"),
}, (t) => [index("collection_items_run_associate_idx").on(t.collectionRunId, t.associateId)]);

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }), associateId: integer("associate_id").notNull().references(() => associates.id), creditId: integer("credit_id").references(() => credits.id), installmentId: integer("installment_id").references(() => installments.id), collectionItemId: integer("collection_item_id").references(() => collectionItems.id), amount: real("amount").notNull(), method: text("method", { enum: ["nomina", "transferencia", "efectivo", "otro"] }).notNull(), paymentDate: text("payment_date").notNull(), reference: text("reference"), createdAt,
}, (t) => [index("payments_associate_date_idx").on(t.associateId, t.paymentDate)]);

export const agreements = sqliteTable("agreements", {
  id: integer("id").primaryKey({ autoIncrement: true }), providerName: text("provider_name").notNull(), providerTaxId: text("provider_tax_id"), benefitType: text("benefit_type").notNull(), conditions: text("conditions"), discountPercent: real("discount_percent"), validFrom: text("valid_from"), validUntil: text("valid_until"), status: text("status", { enum: ["vigente", "por_vencer", "vencido", "suspendido"] }).notNull().default("vigente"), createdAt,
}, (t) => [index("agreements_status_idx").on(t.status)]);

export const agreementUses = sqliteTable("agreement_uses", {
  id: integer("id").primaryKey({ autoIncrement: true }), agreementId: integer("agreement_id").notNull().references(() => agreements.id), associateId: integer("associate_id").notNull().references(() => associates.id), usedAt: text("used_at").notNull().default(sql`CURRENT_TIMESTAMP`), notes: text("notes"),
}, (t) => [index("agreement_uses_agreement_associate_idx").on(t.agreementId, t.associateId)]);

export const documents = sqliteTable("documents", {
  id: integer("id").primaryKey({ autoIncrement: true }), associateId: integer("associate_id").references(() => associates.id), creditId: integer("credit_id").references(() => credits.id), kind: text("kind").notNull(), fileName: text("file_name").notNull(), fileKey: text("file_key").notNull(), contentType: text("content_type"), uploadedBy: integer("uploaded_by").references(() => internalUsers.id), createdAt,
}, (t) => [index("documents_associate_credit_idx").on(t.associateId, t.creditId)]);

export const associateEvents = sqliteTable("associate_events", {
  id: integer("id").primaryKey({ autoIncrement: true }), associateId: integer("associate_id").notNull().references(() => associates.id, { onDelete: "cascade" }), eventType: text("event_type").notNull(), title: text("title").notNull(), description: text("description"), occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`), createdBy: integer("created_by").references(() => internalUsers.id),
}, (t) => [index("associate_events_associate_date_idx").on(t.associateId, t.occurredAt)]);
