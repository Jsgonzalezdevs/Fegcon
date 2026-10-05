CREATE TABLE `affiliations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`associate_id` integer,
	`status` text DEFAULT 'pendiente' NOT NULL,
	`admission_fee` real DEFAULT 0 NOT NULL,
	`mandatory_savings` real DEFAULT 0 NOT NULL,
	`planned_savings` real DEFAULT 0 NOT NULL,
	`notes` text,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text,
	`reviewed_by` integer,
	FOREIGN KEY (`associate_id`) REFERENCES `associates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewed_by`) REFERENCES `internal_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `affiliations_status_idx` ON `affiliations` (`status`);--> statement-breakpoint
CREATE TABLE `agreement_uses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`agreement_id` integer NOT NULL,
	`associate_id` integer NOT NULL,
	`used_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`notes` text,
	FOREIGN KEY (`agreement_id`) REFERENCES `agreements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`associate_id`) REFERENCES `associates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `agreement_uses_agreement_associate_idx` ON `agreement_uses` (`agreement_id`,`associate_id`);--> statement-breakpoint
CREATE TABLE `agreements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider_name` text NOT NULL,
	`provider_tax_id` text,
	`benefit_type` text NOT NULL,
	`conditions` text,
	`discount_percent` real,
	`valid_from` text,
	`valid_until` text,
	`status` text DEFAULT 'vigente' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agreements_status_idx` ON `agreements` (`status`);--> statement-breakpoint
CREATE TABLE `associate_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`associate_id` integer NOT NULL,
	`event_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` integer,
	FOREIGN KEY (`associate_id`) REFERENCES `associates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `internal_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `associate_events_associate_date_idx` ON `associate_events` (`associate_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `associates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_type` text DEFAULT 'CC' NOT NULL,
	`document_number` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text,
	`phone` text,
	`address` text,
	`company_id` integer,
	`job_title` text,
	`employment_start_date` text,
	`affiliation_date` text,
	`status` text DEFAULT 'pendiente' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `associates_document_uidx` ON `associates` (`document_number`);--> statement-breakpoint
CREATE INDEX `associates_status_company_idx` ON `associates` (`status`,`company_id`);--> statement-breakpoint
CREATE TABLE `beneficiaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`associate_id` integer NOT NULL,
	`full_name` text NOT NULL,
	`relationship` text NOT NULL,
	`document_number` text,
	`phone` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`associate_id`) REFERENCES `associates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `beneficiaries_associate_idx` ON `beneficiaries` (`associate_id`);--> statement-breakpoint
CREATE TABLE `collection_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`collection_run_id` integer NOT NULL,
	`associate_id` integer NOT NULL,
	`concept` text NOT NULL,
	`amount` real NOT NULL,
	`status` text DEFAULT 'pendiente' NOT NULL,
	FOREIGN KEY (`collection_run_id`) REFERENCES `collection_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`associate_id`) REFERENCES `associates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `collection_items_run_associate_idx` ON `collection_items` (`collection_run_id`,`associate_id`);--> statement-breakpoint
CREATE TABLE `collection_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer,
	`period` text NOT NULL,
	`frequency` text NOT NULL,
	`status` text DEFAULT 'borrador' NOT NULL,
	`sent_at` text,
	`received_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `collection_runs_company_period_idx` ON `collection_runs` (`company_id`,`period`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`tax_id` text,
	`contact_name` text,
	`contact_email` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_tax_id_uidx` ON `companies` (`tax_id`);--> statement-breakpoint
CREATE TABLE `cosigners` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`credit_id` integer NOT NULL,
	`document_number` text NOT NULL,
	`full_name` text NOT NULL,
	`company` text,
	`job_title` text,
	`phone` text,
	`email` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`credit_id`) REFERENCES `credits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cosigners_credit_idx` ON `cosigners` (`credit_id`);--> statement-breakpoint
CREATE TABLE `credit_applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`associate_id` integer NOT NULL,
	`credit_type` text NOT NULL,
	`requested_amount` real NOT NULL,
	`interest_rate` real NOT NULL,
	`term_months` integer NOT NULL,
	`repayment_frequency` text NOT NULL,
	`status` text DEFAULT 'solicitado' NOT NULL,
	`observations` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`decided_at` text,
	FOREIGN KEY (`associate_id`) REFERENCES `associates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `credit_applications_status_idx` ON `credit_applications` (`status`,`associate_id`);--> statement-breakpoint
CREATE TABLE `credits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`application_id` integer,
	`associate_id` integer NOT NULL,
	`credit_type` text NOT NULL,
	`disbursed_amount` real NOT NULL,
	`interest_rate` real NOT NULL,
	`term_installments` integer NOT NULL,
	`payment_frequency` text NOT NULL,
	`disbursement_date` text,
	`outstanding_balance` real NOT NULL,
	`status` text DEFAULT 'vigente' NOT NULL,
	`observations` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `credit_applications`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`associate_id`) REFERENCES `associates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `credits_status_idx` ON `credits` (`status`,`associate_id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`associate_id` integer,
	`credit_id` integer,
	`kind` text NOT NULL,
	`file_name` text NOT NULL,
	`file_key` text NOT NULL,
	`content_type` text,
	`uploaded_by` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`associate_id`) REFERENCES `associates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credit_id`) REFERENCES `credits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by`) REFERENCES `internal_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `documents_associate_credit_idx` ON `documents` (`associate_id`,`credit_id`);--> statement-breakpoint
CREATE TABLE `installments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`credit_id` integer NOT NULL,
	`installment_number` integer NOT NULL,
	`due_date` text NOT NULL,
	`amount` real NOT NULL,
	`principal` real NOT NULL,
	`interest` real NOT NULL,
	`outstanding_balance` real NOT NULL,
	`status` text DEFAULT 'pendiente' NOT NULL,
	`late_days` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`credit_id`) REFERENCES `credits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `installments_credit_status_due_idx` ON `installments` (`credit_id`,`status`,`due_date`);--> statement-breakpoint
CREATE TABLE `internal_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`auth_user_id` text NOT NULL,
	`email` text NOT NULL,
	`full_name` text NOT NULL,
	`role` text DEFAULT 'consulta' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `internal_users_auth_uidx` ON `internal_users` (`auth_user_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`associate_id` integer NOT NULL,
	`credit_id` integer,
	`installment_id` integer,
	`collection_item_id` integer,
	`amount` real NOT NULL,
	`method` text NOT NULL,
	`payment_date` text NOT NULL,
	`reference` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`associate_id`) REFERENCES `associates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`credit_id`) REFERENCES `credits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`installment_id`) REFERENCES `installments`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`collection_item_id`) REFERENCES `collection_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payments_associate_date_idx` ON `payments` (`associate_id`,`payment_date`);--> statement-breakpoint
CREATE TABLE `promissory_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`credit_id` integer NOT NULL,
	`note_number` text NOT NULL,
	`issued_date` text NOT NULL,
	`value` real NOT NULL,
	`status` text DEFAULT 'pendiente' NOT NULL,
	`file_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`credit_id`) REFERENCES `credits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `promissory_notes_number_uidx` ON `promissory_notes` (`note_number`);--> statement-breakpoint
CREATE TABLE `savings_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`associate_id` integer NOT NULL,
	`type` text NOT NULL,
	`balance` real DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`opened_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`associate_id`) REFERENCES `associates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `savings_accounts_associate_idx` ON `savings_accounts` (`associate_id`,`type`);--> statement-breakpoint
CREATE TABLE `savings_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`movement_type` text NOT NULL,
	`amount` real NOT NULL,
	`description` text NOT NULL,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` integer,
	FOREIGN KEY (`account_id`) REFERENCES `savings_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `internal_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `savings_movements_account_date_idx` ON `savings_movements` (`account_id`,`occurred_at`);