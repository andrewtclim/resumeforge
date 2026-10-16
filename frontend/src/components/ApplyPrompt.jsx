import { useState } from "react";
import { todayLocal as today } from "../utils/resume";

function buildNotes(tailoringNotes) {
  if (!tailoringNotes) return "";
  if (Array.isArray(tailoringNotes)) return tailoringNotes.join("\n");
  return tailoringNotes;
}

// startInForm skips the "Did you apply?" question (used by Bulk Tailor cards).
export default function ApplyPrompt({ resume, jobInput, onLog, onDismiss, startInForm = false }) {
  const [state, setState] = useState(startInForm ? "form" : "prompt"); // prompt | form | saving | logged | error
  const [form, setForm] = useState({
    date: today(),
    url: jobInput.jobUrl || "",
    notes: buildNotes(resume.tailoring_notes),
  });
  const [saveError, setSaveError] = useState(null);

  if (state === "logged") {
    return <div className="apply-logged">Logged! Application saved to Tracker.</div>;
  }

  if (state === "form" || state === "saving" || state === "error") {
    const handleSubmit = async (e) => {
      e.preventDefault();
      setSaveError(null);
      setState("saving");
      try {
        await onLog({
          company: jobInput.companyName,
          job_title: jobInput.jobTitle,
          applied: true,
          work_type: resume.work_type || "",
          location: resume.location || "",
          ...form,
        });
        setState("logged");
        setTimeout(onDismiss, 1800);
      } catch (err) {
        setSaveError(err?.response?.data?.detail || err?.message || "Failed to save. Try again.");
        setState("error");
      }
    };

    return (
      <form className="apply-form" onSubmit={handleSubmit}>
        <div className="apply-form-row">
          <label>
            Company
            <input value={jobInput.companyName} readOnly />
          </label>
          <label>
            Job Title
            <input value={jobInput.jobTitle} readOnly />
          </label>
        </div>
        <div className="apply-form-row">
          <label>
            Date Applied
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </label>
          <label>
            Work Type
            <input value={resume.work_type || "—"} readOnly />
          </label>
        </div>
        <div className="apply-form-row">
          <label>
            Location
            <input value={resume.location || "—"} readOnly />
          </label>
          <label>
            Job URL
            <input
              type="url"
              placeholder="https://..."
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            />
          </label>
        </div>
        <label>
          Notes (auto-filled from tailoring, editable)
          <textarea
            rows={4}
            placeholder="Why certain experiences were highlighted, referrals, deadlines..."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </label>
        {saveError && (
          <div style={{ color: "var(--error)", fontSize: "0.8rem", marginTop: 4 }}>{saveError}</div>
        )}
        <div className="apply-prompt-actions">
          <button type="button" className="btn-ghost btn-small" onClick={() => (startInForm ? onDismiss() : setState("prompt"))} disabled={state === "saving"}>
            Back
          </button>
          <button type="submit" className="btn-primary btn-small" disabled={state === "saving"}>
            {state === "saving" ? "Saving…" : "Save Application"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="apply-prompt">
      <span className="apply-prompt-text">
        Did you apply to <strong>{jobInput.companyName}</strong> — {jobInput.jobTitle}?
      </span>
      <div className="apply-prompt-actions">
        <button className="btn-ghost btn-small" onClick={onDismiss}>
          Not yet
        </button>
        <button className="btn-primary btn-small" onClick={() => setState("form")}>
          Yes, I applied
        </button>
      </div>
    </div>
  );
}
