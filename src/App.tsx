import React from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { AppShell, Dashboard, PageHeader, Roster } from "./Operations";
import { AttendancePage, CheckinPage, ReportsPage } from "./Activity";
import { AssistantWidget } from "./AssistantWidget";
import { AddMemberDialog, DeleteDialog, DuplicateNameDialog, MemberDrawer } from "./MemberProfile";
import { Button, Toast } from "./ui";
import { DEMO_MODE, compareMemberNo, formatDate, messageFor, nameOf, nextNumber, planLabel, request, today, type Checkin, type DetailMode, type Member, type MemberForm, type Membership, type MembershipType, type MemberStatusFilter, type ToastState, type View } from "./model";

export default function App() {
  const [view, setView] = React.useState<View>("dashboard");
  const [filter, setFilter] = React.useState<MemberStatusFilter>("ALL");
  const [query, setQuery] = React.useState("");
  const [members, setMembers] = React.useState<Member[]>([]);
  const [memberships, setMemberships] = React.useState<Membership[]>([]);
  const [checkins, setCheckins] = React.useState<Checkin[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<DetailMode>("view");
  const [addOpen, setAddOpen] = React.useState(false);
  const [duplicateForm, setDuplicateForm] = React.useState<MemberForm | null>(null);
  const [deleting, setDeleting] = React.useState<Member | null>(null);
  const [toast, setToast] = React.useState<ToastState | null>(null);
  // Recalculate membership status when a long-running desk session crosses midnight.
  const [date, setDate] = React.useState(today());
  React.useEffect(() => { const timer = window.setInterval(() => setDate(today()), 30000); return () => window.clearInterval(timer); }, []);
  const selectedMember = members.find(member => member.id === selected) ?? null;
  const load = React.useCallback(async (announce = false) => {
    setLoading(true);
    try {
      const [snapshot, attendance] = await Promise.all([request<{ members: Member[]; memberships: Membership[] }>("/api/members"), request<{ checkins: Checkin[] }>("/api/attendance")]);
      setMembers([...snapshot.members].sort(compareMemberNo));
      setMemberships(snapshot.memberships);
      setCheckins(attendance.checkins);
      setError(null);
      if (announce) setToast({ type: "success", title: "Records refreshed", message: "Member records are up to date." });
    } catch (cause) { setError(messageFor(cause, "Unable to load member records.")); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => {
    if (!toast || toast.type === "error") return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const openMembers = (nextFilter: MemberStatusFilter = "ALL") => { setQuery(""); setFilter(nextFilter); setView("members"); };
  const openMember = (id: string, nextMode: DetailMode = "view") => { setSelected(id); setMode(nextMode); };
  function report(cause: unknown, title: string) { setToast({ type: "error", title, message: messageFor(cause, "Please try again.") }); }
  function hasMatchingName(form: MemberForm) {
    const firstName = form.firstName.trim().toLocaleLowerCase();
    const lastName = form.lastName.trim().toLocaleLowerCase();
    return members.some(member => member.firstName.trim().toLocaleLowerCase() === firstName && member.lastName.trim().toLocaleLowerCase() === lastName);
  }
  async function addMember(form: MemberForm, confirmedDuplicate = false) {
    if (!confirmedDuplicate && hasMatchingName(form)) {
      setDuplicateForm(form);
      return;
    }
    try {
      const result = await request<{ member: Member; membership: Membership }>("/api/members", { method: "POST", body: JSON.stringify({ memberNo: form.memberNo.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), category: form.category, membershipType: form.membershipType, startDate: form.startDate }) });
      setMembers(current => [...current, result.member].sort(compareMemberNo));
      setMemberships(current => [result.membership, ...current]);
      setDuplicateForm(null);
      setAddOpen(false);
      openMembers();
      openMember(result.member.id);
      setToast({ type: "success", title: "Member added", message: `${nameOf(result.member)} is ready in your roster.` });
    } catch (cause) { report(cause, "Member not added"); throw cause; }
  }
  async function saveMember(id: string, form: MemberForm) {
    try {
      const updated = await request<Member>(`/api/members/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ memberNo: form.memberNo.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), category: form.category }) });
      setMembers(current => current.map(item => item.id === id ? updated : item).sort(compareMemberNo));
      setMode("view");
      setToast({ type: "success", title: "Member updated", message: `${nameOf(updated)} was saved.` });
    } catch (cause) { report(cause, "Member not updated"); throw cause; }
  }
  async function saveMembership(id: string, membershipType: MembershipType, startDate: string) {
    try {
      const membership = await request<Membership>(`/api/members/${encodeURIComponent(id)}/memberships`, { method: "POST", body: JSON.stringify({ membershipType, startDate }) });
      setMemberships(current => [membership, ...current]);
      setMode("view");
      setToast({ type: "success", title: "Membership saved", message: `${planLabel(membership.membershipType)} period ends ${formatDate(membership.endDate)}.` });
    } catch (cause) { report(cause, "Membership not updated"); throw cause; }
  }
  async function removeMember(id: string) {
    const member = members.find(item => item.id === id);
    try {
      await request(`/api/members/${encodeURIComponent(id)}`, { method: "DELETE" });
      setMembers(current => current.filter(item => item.id !== id));
      setMemberships(current => current.filter(item => item.memberId !== id));
      setCheckins(current => current.filter(item => item.memberId !== id));
      setDeleting(null);
      setSelected(null);
      setToast({ type: "success", title: "Member deleted", message: member ? `${nameOf(member)} and their membership history were removed.` : "Member was removed." });
    } catch (cause) { report(cause, "Member not deleted"); throw cause; }
  }
  async function checkIn(member: Member) {
    try {
      const record = await request<Checkin>("/api/attendance", { method: "POST", body: JSON.stringify({ memberId: member.id }) });
      setCheckins(current => [{ ...record, memberNo: member.memberNo, firstName: member.firstName, lastName: member.lastName }, ...current]);
      setToast({ type: "success", title: "Check-in recorded", message: `${nameOf(member)} checked in successfully.` });
    } catch (cause) { report(cause, "Check-in not recorded"); throw cause; }
  }
  async function resetDemo() {
    if (!DEMO_MODE) return;
    const { resetDemo: reset } = await import("./demo");
    reset();
    setSelected(null);
    setView("dashboard");
    await load();
    setToast({ type: "success", title: "Sample data restored", message: "The portfolio demo is back to its starting records." });
  }
  return <>
    <AppShell view={view} onNavigate={next => { if (next === "members") openMembers(); else setView(next); }} onResetDemo={() => void resetDemo()} loading={loading} error={!!error} date={date}>
      <PageHeader view={view} onAdd={() => setAddOpen(true)} />
      {error ? <div className="inline-alert" role="alert"><AlertCircle size={18} /><div><strong>Member records could not be refreshed</strong><p>{error}{members.length ? " Showing the last loaded records." : ""}</p></div><Button variant="secondary" disabled={loading} onClick={() => void load()}>{loading ? "Retrying…" : "Try again"}</Button></div> : null}
      {loading && !members.length ? <div className="loading-state" role="status"><span>Loading gym records…</span><div className="skeleton-summary" /><div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" /></div> : error && !members.length ? null : view === "dashboard" ? <Dashboard members={members} memberships={memberships} checkins={checkins} onOpen={openMembers} onMember={openMember} onAdd={() => setAddOpen(true)} onNavigate={setView} /> : view === "members" ? <Roster members={members} memberships={memberships} filter={filter} onFilter={setFilter} query={query} onQuery={setQuery} onOpen={openMember} onAdd={() => setAddOpen(true)} loading={loading} onRefresh={() => void load(true)} /> : view === "checkin" ? <CheckinPage members={members} memberships={memberships} checkins={checkins} onCheckin={checkIn} onMember={openMember} /> : view === "attendance" ? <AttendancePage members={members} memberships={memberships} checkins={checkins} onMember={openMember} /> : <ReportsPage members={members} memberships={memberships} checkins={checkins} onMember={openMember} />}
      <footer className="workspace-footer"><span>Gym <span aria-hidden="true">/</span> Member operations</span>{view === "members" ? <span>Ordered by member number</span> : <button disabled={loading} onClick={() => void load(true)}><RefreshCw size={13} className={loading ? "is-spinning" : ""} />{loading ? "Refreshing" : "Refresh records"}</button>}</footer>
    </AppShell>
    <AssistantWidget />
    {selectedMember ? <MemberDrawer key={selectedMember.id} member={selectedMember} memberships={memberships.filter(item => item.memberId === selectedMember.id)} mode={mode} onMode={setMode} onClose={() => setSelected(null)} onSave={saveMember} onRenew={saveMembership} onDelete={() => setDeleting(selectedMember)} /> : null}
    {addOpen ? <AddMemberDialog memberNo={nextNumber(members)} memberNos={members.map(member => member.memberNo)} onClose={() => setAddOpen(false)} onSave={addMember} /> : null}
    {duplicateForm ? <DuplicateNameDialog form={duplicateForm} onCancel={() => setDuplicateForm(null)} onConfirm={() => addMember(duplicateForm, true)} /> : null}
    {deleting ? <DeleteDialog member={deleting} onCancel={() => setDeleting(null)} onConfirm={removeMember} /> : null}
    <Toast toast={toast} onDismiss={() => setToast(null)} />
  </>;
}
