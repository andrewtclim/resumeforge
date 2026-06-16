import { useState } from "react";

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function ApplyPrompt({ resume, jobInput, onLog, onDismiss }) {
  const [state, setState] = useState("prompt"); // prompt | form | logged
  const [form, setForm] = useState({
    date: today(),
    url: jobInput.jobUrl || "",
    notes: "",
  });

  if (state === "logged") {
    return <div className="apply-logged">Logged! Application saved to Tracker.</div>;
  }

  if (state === "form") {
    const handleSubmit = async (e) => {
      e.preventDefault();
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
          Notes (optional)
          <input
            placeholder="Referred by..., deadline..., etc."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </label>
        <div className="apply-prompt-actions">
          <button type="button" className="btn-ghost btn-small" onClick={() => setState("prompt")}>
            Back
          </button>
          <button type="submit" className="btn-primary btn-small">
            Save Application
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
