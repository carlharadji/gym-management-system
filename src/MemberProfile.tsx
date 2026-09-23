import React from "react";
import { AlertTriangle, ArrowRight, CalendarDays, Pencil, Trash2 } from "lucide-react";
import {
  blankForm,
  categoryLabel,
  endDate,
  formatDate,
  latest,
  messageFor,
  nameOf,
  planLabel,
  planOf,
  statusOf,
  today,
  type DetailMode,
  type Member,
  type MemberForm as MemberFormValues,
  type Membership,
  type MembershipType,
} from "./model";
import { Avatar, Button, Modal, StatusMark } from "./ui";

type MemberDrawerProps = {
  member: Member;
  memberships: Membership[];
  mode: DetailMode;
  onMode: (mode: DetailMode) => void;
  onClose: () => void;
  onSave: (id: string, form: MemberFormValues) => Promise<void>;
  onRenew: (id: string, plan: MembershipType, start: string) => Promise<void>;
  onDelete: () => void;
};

export function MemberDrawer({ member, memberships, mode, onMode, onClose, onSave, onRenew, onDelete }: MemberDrawerProps) {
  const [busy, setBusy] = React.useState(false);
  const current = latest(memberships, member.id);
  const status = statusOf(current);
  const ordered = [...memberships].sort((a, b) => b.endDate.localeCompare(a.endDate) || b.createdAt.localeCompare(a.createdAt));
  const title = mode === "view" ? "Member profile" : mode === "edit" ? "Edit member" : status === "EXPIRED" ? "Renew membership" : "Update membership";

  return <Modal drawer title={title} onClose={onClose} busy={busy} onBack={mode === "view" ? undefined : () => onMode("view")}>
    {mode === "edit" ? <MemberForm
      key={member.id}
      initial={{
        memberNo: member.memberNo,
        firstName: member.firstName,
        lastName: member.lastName,
        email: member.email,
        category: member.category,
        membershipType: planOf(current),
        startDate: current?.startDate ?? today(),
        endDate: current?.endDate ?? today(),
      }}
      label="Save changes"
      hideMembership
      onSave={form => onSave(member.id, form)}
      onCancel={() => onMode("view")}
      onBusyChange={setBusy}
    /> : mode === "membership" ? <MembershipForm
      key={member.id}
      member={member}
      current={current}
      onSave={(plan, start) => onRenew(member.id, plan, start)}
      onCancel={() => onMode("view")}
      onBusyChange={setBusy}
    /> : <>
      <div className="profile-hero">
        <Avatar member={member} large />
        <div>
          <h3 className="profile-name">{nameOf(member)}</h3>
          <p className="profile-member-number">{member.memberNo}</p>
        </div>
      </div>

      <section className="profile-membership" aria-labelledby="current-membership-heading">
        <div className="membership-heading">
          <div><span>Current membership</span><h3 id="current-membership-heading">{current ? `${planLabel(current.membershipType)} membership` : "No membership"}</h3></div>
          <StatusMark status={status} />
        </div>
        {current ? <dl className="membership-dates">
          <div><dt>Started</dt><dd>{formatDate(current.startDate)}</dd></div>
          <div><dt>{status === "EXPIRED" ? "Expired" : "Expires"}</dt><dd>{formatDate(current.endDate)}</dd></div>
        </dl> : <p className="form-help">Add a membership period to get this member started.</p>}
        <div className="profile-actions">
          <Button icon={<CalendarDays size={16} aria-hidden="true" />} onClick={() => onMode("membership")}>{status === "EXPIRED" ? "Renew membership" : "Update membership"}</Button>
          <Button variant="secondary" icon={<Pencil size={15} aria-hidden="true" />} onClick={() => onMode("edit")}>Edit profile</Button>
        </div>
      </section>

      <section className="profile-section" aria-labelledby="profile-details-heading">
        <h3 id="profile-details-heading">Member details</h3>
        <dl className="profile-data">
          <div><dt>Email address</dt><dd>{member.email || "Not provided"}</dd></div>
          <div><dt>Classification</dt><dd>{categoryLabel(member.category)}</dd></div>
        </dl>
      </section>

      <section className="profile-section" aria-labelledby="membership-history-heading">
        <div className="history-heading"><h3 id="membership-history-heading">Membership history</h3><span className="history-count">{ordered.length} {ordered.length === 1 ? "period" : "periods"}</span></div>
        {ordered.length ? <ol className="history-list">
          {ordered.map(item => <li className="history-row" key={item.id}>
            <div className="history-period"><strong>{planLabel(item.membershipType)}</strong><span>{formatDate(item.startDate)}<span aria-hidden="true"> – </span><span className="sr-only"> to </span>{formatDate(item.endDate)}</span></div>
            <StatusMark status={statusOf(item)} />
          </li>)}
        </ol> : <p className="no-history">No membership periods yet.</p>}
      </section>

      <button type="button" className="delete-link" onClick={onDelete}><Trash2 size={15} aria-hidden="true" />Delete member</button>
    </>}
  </Modal>;
}

export function AddMemberDialog({ memberNo, memberNos, onClose, onSave }: { memberNo: string; memberNos: string[]; onClose: () => void; onSave: (form: MemberFormValues) => Promise<void> }) {
  const [busy, setBusy] = React.useState(false);
  return <Modal title="Add member" description="Create a profile and their first membership." onClose={onClose} busy={busy}>
    <MemberForm initial={blankForm(memberNo)} label="Add member" onSave={onSave} onCancel={onClose} onBusyChange={setBusy} validateMemberNo={value => memberNos.some(memberNo => memberNo.toLocaleUpperCase() === value.toLocaleUpperCase()) ? `${value} is already assigned to another member.` : null} />
  </Modal>;
}

export function DuplicateNameDialog({ form, onCancel, onConfirm }: { form: MemberFormValues; onCancel: () => void; onConfirm: () => Promise<void> }) {
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`;

  async function confirm() {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      await onConfirm();
    } catch (cause) {
      setError(messageFor(cause, "Unable to add this member. Please try again."));
    } finally {
      setSaving(false);
    }
  }

  return <Modal title="Matching member name" description="A member with this exact name is already in the roster." onClose={onCancel} busy={saving}>
    <div className="duplicate-copy"><AlertTriangle size={22} aria-hidden="true" /><p><strong>{fullName}</strong> may be a different person. Confirm before adding another member with this name.</p></div>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <div className="form-actions">
      <Button variant="secondary" onClick={onCancel} disabled={saving} autoFocus data-autofocus>Review details</Button>
      <Button onClick={() => { void confirm(); }} disabled={saving}>{saving ? "Adding…" : "Add anyway"}</Button>
    </div>
  </Modal>;
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`field${wide ? " field-wide" : ""}`}><span>{label}</span>{children}</label>;
}

function PlanChoice({ value, onChange, label = "Membership plan" }: { value: MembershipType; onChange: (value: MembershipType) => void; label?: string }) {
  const labelId = React.useId();
  return <div className="field field-wide">
    <span id={labelId}>{label}</span>
    <div className="choice-group" role="group" aria-labelledby={labelId}>
      {(["MONTHLY", "DAILY"] as const).map(plan => <button
        className={`choice-button${value === plan ? " is-selected" : ""}`}
        key={plan}
        type="button"
        aria-pressed={value === plan}
        onClick={() => onChange(plan)}
      ><strong>{planLabel(plan)}</strong><span className="choice-description">{plan === "MONTHLY" ? "One month" : "One day"}</span></button>)}
    </div>
  </div>;
}

function MemberForm({ initial, label, hideMembership = false, onSave, onCancel, onBusyChange, validateMemberNo }: {
  initial: MemberFormValues;
  label: string;
  hideMembership?: boolean;
  onSave: (form: MemberFormValues) => Promise<void>;
  onCancel: () => void;
  onBusyChange: (busy: boolean) => void;
  validateMemberNo?: (memberNo: string) => string | null;
}) {
  const [form, setForm] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [memberNumber, setMemberNumber] = React.useState(form.memberNo.replace(/^GM-/i, "").replace(/\D/g, "").slice(0, 4));

  function set(field: keyof MemberFormValues, value: string) {
    setForm(current => {
      const next = { ...current, [field]: value } as MemberFormValues;
      if (field === "membershipType" || field === "startDate") next.endDate = endDate(next.startDate, next.membershipType);
      return next;
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const memberNo = `GM-${memberNumber.padStart(4, "0")}`;
    const validationError = validateMemberNo?.(memberNo);
    setError(null);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    onBusyChange(true);
    try {
      await onSave({ ...form, memberNo });
    } catch (cause) {
      setError(messageFor(cause, "Unable to save this member. Please try again."));
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  return <form className="product-form" onSubmit={submit} aria-busy={saving}>
    <fieldset className="form-section" disabled={saving}>
      <legend className="form-section-heading">Personal details</legend>
      <div className="form-grid">
        <Field label="First name"><input required autoFocus data-autofocus name="firstName" autoComplete="given-name" value={form.firstName} onChange={event => set("firstName", event.target.value)} /></Field>
        <Field label="Last name"><input required name="lastName" autoComplete="family-name" value={form.lastName} onChange={event => set("lastName", event.target.value)} /></Field>
        <Field label="Email address (optional)" wide><input type="email" name="email" autoComplete="email" value={form.email} onChange={event => set("email", event.target.value)} /></Field>
        <Field label="Member number"><div className="member-number-input"><span aria-hidden="true">GM-</span><input required name="memberNo" type="text" inputMode="numeric" maxLength={4} autoComplete="off" spellCheck={false} value={memberNumber} onChange={event => { const value = event.target.value.replace(/\D/g, "").slice(0, 4); setMemberNumber(value); set("memberNo", `GM-${value}`); }} onBlur={() => { if (!memberNumber) return; const value = memberNumber.padStart(4, "0"); setMemberNumber(value); set("memberNo", `GM-${value}`); }} aria-label="Member number, up to four digits" /></div></Field>
        <Field label="Classification"><select name="category" value={form.category} onChange={event => set("category", event.target.value)}><option value="REGULAR">Regular</option><option value="STUDENT">Student</option></select></Field>
      </div>
    </fieldset>

    {!hideMembership ? <fieldset className="form-section" disabled={saving}>
      <legend className="form-section-heading">First membership</legend>
      <div className="form-grid">
        <PlanChoice value={form.membershipType} onChange={value => set("membershipType", value)} />
        <Field label="Start date"><input required type="date" name="startDate" value={form.startDate} onChange={event => set("startDate", event.target.value)} /></Field>
        <Field label="Calculated expiration"><input type="date" className="form-expiry" readOnly value={form.startDate ? form.endDate : ""} /></Field>
      </div>
      <p className="form-help">Expiration is calculated from the selected plan and start date.</p>
    </fieldset> : null}

    {error ? <p className="form-error" role="alert"><AlertTriangle size={16} aria-hidden="true" />{error}</p> : null}
    <div className="form-actions">
      <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
      <Button type="submit" disabled={saving}>{saving ? "Saving…" : label}</Button>
    </div>
  </form>;
}

function MembershipForm({ member, current, onCancel, onSave, onBusyChange }: {
  member: Member;
  current?: Membership;
  onCancel: () => void;
  onSave: (plan: MembershipType, start: string) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const [plan, setPlan] = React.useState<MembershipType>(planOf(current));
  const [start, setStart] = React.useState(today());
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const expiry = endDate(start, plan);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    setSaving(true);
    onBusyChange(true);
    try {
      await onSave(plan, start);
    } catch (cause) {
      setError(messageFor(cause, "Unable to save the membership. Please try again."));
    } finally {
      setSaving(false);
      onBusyChange(false);
    }
  }

  return <form className="product-form renewal-form" onSubmit={submit} aria-busy={saving}>
    <div className="renewal-context"><Avatar member={member} /><div><strong>{nameOf(member)}</strong><span>{member.memberNo}</span></div></div>
    <fieldset className="form-section" disabled={saving}>
      <legend className="form-section-heading">New membership period</legend>
      <div className="form-grid">
        <PlanChoice value={plan} onChange={setPlan} />
        <Field label="Start date"><input required autoFocus data-autofocus name="startDate" type="date" value={start} onChange={event => setStart(event.target.value)} /></Field>
        <Field label="Calculated expiration"><input className="form-expiry" type="date" readOnly value={start ? expiry : ""} /></Field>
      </div>
    </fieldset>

    <div className="renewal-comparison" aria-label="Membership period comparison">
      <div className="period-preview"><span>Current period</span><strong>{current ? planLabel(current.membershipType) : "No membership"}</strong><small>{current ? `${formatDate(current.startDate)} – ${formatDate(current.endDate)}` : "No period recorded"}</small></div>
      <ArrowRight size={18} aria-hidden="true" />
      <div className="period-preview is-new"><span>New period</span><strong>{planLabel(plan)}</strong><small>{start ? `${formatDate(start)} – ${formatDate(expiry)}` : "Choose a start date"}</small></div>
    </div>
    <p className="form-help">This adds a new period to the member’s history. Previous periods are kept.</p>

    {error ? <p className="form-error" role="alert"><AlertTriangle size={16} aria-hidden="true" />{error}</p> : null}
    <div className="form-actions">
      <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
      <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save membership"}</Button>
    </div>
  </form>;
}

export function DeleteDialog({ member, onCancel, onConfirm }: { member: Member; onCancel: () => void; onConfirm: (id: string) => Promise<void> }) {
  const [removing, setRemoving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function confirm() {
    if (removing) return;
    setError(null);
    setRemoving(true);
    try {
      await onConfirm(member.id);
    } catch (cause) {
      setError(messageFor(cause, "Unable to delete this member. Please try again."));
    } finally {
      setRemoving(false);
    }
  }

  return <Modal title="Delete member?" onClose={onCancel} busy={removing}>
    <div className="delete-copy">
      <AlertTriangle size={22} aria-hidden="true" />
      <div><p><strong>{nameOf(member)}</strong> ({member.memberNo}) and their entire membership history will be permanently deleted.</p><p>This cannot be undone.</p></div>
    </div>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <div className="form-actions">
      <Button variant="secondary" onClick={onCancel} disabled={removing} autoFocus data-autofocus>Keep member</Button>
      <Button variant="danger" onClick={() => { void confirm(); }} disabled={removing}>{removing ? "Deleting…" : "Delete member"}</Button>
    </div>
  </Modal>;
}
