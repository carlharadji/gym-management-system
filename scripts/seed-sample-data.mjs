import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(rootDir, "data", "gym.sqlite");

mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON");
initializeDatabase();
seedSampleData();
db.exec("PRAGMA optimize");
db.close();

console.log(`Sample members are ready in ${dbPath}`);

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      member_no TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('REGULAR', 'STUDENT')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memberships (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      membership_type TEXT NOT NULL CHECK (membership_type IN ('DAILY', 'MONTHLY')),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memberships_member_id
    ON memberships(member_id);

    CREATE INDEX IF NOT EXISTS idx_memberships_member_id_end_date
    ON memberships(member_id, end_date, created_at);
  `);
}

function seedSampleData() {
  const members = [
    ["mem-sample-001", "GM-0001", "Alyssa", "Dela Cruz", "alyssa.delacruz@example.com", "STUDENT", "2026-08-30T09:00:00.000Z"],
    ["mem-sample-002", "GM-0002", "Rafael", "Santos", "rafael.santos@example.com", "REGULAR", "2026-09-15T09:00:00.000Z"],
    ["mem-sample-003", "GM-0003", "Mika", "Lopez", "mika.lopez@example.com", "STUDENT", "2026-09-03T09:00:00.000Z"],
    ["mem-sample-004", "GM-0004", "Carlo", "Tan", "carlo.tan@example.com", "REGULAR", "2026-06-01T09:00:00.000Z"],
    ["mem-sample-005", "GM-0005", "Nina", "Reyes", "nina.reyes@example.com", "REGULAR", "2026-09-01T09:00:00.000Z"],
    ["mem-sample-006", "GM-0006", "Jonas", "Garcia", "jonas.garcia@example.com", "STUDENT", "2026-08-19T09:00:00.000Z"],
    ["mem-sample-007", "GM-0007", "Patricia", "Lim", "patricia.lim@example.com", "REGULAR", "2026-08-25T09:00:00.000Z"],
    ["mem-sample-008", "GM-0008", "Miguel", "Ramos", "miguel.ramos@example.com", "STUDENT", "2026-08-31T09:00:00.000Z"],
    ["mem-sample-009", "GM-0009", "Bianca", "Torres", "bianca.torres@example.com", "REGULAR", "2026-09-03T09:00:00.000Z"],
    ["mem-sample-010", "GM-0010", "Enzo", "Navarro", "enzo.navarro@example.com", "REGULAR", "2026-07-01T09:00:00.000Z"],
    ["mem-sample-011", "GM-0011", "Clarisse", "Mendoza", "clarisse.mendoza@example.com", "STUDENT", "2026-08-15T09:00:00.000Z"],
    ["mem-sample-012", "GM-0012", "Darren", "Villanueva", "darren.villanueva@example.com", "REGULAR", "2026-09-04T09:00:00.000Z"]
  ];

  const memberships = [
    ["ship-sample-001", "mem-sample-001", "MONTHLY", "2026-08-30", "2026-09-30", "2026-08-30T09:00:00.000Z"],
    ["ship-sample-002", "mem-sample-002", "MONTHLY", "2026-09-15", "2026-10-15", "2026-09-15T09:00:00.000Z"],
    ["ship-sample-003", "mem-sample-003", "DAILY", "2026-09-03", "2026-09-04", "2026-09-03T09:00:00.000Z"],
    ["ship-sample-004", "mem-sample-004", "MONTHLY", "2026-06-01", "2026-07-01", "2026-06-01T09:00:00.000Z"],
    ["ship-sample-005", "mem-sample-005", "MONTHLY", "2026-09-01", "2026-10-01", "2026-09-01T09:00:00.000Z"],
    ["ship-sample-006", "mem-sample-006", "DAILY", "2026-08-19", "2026-08-20", "2026-08-19T09:00:00.000Z"],
    ["ship-sample-007", "mem-sample-007", "MONTHLY", "2026-08-25", "2026-09-25", "2026-08-25T09:00:00.000Z"],
    ["ship-sample-008", "mem-sample-008", "DAILY", "2026-08-31", "2026-09-01", "2026-08-31T09:00:00.000Z"],
    ["ship-sample-009", "mem-sample-009", "MONTHLY", "2026-09-03", "2026-10-03", "2026-09-03T09:00:00.000Z"],
    ["ship-sample-010", "mem-sample-010", "MONTHLY", "2026-07-01", "2026-08-01", "2026-07-01T09:00:00.000Z"],
    ["ship-sample-011", "mem-sample-011", "MONTHLY", "2026-08-15", "2026-09-15", "2026-08-15T09:00:00.000Z"],
    ["ship-sample-012", "mem-sample-012", "DAILY", "2026-09-04", "2026-09-05", "2026-09-04T09:00:00.000Z"],
    ["ship-sample-012-old", "mem-sample-012", "MONTHLY", "2026-01-10", "2026-02-10", "2026-01-10T09:00:00.000Z"]
  ];

  const insertMember = db.prepare(
    `INSERT OR IGNORE INTO members (
      id,
      member_no,
      first_name,
      last_name,
      email,
      category,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertMembership = db.prepare(
    `INSERT OR IGNORE INTO memberships (
      id,
      member_id,
      membership_type,
      start_date,
      end_date,
      created_at
    )
    SELECT ?, ?, ?, ?, ?, ?
    WHERE EXISTS (
      SELECT 1 FROM members WHERE id = ?
    )`
  );

  db.exec("BEGIN");
  try {
    for (const member of members) {
      insertMember.run(...member, member[6]);
    }

    for (const membership of memberships) {
      insertMembership.run(...membership, membership[1]);
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
