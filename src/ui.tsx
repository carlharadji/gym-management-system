import React from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, CircleAlert, Search, X } from "lucide-react";
import { nameOf, type Member, type Status, type ToastState } from "./model";

const openModals: HTMLDialogElement[] = [];
const modalListeners = new Set<() => void>();
let bodyOverflowBeforeModals = "";
const subscribeToModals = (listener: () => void) => { modalListeners.add(listener); return () => { modalListeners.delete(listener); }; };
const modalHost = () => openModals[openModals.length - 1] ?? document.body;

function registerModal(dialog: HTMLDialogElement) {
  if (!openModals.length) bodyOverflowBeforeModals = document.body.style.overflow;
  openModals.push(dialog);
  document.body.style.overflow = "hidden";
  modalListeners.forEach(listener => listener());
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openModals.splice(openModals.indexOf(dialog), 1);
    if (!openModals.length) document.body.style.overflow = bodyOverflowBeforeModals;
    modalListeners.forEach(listener => listener());
  };
}

function restoreModalFocus(previous: HTMLElement | null) {
  // Wait until all sibling removals and replacement dialogs have committed.
  queueMicrotask(() => {
    const activeModal = openModals[openModals.length - 1];
    if (activeModal) {
      if (activeModal.contains(document.activeElement)) return;
      const target = previous?.isConnected && activeModal.contains(previous)
        ? previous
        : activeModal.querySelector<HTMLElement>("[autofocus]:not(:disabled), button:not(:disabled), input:not(:disabled), [tabindex='0']");
      target?.focus({ preventScroll: true });
      return;
    }
    const canRestore = previous?.isConnected && previous.getClientRects().length && !previous.matches(":disabled") && !previous.closest("dialog:not([open]), [inert]");
    (canRestore ? previous : document.getElementById("main-content"))?.focus({ preventScroll: true });
  });
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "text"; icon?: React.ReactNode };
export function Button({ variant = "primary", icon, children, className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={`button button-${variant} ${className}`} {...props}>{icon}{children}</button>;
}
export function IconButton({ label, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" className="icon-button" aria-label={label} title={label} {...props}>{children}</button>;
}
export function StatusMark({ status }: { status: Status }) {
  return <span className={`status-mark ${status.toLowerCase()}`}><span aria-hidden="true" />{status === "ACTIVE" ? "Active" : "Expired"}</span>;
}
export function Avatar({ member, large = false }: { member: Member; large?: boolean }) {
  return <span aria-hidden="true" className={`avatar ${large ? "avatar-large" : ""}`}>{member.firstName.charAt(0)}{member.lastName.charAt(0)}</span>;
}
export function MemberIdentity({ member }: { member: Member }) {
  return <span className="member-identity"><Avatar member={member} /><span><strong>{nameOf(member)}</strong><small>{member.memberNo}</small></span></span>;
}
export function SearchField({ value, onChange, inputRef, onKeyDown }: { value: string; onChange: (value: string) => void; inputRef?: React.Ref<HTMLInputElement>; onKeyDown?: React.KeyboardEventHandler<HTMLInputElement> }) {
  return <div className="search-field"><Search size={19} aria-hidden="true" /><input ref={inputRef} type="search" value={value} onChange={event => onChange(event.target.value)} onKeyDown={onKeyDown} placeholder="Find a member by name, number or email" aria-label="Find a member" autoComplete="off" />{value ? <IconButton label="Clear search" onClick={() => onChange("")}><X size={16} /></IconButton> : <kbd aria-hidden="true">/</kbd>}</div>;
}
export function Empty({ title, message, children }: { title: string; message: string; children?: React.ReactNode }) {
  return <div className="empty-state"><h3>{title}</h3><p>{message}</p>{children}</div>;
}
export function Modal({ title, description, children, onClose, drawer = false, busy = false, onBack }: { title: string; description?: string; children: React.ReactNode; onClose: () => void; drawer?: boolean; busy?: boolean; onBack?: () => void }) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const previousFocus = React.useRef(document.activeElement as HTMLElement | null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const [closing, setClosing] = React.useState(false);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const requestClose = () => { if (!busy) setClosing(true); };
  React.useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = previousFocus.current;
    dialog.showModal();
    const release = registerModal(dialog);
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      release();
      restoreModalFocus(previous);
    };
  }, []);
  React.useEffect(() => {
    if (!closing) return;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160;
    const timer = window.setTimeout(() => onCloseRef.current(), duration);
    return () => window.clearTimeout(timer);
  }, [closing]);
  return <dialog ref={ref} className={`modal ${drawer ? "member-drawer" : "center-dialog"} ${closing ? "is-closing" : ""}`} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} onCancel={event => { event.preventDefault(); requestClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) requestClose();
  }}><header className="modal-header"><div className="modal-heading">{onBack ? <IconButton label="Back to profile" onClick={onBack} disabled={busy}><ArrowLeft size={19} /></IconButton> : null}<div><h2 id={titleId}>{title}</h2>{description ? <p id={descriptionId}>{description}</p> : null}</div></div><IconButton label={drawer ? "Close member details" : "Close dialog"} onClick={requestClose} disabled={busy}><X size={20} /></IconButton></header><div className="modal-content">{children}</div></dialog>;
}
export function Toast({ toast, onDismiss }: { toast: ToastState | null; onDismiss: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const host = React.useSyncExternalStore(subscribeToModals, modalHost);
  const [displayed, setDisplayed] = React.useState(toast);
  React.useEffect(() => {
    const element = ref.current;
    if (toast) { setDisplayed(toast); if (element?.isConnected) element.showPopover(); }
    else { const timer = window.setTimeout(() => { if (element?.isConnected) element.hidePopover(); setDisplayed(null); }, 160); return () => window.clearTimeout(timer); }
  }, [toast, host]);
  // A modal makes outside content inert, including unrelated top-layer popovers.
  return createPortal(<div ref={ref} popover="manual" role={displayed?.type === "error" ? "alert" : "status"} className={`toast ${displayed?.type ?? "success"} ${toast ? "" : "is-closing"}`}><span className="toast-icon">{displayed?.type === "error" ? <CircleAlert size={19} /> : <Check size={19} />}</span><div><strong>{displayed?.title}</strong><p>{displayed?.message}</p></div><IconButton label="Dismiss notification" onClick={onDismiss}><X size={17} /></IconButton></div>, host);
}
