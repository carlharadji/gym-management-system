import React from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, CalendarCheck, CalendarDays, ChartNoAxesCombined, ChevronRight, Dumbbell, LayoutDashboard, Plus, RefreshCw, RotateCcw, ScanLine, Users } from "lucide-react";
import { Button, Empty, IconButton, MemberIdentity, SearchField, StatusMark } from "./ui";
import { DEMO_MODE, categoryLabel, expiringSoon, formatDate, formatTime, latest, nameOf, parseDate, planLabel, statusOf, today, type Checkin, type DetailMode, type Member, type Membership, type MemberStatusFilter, type View } from "./model";

export function AppShell({ view, onNavigate, onResetDemo, loading, error, date, children }: { view: View; onNavigate: (view: View) => void; onResetDemo: () => void; loading: boolean; error: boolean; date: string; children: React.ReactNode }) {
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <aside className="side-rail">
      <div className="brand"><span className="brand-mark"><Dumbbell size={24} strokeWidth={2.2} /></span><span className="brand-type"><strong>GYM<span>.</span></strong><small>Operations console</small></span></div>
      <div className="rail-label">Workspace</div>
      <nav aria-label="Main navigation">{([{ id: "dashboard", label: "Dashboard", Icon: LayoutDashboard }, { id: "checkin", label: "Check-in", Icon: ScanLine }, { id: "members", label: "Members", Icon: Users }, { id: "attendance", label: "Attendance", Icon: CalendarCheck }, { id: "reports", label: "Reports", Icon: ChartNoAxesCombined }] as const).map(({ id, label, Icon }) => <button key={id} className={`nav-button ${view === id ? "is-active" : ""}`} aria-current={view === id ? "page" : undefined} onClick={() => onNavigate(id)}><Icon size={18} /><span>{label}</span>{view === id ? <ChevronRight className="nav-chevron" size={15} /> : null}</button>)}</nav>
      <div className="rail-bottom"><div className="branch-context"><span className="branch-dot" /><span>Single branch<span>Member management</span></span></div><div className="admin-context"><span className="admin-avatar">{DEMO_MODE ? "D" : "SA"}</span><span><strong>{DEMO_MODE ? "Demo workspace" : "System Admin"}</strong><small>Front desk</small></span></div></div>
    </aside>
    <div className="main-column"><div className="utility-bar"><div className="breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>{({ dashboard: "Dashboard", members: "Members", checkin: "Check-in", attendance: "Attendance", reports: "Reports" } as const)[view]}</strong></div><div className="utility-context"><span className={`connection-state ${error ? "has-error" : ""}`}><span />{loading ? "Loading records" : error ? "Connection unavailable" : DEMO_MODE ? "Sample data" : "Local database"}</span><time dateTime={date}><CalendarDays size={14} />{new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(parseDate(date))}</time></div></div>
      {DEMO_MODE ? <div className="demo-strip"><span><strong>Portfolio demo</strong> · Sample records stay in this browser tab.</span><button type="button" onClick={onResetDemo}><RotateCcw size={14} />Reset sample data</button></div> : null}
      <main className="workspace" id="main-content" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}

export function PageHeader({ view, onAdd }: { view: View; onAdd: () => void }) {
  const headings: Record<View, [string, string]> = { dashboard: ["Front desk", "Your members and today's activity."], members: ["Members", "Your member roster, all in one place."], checkin: ["Member check-in", "Find a member and record their visit."], attendance: ["Attendance", "Search and review recorded visits."], reports: ["Reports", "A practical view of gym activity."] };
  return <header className="page-header"><div><h1>{headings[view][0]}</h1><p>{headings[view][1]}</p></div>{view === "dashboard" || view === "members" ? <Button icon={<Plus size={17} />} onClick={onAdd}>Add member</Button> : null}</header>;
}

type Records = { members: Member[]; memberships: Membership[] };
export function Dashboard({ members, memberships, checkins, onOpen, onMember, onAdd, onNavigate }: Records & { checkins: Checkin[]; onOpen: (filter?: MemberStatusFilter) => void; onMember: (id: string, mode?: DetailMode) => void; onAdd: () => void; onNavigate: (view: View) => void }) {
  const rows = members.map(member => ({ member, membership: latest(memberships, member.id) }));
  const active = rows.filter(row => statusOf(row.membership) === "ACTIVE");
  const expired = rows.filter(row => statusOf(row.membership) === "EXPIRED").sort((a, b) => (b.membership?.endDate ?? "").localeCompare(a.membership?.endDate ?? ""));
  const expiring = rows.filter(row => expiringSoon(row.membership));
  const todaysVisits = checkins.filter(checkin => checkin.checkinDate === today());
  return <div className="dashboard">
    <section className="summary-strip" aria-label="Member summary">
      <Summary label="Total members" value={members.length} note="Your complete roster" onClick={() => onOpen("ALL")} />
      <Summary label="Active memberships" value={active.length} note="Within their membership period" tone="success" onClick={() => onOpen("ACTIVE")} />
      <Summary label="Expired memberships" value={expired.length} note="Ready for a renewal" tone="warning" onClick={() => onOpen("EXPIRED")} />
      <Summary label="Expiring soon" value={expiring.length} note="Within the next 7 days" tone="warning" onClick={() => onOpen("EXPIRING")} />
      <Summary label="Check-ins today" value={todaysVisits.length} note="Recorded visits" onClick={() => onNavigate("attendance")} />
    </section>
    <div className="dashboard-grid">
      <section className="attention-panel"><header className="panel-header"><div><h2>Needs attention <span className="count-label">{expired.length}</span></h2><p>Expired memberships, latest expiration first.</p></div><button className="text-link" onClick={() => onOpen("EXPIRED")}>View all <ArrowUpRight size={15} /></button></header>
        {expired.length ? <><div className="queue-column-labels"><span>Member</span><span>Expired on</span><span aria-hidden="true" /></div><div className="attention-list">{expired.slice(0, 6).map(({ member, membership }) => <div className="attention-row" key={member.id}><button className="member-cell" onClick={() => onMember(member.id)} aria-label={`View ${nameOf(member)}`}><MemberIdentity member={member} /></button><div className="attention-expiry"><span>{membership ? formatDate(membership.endDate) : "No membership"}</span><small>{membership ? `${planLabel(membership.membershipType)} membership` : "No period recorded"}</small></div><button className="renew-link" onClick={() => onMember(member.id, "membership")} aria-label={`Renew ${nameOf(member)}`}>Renew <ArrowRight size={15} /></button></div>)}</div><div className="panel-footnote">{expired.length > 6 ? `Showing 6 of ${expired.length} expired memberships` : `${expired.length} ${expired.length === 1 ? "membership needs" : "memberships need"} renewal`}</div></> : <Empty title="You're all caught up" message="Expired memberships will appear here when it's time to renew." />}
      </section>
      <aside className="desk-actions"><h2>At the front desk</h2><button className="desk-action" onClick={() => onNavigate("checkin")}><span className="action-icon"><ScanLine size={19} /></span><span><strong>Check in a member</strong><small>Record a visit after validation.</small></span><ArrowUpRight size={17} /></button><button className="desk-action" onClick={onAdd}><span className="action-icon"><Plus size={20} /></span><span><strong>Welcome a new member</strong><small>Create a profile and membership.</small></span><ArrowUpRight size={17} /></button><button className="desk-action" onClick={() => onOpen("ALL")}><span className="action-icon"><Users size={19} /></span><span><strong>Find a member</strong><small>Search, review, or update a record.</small></span><ArrowUpRight size={17} /></button><div className="desk-note"><span className="note-rule" /><h3>Memberships, kept in order.</h3><p>Renew a membership from the roster. Every previous period stays in the member's history.</p><button className="text-link" onClick={() => onOpen("ALL")}>Open member roster <ArrowRight size={15} /></button></div></aside>
    </div>
    <section className="attention-panel today-panel"><header className="panel-header"><div><h2>Today's attendance <span className="count-label">{todaysVisits.length}</span></h2><p>Recent check-ins at the front desk.</p></div><button className="text-link" onClick={() => onNavigate("attendance")}>View history <ArrowUpRight size={15} /></button></header>{todaysVisits.length ? <div className="visit-list">{todaysVisits.slice(0, 8).map(checkin => { const member = members.find(item => item.id === checkin.memberId); return <div className="visit-row" key={checkin.id}><div><strong>{checkin.firstName} {checkin.lastName}</strong><small>{checkin.memberNo}</small></div><span>{formatTime(checkin.checkedInAt)}</span>{member ? <StatusMark status={statusOf(latest(memberships, member.id))} /> : null}</div>; })}</div> : <Empty title="No check-ins yet" message="Today's visits will appear here after the first check-in." />}</section>
  </div>;
}
function Summary({ label, value, note, tone = "", onClick }: { label: string; value: number; note: string; tone?: string; onClick: () => void }) {
  return <button className={`summary-item ${tone}`} onClick={onClick}><span className="summary-label">{tone ? <span className="summary-dot" /> : null}{label}</span><div><strong>{String(value).padStart(2, "0")}</strong><ArrowUpRight size={19} /></div><small>{note}</small></button>;
}

export function Roster({ members, memberships, filter, onFilter, query, onQuery, onOpen, onAdd, loading, onRefresh }: Records & { filter: MemberStatusFilter; onFilter: (filter: MemberStatusFilter) => void; query: string; onQuery: (value: string) => void; onOpen: (id: string) => void; onAdd: () => void; loading: boolean; onRefresh: () => void }) {
  const searchRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !document.querySelector("dialog[open]") && !target.matches("input, textarea, select, [contenteditable]")) { event.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);
  const rows = members.map(member => ({ member, membership: latest(memberships, member.id) }));
  const active = rows.filter(row => statusOf(row.membership) === "ACTIVE").length;
  const expiring = rows.filter(row => expiringSoon(row.membership)).length;
  const results = rows.filter(({ member, membership }) => {
    const text = [member.memberNo, member.firstName, member.lastName, member.email, categoryLabel(member.category), membership ? planLabel(membership.membershipType) : ""].join(" ").toLowerCase();
    return (filter === "ALL" || (filter === "EXPIRING" ? expiringSoon(membership) : statusOf(membership) === filter)) && text.includes(query.trim().toLowerCase());
  });
  return <section className="roster" aria-label="Member roster">
    <div className="roster-toolbar"><SearchField value={query} onChange={onQuery} inputRef={searchRef} /><div className="roster-total"><Users size={15} /><span>{members.length} {members.length === 1 ? "member" : "members"} in your gym</span></div><IconButton label="Refresh member records" onClick={onRefresh} disabled={loading}><RefreshCw size={17} className={loading ? "is-spinning" : ""} /></IconButton></div>
    <div className="roster-filter-bar"><div className="filter-tabs" role="group" aria-label="Member status filter">{([["ALL", "All members", members.length], ["ACTIVE", "Active", active], ["EXPIRING", "Expiring soon", expiring], ["EXPIRED", "Expired", members.length - active]] as const).map(([key, label, count]) => <button key={key} className={filter === key ? "is-active" : ""} aria-pressed={filter === key} onClick={() => onFilter(key)}>{label}<span>{count}</span></button>)}</div><span className="result-count" role="status">{results.length} {results.length === 1 ? "result" : "results"}</span></div>
    {results.length ? <><div className="member-table-wrap"><table className="member-table"><thead><tr><th scope="col">Member <ArrowDown size={12} aria-label="Ordered by member number" /></th><th scope="col">Plan</th><th scope="col">Expires</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Action</span></th></tr></thead><tbody>{results.map(({ member, membership }) => <tr key={member.id}><td><button className="member-cell" onClick={() => onOpen(member.id)} aria-label={`View ${nameOf(member)}`}><MemberIdentity member={member} /></button></td><td><span className="cell-primary">{membership ? planLabel(membership.membershipType) : "No membership"}</span><span className="cell-secondary">{categoryLabel(member.category)}</span></td><td className="date-cell">{membership ? formatDate(membership.endDate) : "—"}</td><td><StatusMark status={statusOf(membership)} /></td><td className="table-action"><button aria-label={`Open ${nameOf(member)}`} className="row-action" onClick={() => onOpen(member.id)}>View <ChevronRight size={15} /></button></td></tr>)}</tbody></table></div>
    <div className="member-list">{results.map(({ member, membership }) => <button key={member.id} className="member-list-row" onClick={() => onOpen(member.id)}><MemberIdentity member={member} /><StatusMark status={statusOf(membership)} /><span className="mobile-plan">{membership ? planLabel(membership.membershipType) : "No membership"} · {categoryLabel(member.category)}</span><span className="mobile-expiry">{membership ? `Expires ${formatDate(membership.endDate)}` : "No period recorded"}<ChevronRight size={14} /></span></button>)}</div>
    <div className="roster-bottom"><span>Showing {results.length} of {members.length} members</span><span>Select a member to view their profile <ArrowUpRight size={13} /></span></div></> : <Empty title={members.length ? "No matching members" : "Your roster starts here"} message={members.length ? "Try a different name, member number, email, or status." : "Add your first member to start managing memberships."}><Button variant="secondary" onClick={members.length ? () => { onQuery(""); onFilter("ALL"); } : onAdd}>{members.length ? "Clear search and filters" : "Add member"}</Button></Empty>}
  </section>;
}
