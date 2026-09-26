import React from "react";
import { ChevronRight, MessageCircle, Send, X } from "lucide-react";
import { DEMO_MODE, messageFor, request } from "./model";

const suggestedQuestions = [
  "How many active members do we have?",
  "How many people checked in today?",
  "Who expires this week?",
  "Which members haven't visited in 30 days?",
  "Who visited the most this month?",
  "What was our busiest day this month?",
  "Summarize this week's attendance.",
];

type AssistantAnswer = { answer: string; operation: string | null; mode: "local" | "ai" };

export function AssistantWidget() {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const restoreFocusRef = React.useRef(false);
  const [open, setOpen] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [asked, setAsked] = React.useState("");
  const [response, setResponse] = React.useState<AssistantAnswer | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") restoreFocusRef.current = true; };
    document.addEventListener("keydown", onEscape, true);
    return () => document.removeEventListener("keydown", onEscape, true);
  }, [open]);

  async function ask(value = question) {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    setQuestion("");
    setAsked(trimmed);
    setResponse(null);
    setBusy(true);
    setError("");
    try {
      setResponse(await request<AssistantAnswer>("/api/assistant/ask", {
        method: "POST",
        body: JSON.stringify({ question: trimmed }),
      }));
    } catch (cause) {
      setError(messageFor(cause, "Unable to answer right now."));
    } finally {
      setBusy(false);
      if (panelRef.current?.matches(":popover-open") && document.activeElement === document.body) inputRef.current?.focus({ preventScroll: true });
    }
  }

  return <>
    <button ref={triggerRef} type="button" className="assistant-trigger" popoverTarget="gym-assistant" aria-label={open ? "Close assistant" : "Open assistant"} aria-expanded={open} aria-controls="gym-assistant" title={open ? "Close assistant" : "Open assistant"}>
      {open ? <X size={23} strokeWidth={2} /> : <MessageCircle size={23} strokeWidth={2} />}
    </button>
    <div
      ref={panelRef}
      id="gym-assistant"
      className="assistant-panel"
      popover="auto"
      role="dialog"
      aria-labelledby="assistant-title"
      onToggle={event => {
        const isOpen = event.currentTarget.matches(":popover-open");
        setOpen(isOpen);
        if (isOpen) inputRef.current?.focus({ preventScroll: true });
        else if (restoreFocusRef.current) triggerRef.current?.focus({ preventScroll: true });
        restoreFocusRef.current = false;
      }}
    >
      <header className="assistant-panel-header">
        <span className="assistant-panel-mark"><MessageCircle size={18} /></span>
        <div><h2 id="assistant-title">Gym assistant</h2><p>{DEMO_MODE ? "Answers from sample records" : "Answers from your gym records"}</p></div>
        <button type="button" className="assistant-close" aria-label="Close assistant" title="Close assistant" onClick={() => { restoreFocusRef.current = true; panelRef.current?.hidePopover(); }}><X size={18} /></button>
      </header>
      <div className="assistant-panel-content">
        {asked ? <section className="assistant-result" aria-live="polite">
          <span className="assistant-asked">{asked}</span>
          {busy ? <p className="assistant-loading">Checking your records...</p> : error ? <p className="assistant-error" role="alert">{error}</p> : response ? <p className="assistant-answer">{response.answer}</p> : null}
        </section> : null}
        <div className="assistant-suggestions">
          <h3>{asked ? "Ask something else" : "Suggested questions"}</h3>
          {suggestedQuestions.map(value => <button key={value} type="button" onClick={() => void ask(value)} disabled={busy}>{value}<ChevronRight size={15} /></button>)}
        </div>
      </div>
      <form className="assistant-entry" onSubmit={event => { event.preventDefault(); void ask(); }}>
        <label className="sr-only" htmlFor="assistant-question">Ask about members or attendance</label>
        <input ref={inputRef} id="assistant-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={300} placeholder="Ask about your gym..." />
        <button type="submit" disabled={busy || !question.trim()} aria-label="Send question" title="Send question"><Send size={17} /></button>
      </form>
    </div>
  </>;
}
