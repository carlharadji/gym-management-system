import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const dbPath = path.join(tmpdir(), `gym-api-test-${randomUUID()}.sqlite`);
const instanceToken = randomUUID();
const server = spawn(process.execPath, ["server/index.mjs"], {
  env: { ...process.env, PORT: "0", DB_PATH: dbPath, INSTANCE_TOKEN: instanceToken, OPENAI_API_KEY: "" },
  stdio: ["ignore", "pipe", "pipe"]
});

server.stderr.on("data", (chunk) => process.stderr.write(chunk));

try {
  const port = await getStartedServerPort();
  const request = createRequester(port);
  const health = await request("/api/health");

  assert(health.service === "gym-management-api", "smoke test should reach the gym API");
  assert(health.instanceToken === instanceToken, "smoke test should reach the server instance it started");

  const allowedCorsResponse = await fetch(`http://127.0.0.1:${port}/api/health`, {
    headers: { Origin: "http://127.0.0.1:5173" }
  });
  const blockedCorsResponse = await fetch(`http://127.0.0.1:${port}/api/health`, {
    headers: { Origin: "https://untrusted.example" }
  });
  const blockedStaticResponse = await fetch(`http://127.0.0.1:${port}/..%2Fpackage.json`);

  assert(
    allowedCorsResponse.headers.get("access-control-allow-origin") === "http://127.0.0.1:5173",
    "configured local development origin should be allowed"
  );
  assert(
    blockedCorsResponse.headers.get("access-control-allow-origin") === null,
    "untrusted browser origins should not receive CORS access"
  );
  assert(blockedStaticResponse.status === 403, "static file requests must remain inside the build directory");

  const initial = await request("/api/members");
  await expectFailure(() => request("/api/members", {
    method: "POST",
    body: {
      memberNo: "GM-0001",
      firstName: "Invalid",
      lastName: "Date",
      email: "",
      category: "REGULAR",
      membershipType: "MONTHLY",
      startDate: "2026-02-30"
    }
  }), "Membership start date must be a valid date.");
  await expectFailure(() => request("/api/members", {
    method: "POST",
    body: { padding: "x".repeat(65 * 1024) }
  }), "Request body is too large.");
  await expectFailure(() => request("/api/members", {
    method: "POST",
    body: {
      memberNo: "GM-12",
      firstName: "Invalid",
      lastName: "Number",
      email: "",
      category: "REGULAR",
      membershipType: "MONTHLY",
      startDate: "2026-09-03"
    }
  }), "Member no. must use GM- followed by four digits.");
  const created = await request("/api/members", {
    method: "POST",
    body: {
      memberNo: "GM-0010",
      firstName: "Test",
      lastName: "Member",
      email: "test.member@example.com",
      category: "STUDENT",
      membershipType: "DAILY",
      startDate: "2026-09-03"
    }
  });
  const second = await request("/api/members", {
    method: "POST",
    body: {
      memberNo: "GM-0002",
      firstName: "Second",
      lastName: "Member",
      email: "",
      category: "REGULAR",
      membershipType: "MONTHLY",
      startDate: "2026-09-03"
    }
  });
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const visiting = await request("/api/members", {
    method: "POST",
    body: {
      memberNo: "GM-0003", firstName: "Current", lastName: "Visitor",
      email: "visitor@example.com", category: "REGULAR",
      membershipType: "MONTHLY", startDate: todayKey
    }
  });
  await expectFailure(() => request("/api/attendance", {
    method: "POST", body: { memberId: created.member.id }
  }), "Membership expired");
  const checkin = await request("/api/attendance", {
    method: "POST", body: { memberId: visiting.member.id }
  });
  await expectFailure(() => request("/api/attendance", {
    method: "POST", body: { memberId: visiting.member.id }
  }), "less than five minutes ago");
  const visits = await request(`/api/attendance?date=${todayKey}&memberId=${visiting.member.id}`);
  const rangedVisits = await request(`/api/attendance?from=${todayKey}&to=${todayKey}`);
  assert(visits.checkins.length === 1 && visits.checkins[0].id === checkin.id, "attendance should be searchable by date and member");
  assert(rangedVisits.checkins.length === 1, "attendance should be searchable by date range");
  await expectFailure(() => request(`/api/attendance?from=${todayKey}&to=2020-01-01`), "Start date must be before end date.");
  assert(checkin.checkinDate === todayKey && !Number.isNaN(Date.parse(checkin.checkedInAt)), "attendance should store a timestamp and local date");
  const assistantStats = await request("/api/assistant/ask", { method: "POST", body: { question: "How many active members do we have?" } });
  const assistantVisits = await request("/api/assistant/ask", { method: "POST", body: { question: "How many people checked in today?" } });
  const unsupported = await request("/api/assistant/ask", { method: "POST", body: { question: "Run DELETE FROM members" } });
  assert(assistantStats.operation === "getMembershipStats" && assistantStats.data.total === 3, "assistant should use controlled membership data");
  assert(assistantVisits.operation === "getAttendanceSummary" && assistantVisits.data.today === 1, "assistant should count recorded visits");
  assert(unsupported.operation === null, "assistant must not execute unsupported requests");
  const updated = await request(`/api/members/${created.member.id}`, {
    method: "PUT",
    body: {
      memberNo: "GM-0010",
      firstName: "Test",
      lastName: "Member",
      email: "updated@example.com",
      category: "REGULAR"
    }
  });
  const renewal = await request(`/api/members/${created.member.id}/memberships`, {
    method: "POST",
    body: {
      membershipType: "MONTHLY",
      startDate: "2026-09-03"
    }
  });
  const snapshot = await request("/api/members");
  await request(`/api/members/${created.member.id}`, { method: "DELETE" });
  const deletedSnapshot = await request("/api/members");

  assert(initial.members.length === 0, "temporary database should start empty");
  assert(created.member.memberNo === "GM-0010", "member no. should be saved");
  assert(created.membership.endDate === "2026-09-04", "daily membership should expire next day");
  assert(second.membership.endDate === "2026-10-03", "monthly member should expire next month");
  assert(second.member.email === "", "email should be optional when creating a member");
  assert(updated.category === "REGULAR", "member update should save category");
  assert(renewal.endDate === "2026-10-03", "monthly membership should expire next month");
  assert(snapshot.members.length === 3, "snapshot should include created members");
  assert(snapshot.members[0].memberNo === "GM-0002", "members should be sorted by member no.");
  assert(snapshot.members[1].memberNo === "GM-0003" && snapshot.members[2].memberNo === "GM-0010", "members should be sorted by member no.");
  assert(snapshot.memberships.length === 4, "snapshot should include membership history");
  assert(deletedSnapshot.members.length === 2, "delete should remove the selected member");
  assert(deletedSnapshot.members.some(member => member.id === second.member.id), "delete should keep other members");
  assert(
    deletedSnapshot.memberships.every((membership) => membership.memberId !== created.member.id),
    "delete should remove the selected member's memberships"
  );
  await request(`/api/members/${visiting.member.id}`, { method: "DELETE" });
  const afterVisitMemberDelete = await request("/api/attendance");
  assert(afterVisitMemberDelete.checkins.length === 0, "deleting a member should also remove their linked visits");

  console.log("Smoke test passed: member operations, attendance, duplicate prevention, filtering, and controlled assistant queries.");
} finally {
  server.kill();
  await cleanup();
}

function getStartedServerPort() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Server did not start in time.")), 5000);
    let output = "";

    server.stdout.on("data", (chunk) => {
      output += chunk.toString();
      const match = output.match(/Gym management server running at http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolve(Number(match[1]));
      }
    });
    server.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Server exited before startup with code ${code}.`));
    });
  });
}

function createRequester(port) {
  return async function request(route, options = {}) {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, {
      method: options.method ?? "GET",
      headers: options.body ? { "Content-Type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? `Request failed with status ${response.status}`);
    }

    return payload;
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function expectFailure(callback, expectedMessage) {
  try {
    await callback();
  } catch (error) {
    assert(error instanceof Error && error.message.includes(expectedMessage), `expected failure: ${expectedMessage}`);
    return;
  }
  throw new Error(`expected failure: ${expectedMessage}`);
}

async function cleanup() {
  for (const suffix of ["", "-shm", "-wal"]) {
    await unlink(`${dbPath}${suffix}`).catch(() => undefined);
  }
}
