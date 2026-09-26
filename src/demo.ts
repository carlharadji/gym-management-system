import { compareMemberNo, dateKey, endDate, latest, nameOf, parseDate, statusOf, today, type Checkin, type Member, type MemberCategory, type Membership, type MembershipType } from "./model";

type DemoData = { members: Member[]; memberships: Membership[]; checkins: Checkin[] };
type Input = Record<string, unknown>;
const storageKey = "gym-portfolio-demo-v1";
let current: DemoData | null = null;

function daysFromToday(days: number) {
  const date = parseDate(today());
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function seed(): DemoData {
  const people: [string, string, MemberCategory, MembershipType, number][] = [
    ["Alyssa", "Rivera", "STUDENT", "MONTHLY", -12],
    ["Paolo", "Cruz", "REGULAR", "MONTHLY", -7],
    ["Liza", "Moreno", "REGULAR", "MONTHLY", -28],
    ["Marco", "Velasco", "REGULAR", "MONTHLY", -38],
    ["Sofia", "Reyes", "STUDENT", "DAILY", 0],
    ["Jamal", "Flores", "REGULAR", "MONTHLY", -2],
    ["Bea", "Mercado", "STUDENT", "MONTHLY", -29],
    ["Hugo", "Ramos", "REGULAR", "DAILY", -9],
    ["Iris", "Bautista", "REGULAR", "MONTHLY", -18],
    ["Mateo", "Lim", "STUDENT", "MONTHLY", -44],
    ["Kara", "Torres", "REGULAR", "MONTHLY", -5],
    ["Nico", "Santos", "REGULAR", "MONTHLY", -33],
  ];
  const members = people.map(([firstName, lastName, category], index): Member => ({
    id: `demo-member-${index + 1}`,
    memberNo: `GM-${String(index + 1).padStart(4, "0")}`,
    firstName, lastName, category,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
  }));
  const memberships = people.map(([, , , membershipType, offset], index): Membership => {
    const startDate = daysFromToday(offset);
    return { id: `demo-membership-${index + 1}`, memberId: members[index].id, membershipType, startDate, endDate: endDate(startDate, membershipType), createdAt: new Date().toISOString() };
  });
  const oldStart = daysFromToday(-58);
  memberships.push({ id: "demo-membership-old", memberId: members[0].id, membershipType: "MONTHLY", startDate: oldStart, endDate: endDate(oldStart, "MONTHLY"), createdAt: new Date().toISOString() });
  const visits: [number, number, number][] = [[0, 0, 0], [1, 1, 9], [2, 1, 16], [0, 2, 8], [5, 2, 17], [8, 3, 10], [1, 3, 18], [0, 4, 9], [6, 4, 12], [5, 5, 11], [8, 6, 10]];
  const checkins = visits.map(([index, daysAgo, hour], visitIndex): Checkin => {
    const date = parseDate(daysFromToday(-daysAgo));
    if (daysAgo) date.setHours(hour, 10, 0, 0);
    const member = members[index];
    return { id: `demo-visit-${visitIndex + 1}`, memberId: member.id, memberNo: member.memberNo, firstName: member.firstName, lastName: member.lastName, checkedInAt: daysAgo ? date.toISOString() : new Date().toISOString(), checkinDate: dateKey(date) };
  });
  return { members, memberships, checkins };
}

function data(): DemoData {
  if (current) return current;
  try {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved) as DemoData;
      if (Array.isArray(parsed.members) && Array.isArray(parsed.memberships) && Array.isArray(parsed.checkins)) return current = parsed;
    }
  } catch { /* The demo still works when browser storage is unavailable. */ }
  current = seed();
  save();
  return current;
}

function save() {
  try { if (current) sessionStorage.setItem(storageKey, JSON.stringify(current)); } catch { /* Session-only fallback. */ }
}

export function resetDemo() { current = seed(); save(); }

function required(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function validDate(value: unknown, label: string): string {
  const date = required(value, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || dateKey(parseDate(date)) !== date) throw new Error(`${label} must be a valid date.`);
  return date;
}

function memberFields(body: Input, members: Member[], id?: string) {
  const memberNo = required(body.memberNo, "Member no.");
  if (!/^GM-\d{4}$/.test(memberNo)) throw new Error("Member no. must use GM- followed by four digits.");
  if (members.some(member => member.memberNo === memberNo && member.id !== id)) throw new Error("Member no. already exists.");
  const firstName = required(body.firstName, "First name");
  const lastName = required(body.lastName, "Last name");
  const email = body.email == null ? "" : typeof body.email === "string" ? body.email.trim() : (() => { throw new Error("Email must be text."); })();
  if (body.category !== "REGULAR" && body.category !== "STUDENT") throw new Error("Discount type must be Regular or Student.");
  return { memberNo, firstName, lastName, email, category: body.category as MemberCategory };
}

function periodFields(body: Input) {
  if (body.membershipType !== "DAILY" && body.membershipType !== "MONTHLY") throw new Error("Membership type must be Daily or Monthly.");
  const membershipType = body.membershipType as MembershipType;
  const startDate = validDate(body.startDate, "Membership start date");
  return { membershipType, startDate, endDate: endDate(startDate, membershipType) };
}

function bodyOf(options: RequestInit): Input {
  if (typeof options.body !== "string") throw new Error("Request body is required.");
  const body: unknown = JSON.parse(options.body);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Request body must be an object.");
  return body as Input;
}

function attendance(records: DemoData, filters: URLSearchParams) {
  const date = filters.get("date");
  const from = filters.get("from");
  const to = filters.get("to");
  if (date) validDate(date, "Date");
  if (from) validDate(from, "Start date");
  if (to) validDate(to, "End date");
  if (from && to && from > to) throw new Error("Start date must be before end date.");
  return records.checkins.filter(visit => (!filters.get("memberId") || visit.memberId === filters.get("memberId")) && (!date || visit.checkinDate === date) && (!from || visit.checkinDate >= from) && (!to || visit.checkinDate <= to)).map(visit => {
    const member = records.members.find(item => item.id === visit.memberId);
    return member ? { ...visit, memberNo: member.memberNo, firstName: member.firstName, lastName: member.lastName } : visit;
  }).sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
}

export async function demoRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = new URL(path, "https://demo.invalid");
  const method = options.method?.toUpperCase() ?? "GET";
  const records = data();
  if (method === "GET" && url.pathname === "/api/members") return { members: records.members.map(member => ({ ...member })).sort(compareMemberNo), memberships: records.memberships.map(membership => ({ ...membership })) } as T;
  if (method === "GET" && url.pathname === "/api/attendance") return { checkins: attendance(records, url.searchParams) } as T;
  if (method === "POST" && url.pathname === "/api/assistant/ask") return answerQuestion(required(bodyOf(options).question, "Question"), records) as T;
  if (method === "POST" && url.pathname === "/api/members") {
    const body = bodyOf(options);
    const member: Member = { id: `demo-member-${crypto.randomUUID()}`, ...memberFields(body, records.members) };
    const membership: Membership = { id: `demo-membership-${crypto.randomUUID()}`, memberId: member.id, ...periodFields(body), createdAt: new Date().toISOString() };
    records.members.push(member);
    records.memberships.push(membership);
    save();
    return { member, membership } as T;
  }
  if (method === "POST" && url.pathname === "/api/attendance") {
    const memberId = required(bodyOf(options).memberId, "Member");
    const member = records.members.find(item => item.id === memberId);
    if (!member) throw new Error("Member not found.");
    if (statusOf(latest(records.memberships, memberId)) === "EXPIRED") throw new Error("Membership expired. Renew it before checking in.");
    const now = new Date();
    if (records.checkins.some(item => item.memberId === memberId && now.getTime() - Date.parse(item.checkedInAt) < 5 * 60 * 1000)) throw new Error("This member checked in less than five minutes ago.");
    const visit: Checkin = { id: `demo-visit-${crypto.randomUUID()}`, memberId, memberNo: member.memberNo, firstName: member.firstName, lastName: member.lastName, checkedInAt: now.toISOString(), checkinDate: today() };
    records.checkins.push(visit);
    save();
    return visit as T;
  }
  const memberRoute = /^\/api\/members\/([^/]+)$/.exec(url.pathname);
  const periodRoute = /^\/api\/members\/([^/]+)\/memberships$/.exec(url.pathname);
  if (memberRoute && (method === "PUT" || method === "DELETE")) {
    const member = records.members.find(item => item.id === decodeURIComponent(memberRoute[1]));
    if (!member) throw new Error("Member not found.");
    if (method === "DELETE") {
      records.members = records.members.filter(item => item.id !== member.id);
      records.memberships = records.memberships.filter(item => item.memberId !== member.id);
      records.checkins = records.checkins.filter(item => item.memberId !== member.id);
      save();
      return {} as T;
    }
    Object.assign(member, memberFields(bodyOf(options), records.members, member.id));
    save();
    return member as T;
  }
  if (periodRoute && method === "POST") {
    const memberId = decodeURIComponent(periodRoute[1]);
    if (!records.members.some(item => item.id === memberId)) throw new Error("Member not found.");
    const membership: Membership = { id: `demo-membership-${crypto.randomUUID()}`, memberId, ...periodFields(bodyOf(options)), createdAt: new Date().toISOString() };
    records.memberships.push(membership);
    save();
    return membership as T;
  }
  throw new Error("This operation is not available in the demo.");
}

function answerQuestion(question: string, records: DemoData) {
  const text = question.toLowerCase();
  const members = records.members;
  const visits = records.checkins;
  const active = members.filter(member => statusOf(latest(records.memberships, member.id)) === "ACTIVE");
  const thisMonth = visits.filter(visit => visit.checkinDate.startsWith(today().slice(0, 7)));
  const thisWeekStart = parseDate(today());
  thisWeekStart.setDate(thisWeekStart.getDate() - ((thisWeekStart.getDay() + 6) % 7));
  let operation: string | null = null;
  let answer = "I can answer questions about membership counts, today's visits, expiring members, inactive members, busiest days, and attendance summaries.";
  if (/busiest|busy day/.test(text)) {
    operation = "getBusiestDays";
    const counts = new Map<string, number>();
    thisMonth.forEach(item => counts.set(item.checkinDate, (counts.get(item.checkinDate) ?? 0) + 1));
    const days = [...counts].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0])).slice(0, 10);
    answer = days.length ? `Busiest days this month: ${days.map(([day, count]) => `${day}, ${count} visits`).join("; ")}.` : "No visits have been recorded this month.";
  } else if (/most active|visited the most|top visitors/.test(text)) {
    operation = "getMostActiveMembers";
    const counts = new Map<string, number>();
    thisMonth.forEach(item => counts.set(item.memberId, (counts.get(item.memberId) ?? 0) + 1));
    const rows = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10);
    answer = rows.length ? `Most visits this month: ${rows.map(([id, count]) => `${nameOf(members.find(member => member.id === id)!)} (${members.find(member => member.id === id)!.memberNo}), ${count}`).join("; ")}.` : "No visits have been recorded this month.";
  } else if (/haven.t visited|have not visited|inactive|no visit|last 30 days/.test(text)) {
    operation = "getInactiveMembers";
    const cutoff = daysFromToday(-30);
    const rows = active.filter(member => !visits.some(visit => visit.memberId === member.id && visit.checkinDate >= cutoff));
    answer = rows.length ? `${rows.length} active members have not visited in the last 30 days. ${rows.map(member => `${nameOf(member)} (${member.memberNo})`).join(", ")}.` : "All active members have visited in the last 30 days.";
  } else if (/expir|renew/.test(text) && /soon|week|next|recent|who/.test(text)) {
    operation = "getExpiringMembers";
    const rows = active.map(member => ({ member, end: latest(records.memberships, member.id)!.endDate })).filter(item => item.end <= daysFromToday(7)).sort((a, b) => a.end.localeCompare(b.end));
    answer = rows.length ? `${rows.length} memberships expire within seven days: ${rows.map(({ member, end }) => `${nameOf(member)} (${member.memberNo}), ${end}`).join("; ")}.` : "No memberships expire within seven days.";
  } else if (/active member|expired member|membership status|member count/.test(text)) {
    operation = "getMembershipStats";
    const soon = active.filter(member => latest(records.memberships, member.id)!.endDate <= daysFromToday(7)).length;
    answer = `${active.length} active members, ${members.length - active.length} expired members, and ${soon} expiring within seven days. Total members: ${members.length}.`;
  } else if (/who.*(check.?in|visit).*today|today.*(check.?in|visit).*(who|member)/.test(text)) {
    operation = "getTodaysAttendance";
    const rows = visits.filter(visit => visit.checkinDate === today());
    answer = rows.length ? `${rows.length} check-ins today. ${rows.map(visit => `${visit.firstName} ${visit.lastName} (${visit.memberNo})`).join(", ")}.` : "No members have checked in today.";
  } else if ((/summari|summary|week|month/.test(text) && /attendan|visit|check.?in/.test(text)) || (/today/.test(text) && /attendan|visit|check.?in|people/.test(text))) {
    operation = "getAttendanceSummary";
    const week = visits.filter(visit => visit.checkinDate >= dateKey(thisWeekStart) && visit.checkinDate <= today());
    answer = `${visits.filter(visit => visit.checkinDate === today()).length} visits today, ${week.length} this week, and ${thisMonth.length} this month. This week has visits on ${new Set(week.map(visit => visit.checkinDate)).size} days.`;
  }
  return { answer, operation, mode: "local" as const };
}
