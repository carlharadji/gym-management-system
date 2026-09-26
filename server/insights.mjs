const operations = {
  getMembershipStats: "Count active, expired, and expiring memberships.",
  getTodaysAttendance: "List today's check-ins and total visits.",
  getAttendanceSummary: "Summarize visits today, this week, and this month.",
  getExpiringMembers: "List members expiring within seven days and recently expired members.",
  getInactiveMembers: "List active members with no check-in in the last 30 days.",
  getMostActiveMembers: "Rank members by visits this month.",
  getBusiestDays: "Rank this month's dates by visit count."
};

export function createInsights(db) {
  function snapshot() {
    const members = db.prepare("SELECT id, member_no AS memberNo, first_name AS firstName, last_name AS lastName FROM members").all();
    const memberships = db.prepare("SELECT member_id AS memberId, end_date AS endDate, created_at AS createdAt FROM memberships ORDER BY end_date DESC, created_at DESC").all();
    const checkins = db.prepare("SELECT member_id AS memberId, checkin_date AS checkinDate, checked_in_at AS checkedInAt FROM attendance_checkins").all();
    const latestByMember = new Map();
    memberships.forEach(item => { if (!latestByMember.has(item.memberId)) latestByMember.set(item.memberId, item); });
    const now = new Date();
    const day = localDate(now);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const month = day.slice(0, 7);
    const nextWeek = new Date(now); nextWeek.setDate(now.getDate() + 7);
    const lastWeek = new Date(now); lastWeek.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(now.getDate() - 30);
    return { members, checkins, latestByMember, day, weekStart: localDate(weekStart), month, nextWeek: localDate(nextWeek), lastWeek: localDate(lastWeek), thirtyDaysAgo: localDate(thirtyDaysAgo) };
  }

  function run(name) {
    if (!Object.hasOwn(operations, name)) return null;
    const data = snapshot();
    const person = member => ({ memberNo: member.memberNo, name: `${member.firstName} ${member.lastName}` });
    if (name === "getMembershipStats") {
      const active = data.members.filter(member => (data.latestByMember.get(member.id)?.endDate ?? "") >= data.day).length;
      const expiringSoon = data.members.filter(member => { const end = data.latestByMember.get(member.id)?.endDate; return end >= data.day && end <= data.nextWeek; }).length;
      return { total: data.members.length, active, expired: data.members.length - active, expiringSoon };
    }
    if (name === "getTodaysAttendance") {
      const visits = data.checkins.filter(item => item.checkinDate === data.day).sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt));
      return { date: data.day, count: visits.length, visits: visits.slice(0, 20).map(item => ({ ...person(data.members.find(member => member.id === item.memberId)), checkedInAt: item.checkedInAt })) };
    }
    if (name === "getAttendanceSummary") {
      const thisWeek = data.checkins.filter(item => item.checkinDate >= data.weekStart && item.checkinDate <= data.day);
      const days = new Set(thisWeek.map(item => item.checkinDate));
      return { today: data.checkins.filter(item => item.checkinDate === data.day).length, thisWeek: thisWeek.length, thisMonth: data.checkins.filter(item => item.checkinDate.startsWith(data.month)).length, activeDaysThisWeek: days.size };
    }
    if (name === "getExpiringMembers") {
      const rows = data.members.map(member => ({ ...person(member), endDate: data.latestByMember.get(member.id)?.endDate })).filter(item => item.endDate);
      const expiringSoon = rows.filter(item => item.endDate >= data.day && item.endDate <= data.nextWeek).sort((a, b) => a.endDate.localeCompare(b.endDate));
      const recentlyExpired = rows.filter(item => item.endDate < data.day && item.endDate >= data.lastWeek).sort((a, b) => b.endDate.localeCompare(a.endDate));
      return { expiringSoon: expiringSoon.slice(0, 30), expiringCount: expiringSoon.length, recentlyExpired: recentlyExpired.slice(0, 30), recentlyExpiredCount: recentlyExpired.length };
    }
    if (name === "getInactiveMembers") {
      const rows = data.members.filter(member => (data.latestByMember.get(member.id)?.endDate ?? "") >= data.day).map(member => ({ ...person(member), lastVisit: data.checkins.filter(item => item.memberId === member.id).sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))[0]?.checkinDate ?? null })).filter(item => !item.lastVisit || item.lastVisit < data.thirtyDaysAgo).sort((a, b) => (a.lastVisit ?? "").localeCompare(b.lastVisit ?? ""));
      return { count: rows.length, members: rows.slice(0, 30) };
    }
    if (name === "getMostActiveMembers") {
      const counts = new Map();
      data.checkins.filter(item => item.checkinDate.startsWith(data.month)).forEach(item => counts.set(item.memberId, (counts.get(item.memberId) ?? 0) + 1));
      return { month: data.month, members: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, visits]) => ({ ...person(data.members.find(member => member.id === id)), visits })) };
    }
    const counts = new Map();
    data.checkins.filter(item => item.checkinDate.startsWith(data.month)).forEach(item => counts.set(item.checkinDate, (counts.get(item.checkinDate) ?? 0) + 1));
    return { month: data.month, days: [...counts].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0])).slice(0, 10).map(([date, visits]) => ({ date, visits })) };
  }

  return { run, operations };
}

export function matchLocalQuestion(question) {
  const text = question.toLowerCase();
  if (/busiest|busy day/.test(text)) return "getBusiestDays";
  if (/most active|visited the most|top visitors/.test(text)) return "getMostActiveMembers";
  if (/haven.t visited|have not visited|inactive|no visit|last 30 days/.test(text)) return "getInactiveMembers";
  if (/expir|renew/.test(text) && /soon|week|next|recent|who/.test(text)) return "getExpiringMembers";
  if (/active member|expired member|membership status|member count/.test(text)) return "getMembershipStats";
  if (/who.*(check.?in|visit).*today|today.*(check.?in|visit).*(who|member)/.test(text)) return "getTodaysAttendance";
  if (/summari|summary|week|month/.test(text) && /attendan|visit|check.?in/.test(text)) return "getAttendanceSummary";
  if (/today/.test(text) && /attendan|visit|check.?in|people/.test(text)) return "getAttendanceSummary";
  return null;
}

export function describeResult(name, result) {
  if (name === "getMembershipStats") return `${result.active} active members, ${result.expired} expired members, and ${result.expiringSoon} expiring within seven days. Total members: ${result.total}.`;
  if (name === "getTodaysAttendance") return result.count ? `${result.count} check-ins today. ${result.count > result.visits.length ? "Most recent: " : ""}${result.visits.map(item => `${item.name} (${item.memberNo})`).join(", ")}.` : "No members have checked in today.";
  if (name === "getAttendanceSummary") return `${result.today} visits today, ${result.thisWeek} this week, and ${result.thisMonth} this month. This week has visits on ${result.activeDaysThisWeek} days.`;
  if (name === "getExpiringMembers") return result.expiringCount ? `${result.expiringCount} memberships expire within seven days: ${result.expiringSoon.map(item => `${item.name} (${item.memberNo}), ${item.endDate}`).join("; ")}. ${result.recentlyExpiredCount} expired in the last seven days.` : `No memberships expire within seven days. ${result.recentlyExpiredCount} expired in the last seven days.`;
  if (name === "getInactiveMembers") return result.count ? `${result.count} active members have not visited in the last 30 days. ${result.count > result.members.length ? "First 30: " : ""}${result.members.map(item => `${item.name} (${item.memberNo})`).join(", ")}.` : "All active members have visited in the last 30 days.";
  if (name === "getMostActiveMembers") return result.members.length ? `Most visits this month: ${result.members.map(item => `${item.name} (${item.memberNo}), ${item.visits}`).join("; ")}.` : "No visits have been recorded this month.";
  return result.days.length ? `Busiest days this month: ${result.days.map(item => `${item.date}, ${item.visits} visits`).join("; ")}.` : "No visits have been recorded this month.";
}

export async function chooseOperation(question, operations) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { name: matchLocalQuestion(question), mode: "local" };
  const tools = Object.entries(operations).map(([name, description]) => ({ type: "function", name, description, parameters: { type: "object", properties: {}, required: [], additionalProperties: false }, strict: true }));
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", store: false, instructions: "You route gym data questions to exactly one available read-only function. Do not answer from memory. Choose the closest function for supported questions.", input: question, tools, tool_choice: "required", parallel_tool_calls: false })
  });
  if (!response.ok) throw new Error(`AI service returned ${response.status}. Check the backend API key and model.`);
  const payload = await response.json();
  const call = payload.output?.find(item => item.type === "function_call" && Object.hasOwn(operations, item.name));
  return { name: call?.name ?? null, mode: "ai" };
}

export async function explainResult(question, operation, data) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini", store: false, max_output_tokens: 350,
      instructions: "You are a gym operations assistant. Answer the user's question only from the structured result. Be concise and accurate. Do not invent records, dates, or counts. If the result is empty, say so clearly.",
      input: `Question: ${question}\nOperation: ${operation}\nResult: ${JSON.stringify(data)}`
    })
  });
  if (!response.ok) throw new Error(`AI service returned ${response.status}. Check the backend API key and model.`);
  const payload = await response.json();
  const answer = payload.output?.filter(item => item.type === "message").flatMap(item => item.content ?? []).filter(item => item.type === "output_text").map(item => item.text).join("\n").trim();
  if (!answer) throw new Error("AI service returned no answer.");
  return answer;
}

function localDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
