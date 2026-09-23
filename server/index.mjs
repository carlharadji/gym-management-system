import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(rootDir, "data");
const dbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(dataDir, "gym.sqlite");
const distDir = path.join(rootDir, "dist");
const port = Number(process.env.PORT ?? 3001);
const instanceToken = process.env.INSTANCE_TOKEN ?? null;
const maxRequestBodyBytes = 64 * 1024;
const allowedOrigins = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  ...String(process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
]);

mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA foreign_keys = ON");

initializeDatabase();

const server = createServer(async (request, response) => {
  setCorsHeaders(request, response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (requestUrl.pathname.startsWith("/api")) {
      await handleApiRequest(request, response, requestUrl);
      return;
    }

    serveStaticFile(response, requestUrl.pathname);
  } catch (error) {
    if (error instanceof ApiError) {
      sendJson(response, error.status, { error: error.message });
      return;
    }

    console.error(error);
    sendJson(response, 500, { error: "Something went wrong while processing the request." });
  }
});

server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  const listeningPort = typeof address === "object" && address ? address.port : port;
  console.log(`Gym management server running at http://127.0.0.1:${listeningPort}`);
});

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

  db.exec("PRAGMA optimize");
}

async function handleApiRequest(request, response, requestUrl) {
  if (request.method === "GET" && requestUrl.pathname === "/api/health") {
    sendJson(response, 200, { service: "gym-management-api", instanceToken });
    return;
  }

  if (request.method === "GET" && requestUrl.pathname === "/api/members") {
    sendJson(response, 200, getSnapshot());
    return;
  }

  if (request.method === "POST" && requestUrl.pathname === "/api/members") {
    const body = await readJson(request);
    const result = createMember(body);
    sendJson(response, 201, result);
    return;
  }

  const memberMatch = requestUrl.pathname.match(/^\/api\/members\/([^/]+)$/);
  if (request.method === "PUT" && memberMatch) {
    const body = await readJson(request);
    const member = updateMember(decodeURIComponent(memberMatch[1]), body);
    sendJson(response, 200, member);
    return;
  }

  if (request.method === "DELETE" && memberMatch) {
    deleteMember(decodeURIComponent(memberMatch[1]));
    sendJson(response, 200, { ok: true });
    return;
  }

  const membershipMatch = requestUrl.pathname.match(/^\/api\/members\/([^/]+)\/memberships$/);
  if (request.method === "POST" && membershipMatch) {
    const body = await readJson(request);
    const membership = createMembership(decodeURIComponent(membershipMatch[1]), body);
    sendJson(response, 201, membership);
    return;
  }

  sendJson(response, 404, { error: "API route not found." });
}

function getSnapshot() {
  return {
    members: getMembers(),
    memberships: getMemberships()
  };
}

function getMembers() {
  return db
    .prepare(
      `SELECT
        id,
        member_no AS memberNo,
        first_name AS firstName,
        last_name AS lastName,
        email,
        category
      FROM members
      ORDER BY member_no COLLATE NOCASE ASC`
    )
    .all();
}

function getMemberships() {
  return db
    .prepare(
      `SELECT
        id,
        member_id AS memberId,
        membership_type AS membershipType,
        start_date AS startDate,
        end_date AS endDate,
        created_at AS createdAt
      FROM memberships
      ORDER BY created_at DESC`
    )
    .all();
}

function getMember(memberId) {
  return db
    .prepare(
      `SELECT
        id,
        member_no AS memberNo,
        first_name AS firstName,
        last_name AS lastName,
        email,
        category
      FROM members
      WHERE id = ?`
    )
    .get(memberId);
}

function createMember(body) {
  const memberNo = requireMemberNo(body.memberNo);
  const firstName = requireText(body.firstName, "First name");
  const lastName = requireText(body.lastName, "Last name");
  const email = optionalText(body.email, "Email");
  const category = requireCategory(body.category);
  const membershipType = requireMembershipType(body.membershipType);
  const startDate = requireDate(body.startDate, "Membership start date");
  const endDate = calculateMembershipEndDate(startDate, membershipType);
  const now = new Date().toISOString();
  const memberId = makeId("mem");
  const membershipId = makeId("ship");

  try {
    const insertMember = db.prepare(
      `INSERT INTO members (
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
      `INSERT INTO memberships (
        id,
        member_id,
        membership_type,
        start_date,
        end_date,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?)`
    );

    db.exec("BEGIN");
    insertMember.run(memberId, memberNo, firstName, lastName, email, category, now, now);
    insertMembership.run(membershipId, memberId, membershipType, startDate, endDate, now);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    handleDatabaseError(error);
  }

  return {
    member: getMember(memberId),
    membership: getMembership(membershipId)
  };
}

function updateMember(memberId, body) {
  if (!getMember(memberId)) {
    throw new ApiError(404, "Member not found.");
  }

  const memberNo = requireMemberNo(body.memberNo);
  const firstName = requireText(body.firstName, "First name");
  const lastName = requireText(body.lastName, "Last name");
  const email = optionalText(body.email, "Email");
  const category = requireCategory(body.category);
  const now = new Date().toISOString();

  try {
    db.prepare(
      `UPDATE members
      SET member_no = ?,
        first_name = ?,
        last_name = ?,
        email = ?,
        category = ?,
        updated_at = ?
      WHERE id = ?`
    ).run(memberNo, firstName, lastName, email, category, now, memberId);
  } catch (error) {
    handleDatabaseError(error);
  }

  return getMember(memberId);
}

function deleteMember(memberId) {
  if (!getMember(memberId)) {
    throw new ApiError(404, "Member not found.");
  }

  db.prepare("DELETE FROM members WHERE id = ?").run(memberId);
}

function createMembership(memberId, body) {
  if (!getMember(memberId)) {
    throw new ApiError(404, "Member not found.");
  }

  const membershipType = requireMembershipType(body.membershipType);
  const startDate = requireDate(body.startDate, "Membership start date");
  const endDate = calculateMembershipEndDate(startDate, membershipType);
  const now = new Date().toISOString();
  const membershipId = makeId("ship");

  db.prepare(
    `INSERT INTO memberships (
      id,
      member_id,
      membership_type,
      start_date,
      end_date,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(membershipId, memberId, membershipType, startDate, endDate, now);

  return getMembership(membershipId);
}

function getMembership(membershipId) {
  return db
    .prepare(
      `SELECT
        id,
        member_id AS memberId,
        membership_type AS membershipType,
        start_date AS startDate,
        end_date AS endDate,
        created_at AS createdAt
      FROM memberships
      WHERE id = ?`
    )
    .get(membershipId);
}

function requireText(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ApiError(400, `${fieldName} is required.`);
  }

  return value.trim();
}

function optionalText(value, fieldName) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new ApiError(400, `${fieldName} must be text.`);
  return value.trim();
}

function requireMemberNo(value) {
  const memberNo = requireText(value, "Member no.");
  if (!/^GM-\d{4}$/.test(memberNo)) throw new ApiError(400, "Member no. must use GM- followed by four digits.");
  return memberNo;
}

function requireCategory(value) {
  if (value !== "REGULAR" && value !== "STUDENT") {
    throw new ApiError(400, "Discount type must be Regular or Student.");
  }

  return value;
}

function requireMembershipType(value) {
  if (value !== "DAILY" && value !== "MONTHLY") {
    throw new ApiError(400, "Membership type must be Daily or Monthly.");
  }

  return value;
}

function requireDate(value, fieldName) {
  const date = requireText(value, fieldName);
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? parseDateKey(date) : null;

  if (!parsedDate || Number.isNaN(parsedDate.getTime()) || dateKeyFromDate(parsedDate) !== date) {
    throw new ApiError(400, `${fieldName} must be a valid date.`);
  }

  return date;
}

function calculateMembershipEndDate(startDate, membershipType) {
  const start = parseDateKey(startDate);

  if (membershipType === "DAILY") {
    start.setDate(start.getDate() + 1);
    return dateKeyFromDate(start);
  }

  const target = new Date(start);
  const originalDay = target.getDate();
  target.setDate(1);
  target.setMonth(target.getMonth() + 1);
  const lastDayOfTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  return dateKeyFromDate(target);
}

function parseDateKey(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dateKeyFromDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function makeId(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function handleDatabaseError(error) {
  if (String(error?.message ?? "").includes("UNIQUE constraint failed: members.member_no")) {
    throw new ApiError(409, "Member no. already exists.");
  }

  throw error;
}

async function readJson(request) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > maxRequestBodyBytes) {
      throw new ApiError(413, "Request body is too large.");
    }
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "Request body must be valid JSON.");
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function setCorsHeaders(request, response) {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function serveStaticFile(response, pathname) {
  if (!existsSync(distDir)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Frontend build not found. Run pnpm build first, or use pnpm dev while developing.");
    return;
  }

  const requestedPath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  let filePath = path.resolve(distDir, requestedPath);
  const relativePath = path.relative(distDir, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = path.join(distDir, "index.html");
  }

  response.writeHead(200, { "Content-Type": getContentType(filePath) });
  createReadStream(filePath).pipe(response);
}

function getContentType(filePath) {
  const extension = path.extname(filePath);

  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";

  return "application/octet-stream";
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
