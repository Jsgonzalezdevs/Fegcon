CREATE TABLE internal_users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('administrador','afiliaciones','creditos','cartera','tesoreria','consulta') NOT NULL DEFAULT 'consulta',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE companies (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL UNIQUE,
  tax_id VARCHAR(50) NULL UNIQUE,
  contact_name VARCHAR(160) NULL,
  contact_email VARCHAR(190) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE associates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  document_type VARCHAR(10) NOT NULL DEFAULT 'CC',
  document_number VARCHAR(50) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(50) NULL,
  address VARCHAR(255) NULL,
  company_id INT UNSIGNED NULL,
  job_title VARCHAR(150) NULL,
  employment_start_date DATE NULL,
  affiliation_date DATE NULL,
  status ENUM('activo','retirado','suspendido','pendiente') NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY associates_status_company_idx (status, company_id),
  CONSTRAINT associates_company_fk FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE associate_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  associate_id INT UNSIGNED NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  title VARCHAR(190) NOT NULL,
  description TEXT NULL,
  occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT UNSIGNED NULL,
  KEY associate_events_associate_date_idx (associate_id, occurred_at),
  CONSTRAINT associate_events_associate_fk FOREIGN KEY (associate_id) REFERENCES associates(id) ON DELETE CASCADE,
  CONSTRAINT associate_events_user_fk FOREIGN KEY (created_by) REFERENCES internal_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  entity VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(80) NOT NULL,
  detail VARCHAR(255) NOT NULL DEFAULT '',
  ip_address VARCHAR(45) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY audit_log_entity_idx (entity, entity_id),
  CONSTRAINT audit_log_user_fk FOREIGN KEY (user_id) REFERENCES internal_users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
