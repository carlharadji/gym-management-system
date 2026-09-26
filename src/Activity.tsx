import React from "react";
import { Check, ChevronRight, Search } from "lucide-react";
import { Button, Empty, MemberIdentity, SearchField, StatusMark } from "./ui";
import { dateKey, expiringSoon, formatDate, formatTime, latest, nameOf, parseDate, statusOf, today, type Checkin, type Member, type Membership } from "./model";

type ActivityData = { members: Member[]; memberships: Membership[]; checkins: Checkin[] };

export function CheckinPage({ members, memberships, checkins, onCheckin, onMember }: ActivityData & { onCheckin: (member: Member) => Promise<void>; onMember: (id: string) => void }) {
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [clock, setClock] = React.useState(Date.now());
  React.useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 15000); return () => window.clearInterval(timer); }, []);
  React.useEffect(() => { searchRef.current?.focus({ preventScroll: true }); }, []);
  const normalizedQuery = query.trim().toLowerCase();
  const exactNumberMatch = normalizedQuery ? members.find(member => member.memberNo.toLowerCase() === normalizedQuery) : undefined;
  const selected = members.find(member => member.id === selectedId) ?? exactNumberMatch;
  const membership = selected ? latest(memberships, selected.id) : undefined;
  const recent = selected ? checkins.find(checkin => checkin.memberId === selected.id) : undefined;
  const recentlyCheckedIn = !!recent && clock - Date.parse(recent.checkedInAt) < 5 * 60 * 1000;
  const matches = normalizedQuery ? members.filter(member => [member.memberNo, member.firstName, member.lastName, member.email, nameOf(member)].join(" ").toLowerCase().includes(normalizedQuery)).slice(0, 12) : [];
  async function submit() {
    if (!selected || busy || statusOf(membership) === "EXPIRED" || recentlyCheckedIn) return;
    setBusy(true);
    setError("");
    try { await onCheckin(selected); setSelectedId(null); setQuery(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not record the check-in."); }
    finally { setBusy(false); searchRef.current?.focus({ preventScroll: true }); }
  }
  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing || busy) return;
    event.preventDefault();
    if (selected) { void submit(); return; }
    if (matches.length === 1) setSelectedId(matches[0].id);
  }
  return <div className="activity-layout">
    <section className="operation-panel"><header className="panel-header"><div><h2>Find a member</h2><p>Search by member no., name, or email.</p></div></header><div className="activity-content"><SearchField value={query} inputRef={searchRef} onKeyDown={handleSearchKeyDown} onChange={value => { setQuery(value); setSelectedId(null); setError(""); }} />{query.trim() ? <div className="checkin-results" role="listbox" aria-label="Matching members">{matches.length ? matches.map(member => <button key={member.id} type="button" role="option" aria-selected={selected?.id === member.id} className={selected?.id === member.id ? "is-selected" : ""} onClick={() => { setSelectedId(member.id); setError(""); searchRef.current?.focus({ preventScroll: true }); }}><MemberIdentity member={member} /><StatusMark status={statusOf(latest(memberships, member.id))} /></button>) : <Empty title="No matching members" message="Try another name, member no., or email." />}</div> : <p className="activity-hint"><Search size={16} />Start typing to find a member.</p>}</div></section>
    <section className="operation-panel"><header className="panel-header"><div><h2>Check-in details</h2><p>Review membership before recording a visit.</p></div></header><div className="activity-content">{selected ? <><div className="checkin-selected"><MemberIdentity member={selected} /><button className="text-link" onClick={() => onMember(selected.id)}>View profile <ChevronRight size={15} /></button></div><div className="detail-line"><span>Membership</span><StatusMark status={statusOf(membership)} /></div><div className="detail-line"><span>Expiration</span><strong>{membership ? formatDate(membership.endDate) : "No membership"}</strong></div>{statusOf(membership) === "EXPIRED" ? <p className="activity-warning" role="alert">Membership expired. Renew it before checking in.</p> : recentlyCheckedIn ? <p className="activity-warning" role="status">Checked in at {formatTime(recent.checkedInAt)}. Another check-in is available after five minutes.</p> : null}{error ? <p className="activity-error" role="alert">{error}</p> : null}<Button className="checkin-submit" icon={<Check size={17} />} disabled={busy || statusOf(membership) === "EXPIRED" || recentlyCheckedIn} onClick={() => void submit()}>{busy ? "Recording…" : "Record check-in"}</Button></> : <Empty title="Select a member" message="Their membership and check-in availability will appear here." />}</div></section>
  </div>;
}

export function AttendancePage({ members, memberships, checkins, onMember }: ActivityData & { onMember: (id: string) => void }) {
  const [query, setQuery] = React.useState("");
  const [mode, setMode] = React.useState<"all" | "date" | "range">("all");
  const [day, setDay] = React.useState(today());
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [memberId, setMemberId] = React.useState("");
  const selectedMember = members.find(member => member.id === memberId);
  const invalidRange = mode === "range" && !!from && !!to && from > to;
  const results = invalidRange ? [] : checkins.filter(checkin => {
    const text = [checkin.memberNo, checkin.firstName, checkin.lastName].join(" ").toLowerCase();
    return (!memberId || checkin.memberId === memberId) && text.includes(query.trim().toLowerCase()) && (mode === "all" || (mode === "date" ? checkin.checkinDate === day : (!from || checkin.checkinDate >= from) && (!to || checkin.checkinDate <= to)));
  });
  return <section className="operation-panel attendance-page"><div className="activity-filters"><SearchField value={query} onChange={setQuery} /><label className="field"><span>Period</span><select value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="all">All dates</option><option value="date">Specific date</option><option value="range">Date range</option></select></label>{mode === "date" ? <label className="field"><span>Date</span><input type="date" value={day} onChange={event => setDay(event.target.value)} /></label> : null}{mode === "range" ? <><label className="field"><span>From</span><input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label><label className="field"><span>To</span><input type="date" value={to} onChange={event => setTo(event.target.value)} /></label></> : null}{memberId ? <Button variant="secondary" onClick={() => setMemberId("")}>Clear member</Button> : null}</div>{invalidRange ? <p className="activity-error" role="alert">Start date must be before end date.</p> : null}<div className="attendance-heading"><h2>{selectedMember ? `${nameOf(selectedMember)}'s visits` : "Visit history"}</h2><span>{results.length} {results.length === 1 ? "visit" : "visits"}</span></div>{results.length ? <div className="attendance-table-wrap"><table className="attendance-table"><thead><tr><th>Member</th><th>Date</th><th>Time</th><th>Current status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{results.map(checkin => { const member = members.find(item => item.id === checkin.memberId); return <tr key={checkin.id}><td><strong>{checkin.firstName} {checkin.lastName}</strong><small>{checkin.memberNo}</small></td><td>{formatDate(checkin.checkinDate)}</td><td>{formatTime(checkin.checkedInAt)}</td><td>{member ? <StatusMark status={statusOf(latest(memberships, member.id))} /> : "—"}</td><td><button className="row-action" onClick={() => setMemberId(checkin.memberId)}>History <ChevronRight size={15} /></button><button className="row-action" onClick={() => onMember(checkin.memberId)}>Profile</button></td></tr>; })}</tbody></table></div> : <Empty title="No visits found" message={checkins.length ? "Adjust the member search or date filters." : "Check-ins will appear here after members start visiting."} />}</section>;
}

export function ReportsPage({ members, memberships, checkins, onMember }: ActivityData & { onMember: (id: string) => void }) {
  const current = today();
  const startOfWeek = new Date(); startOfWeek.setHours(0, 0, 0, 0); startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7));
  const weekKey = dateKey(startOfWeek);
  const monthKey = current.slice(0, 7);
  const weekVisits = checkins.filter(item => item.checkinDate >= weekKey && item.checkinDate <= current);
  const monthVisits = checkins.filter(item => item.checkinDate.startsWith(monthKey));
  const lastSeven = Array.from({ length: 7 }, (_, index) => { const date = parseDate(current); date.setDate(date.getDate() - (6 - index)); const key = dateKey(date); return { key, count: checkins.filter(item => item.checkinDate === key).length }; });
  const dayCounts = new Map<string, number>(); monthVisits.forEach(item => dayCounts.set(item.checkinDate, (dayCounts.get(item.checkinDate) ?? 0) + 1));
  const busiest = [...dayCounts].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0])).slice(0, 5);
  const memberCounts = new Map<string, number>(); monthVisits.forEach(item => memberCounts.set(item.memberId, (memberCounts.get(item.memberId) ?? 0) + 1));
  const mostActive = [...memberCounts].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const inactiveCutoff = new Date(); inactiveCutoff.setDate(inactiveCutoff.getDate() - 30);
  const cutoffKey = dateKey(inactiveCutoff);
  const inactive = members.filter(member => statusOf(latest(memberships, member.id)) === "ACTIVE" && !checkins.some(item => item.memberId === member.id && item.checkinDate >= cutoffKey));
  const active = members.filter(member => statusOf(latest(memberships, member.id)) === "ACTIVE").length;
  const expiring = members.filter(member => expiringSoon(latest(memberships, member.id))).length;
  const recentCutoff = parseDate(current); recentCutoff.setDate(recentCutoff.getDate() - 7);
  const recentlyExpired = members.filter(member => { const end = latest(memberships, member.id)?.endDate; return !!end && end < current && end >= dateKey(recentCutoff); }).sort((a, b) => (latest(memberships, b.id)?.endDate ?? "").localeCompare(latest(memberships, a.id)?.endDate ?? ""));
  const max = Math.max(1, ...lastSeven.map(item => item.count));
  return <div className="reports-page"><div className="report-metrics"><div><span>Visits today</span><strong>{checkins.filter(item => item.checkinDate === current).length}</strong></div><div><span>Visits this week</span><strong>{weekVisits.length}</strong></div><div><span>Visits this month</span><strong>{monthVisits.length}</strong></div><div><span>Memberships</span><strong>{active} active · {members.length - active} expired</strong><small>{expiring} expiring · {recentlyExpired.length} recently expired</small></div></div><section className="operation-panel"><header className="panel-header"><div><h2>Daily attendance</h2><p>Visits during the last seven days.</p></div></header>{lastSeven.some(item => item.count) ? <div className="trend" role="img" aria-label={lastSeven.map(item => `${formatDate(item.key)}: ${item.count} visits`).join(", ")}>{lastSeven.map(item => <div className="trend-day" key={item.key}><strong>{item.count}</strong><span className="trend-track"><span style={{ height: `${Math.max(3, item.count / max * 100)}%` }} /></span><small>{new Intl.DateTimeFormat("en-PH", { weekday: "short" }).format(parseDate(item.key))}</small></div>)}</div> : <Empty title="No visits this week" message="The attendance trend will appear after the first check-in." />}</section><div className="report-grid"><ReportList title="Busiest days this month" subtitle="Ranked by visits" rows={busiest.map(([day, count]) => ({ id: day, label: formatDate(day), detail: `${count} visits` }))} empty="No visits recorded this month." /><ReportList title="Most active this month" subtitle="Members with the most check-ins" rows={mostActive.map(([id, count]) => ({ id, label: nameOf(members.find(member => member.id === id)!), detail: `${count} visits`, onClick: () => onMember(id) }))} empty="No member visits this month." /><ReportList title="No visit in 30 days" subtitle="Active members without a recent check-in" rows={inactive.map(member => ({ id: member.id, label: nameOf(member), detail: member.memberNo, onClick: () => onMember(member.id) }))} empty="All active members visited recently." /><ReportList title="Recently expired" subtitle="Expired in the last seven days" rows={recentlyExpired.slice(0, 8).map(member => ({ id: member.id, label: nameOf(member), detail: formatDate(latest(memberships, member.id)!.endDate), onClick: () => onMember(member.id) }))} empty="No memberships expired this week." /></div></div>;
}

function ReportList({ title, subtitle, rows, empty }: { title: string; subtitle: string; rows: { id: string; label: string; detail: string; onClick?: () => void }[]; empty: string }) {
  return <section className="operation-panel"><header className="panel-header"><div><h2>{title}</h2><p>{subtitle}</p></div></header>{rows.length ? <div className="report-list">{rows.map((row, index) => row.onClick ? <button key={row.id} onClick={row.onClick}><span className="rank">{index + 1}</span><strong>{row.label}</strong><small>{row.detail}</small><ChevronRight size={15} /></button> : <div key={row.id}><span className="rank">{index + 1}</span><strong>{row.label}</strong><small>{row.detail}</small></div>)}</div> : <Empty title="No data yet" message={empty} />}</section>;
}
