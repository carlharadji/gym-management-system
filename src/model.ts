export type View = "dashboard" | "members" | "checkin" | "attendance" | "reports";
export type DetailMode = "view" | "edit" | "membership";
export type Status = "ACTIVE" | "EXPIRED";
export type MemberStatusFilter = "ALL" | Status | "EXPIRING";
export type MemberCategory = "REGULAR" | "STUDENT";
export type MembershipType = "DAILY" | "MONTHLY";
export type Member = { id: string; memberNo: string; firstName: string; lastName: string; email: string; category: MemberCategory };
export type Membership = { id: string; memberId: string; membershipType: MembershipType; startDate: string; endDate: string; createdAt: string };
export type Checkin = { id: string; memberId: string; checkedInAt: string; checkinDate: string; memberNo: string; firstName: string; lastName: string };
export type MemberForm = { memberNo: string; firstName: string; lastName: string; email: string; category: MemberCategory; membershipType: MembershipType; startDate: string; endDate: string };
export type ToastState = { type: "success" | "error"; title: string; message: string };

export const API_BASE = import.meta.env.DEV ? "http://127.0.0.1:3001" : "";
export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const today = () => dateKey(new Date());
export const parseDate = (date: string) => { const [year, month, day] = date.split("-").map(Number); return new Date(year, month - 1, day); };
export const nameOf = (member: Member) => `${member.firstName} ${member.lastName}`;
export const formatDate = (date: string) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T00:00:00`));
export const formatTime = (timestamp: string) => new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" }).format(new Date(timestamp));
export const planLabel = (plan: MembershipType) => plan === "DAILY" ? "Daily" : "Monthly";
export const categoryLabel = (category: MemberCategory) => category === "STUDENT" ? "Student" : "Regular";
export const latest = (memberships: Membership[], id: string) => memberships.filter((item) => item.memberId === id).sort((a, b) => b.endDate.localeCompare(a.endDate) || b.createdAt.localeCompare(a.createdAt))[0];
export const statusOf = (membership?: Membership): Status => membership && today() <= membership.endDate ? "ACTIVE" : "EXPIRED";
export const expiringSoon = (membership?: Membership) => { const nextWeek = parseDate(today()); nextWeek.setDate(nextWeek.getDate() + 7); return !!membership && statusOf(membership) === "ACTIVE" && membership.endDate <= dateKey(nextWeek); };
export const planOf = (membership?: Membership): MembershipType => membership?.membershipType ?? "MONTHLY";
export const compareMemberNo = (a: Member, b: Member) => a.memberNo.localeCompare(b.memberNo, undefined, { numeric: true, sensitivity: "base" });
export function endDate(startDate: string, plan: MembershipType) { const start = parseDate(startDate || today()); if (plan === "DAILY") { start.setDate(start.getDate() + 1); return dateKey(start); } const target = new Date(start); const day = target.getDate(); target.setDate(1); target.setMonth(target.getMonth() + 1); target.setDate(Math.min(day, new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate())); return dateKey(target); }
export function blankForm(memberNo: string): MemberForm { const startDate = today(); return { memberNo, firstName: "", lastName: "", email: "", category: "REGULAR", membershipType: "MONTHLY", startDate, endDate: endDate(startDate, "MONTHLY") }; }
export function nextNumber(members: Member[]) { const highest = members.reduce((max, member) => Math.max(max, Number(member.memberNo.replace(/\D/g, "")) || 0), 0); return `GM-${String(highest + 1).padStart(4, "0")}`; }
export async function request<T>(path: string, options: RequestInit = {}) { const headers = new Headers(options.headers); if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json"); const response = await fetch(`${API_BASE}${path}`, { ...options, headers }); const payload = await response.json().catch(() => null); if (!response.ok) throw new Error(payload?.error ?? "Request failed."); return payload as T; }
export function messageFor(error: unknown, fallback: string) { return error instanceof TypeError ? "Cannot reach the database server. Start the app with pnpm dev." : error instanceof Error && error.message ? error.message : fallback; }

