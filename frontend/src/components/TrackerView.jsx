import { useState } from "react";

const WORK_TYPE_OPTIONS = ["", "remote", "hybrid", "onsite"];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const EMPTY_FORM = {
  date: today(),
  company: "",
  job_title: "",
  applied: false,
  url: "",
  work_type: "",
  location: "",
  notes: "",
};

function WorkTypeBadge({ value }) {
  if (!value) return <span className="badge badge-pending">—</span>;
  return <span className={`badge badge-${value}`}>{value}</span>;
}

function ApplicationModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-title">{initial.id ? "Edit Application" : "Add Application"}</div>
        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-form-row">
            <label>
              Company *
              <input
                required
                value={form.company}
                onChange={(e) => set("company", e.target.value)}
                placeholder="Acme Corp"
              />
            </label>
            <label>
              Job Title *
              <input
                required
                value={form.job_title}
                onChange={(e) => set("job_title", e.target.value)}
                placeholder="ML Engineer"
              />
            </label>
          </div>
          <div className="modal-form-row">
            <label>
              Date
              <input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </label>
            <label>
              Work Type
              <select value={form.work_type} onChange={(e) => set("work_type", e.target.value)}>
                {WORK_TYPE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o || "Not specified"}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Location
            <input
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="San Francisco, CA"
            />
          </label>
          <label>
            Job URL
            <input
              type="url"
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label>
            Notes
            <input
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Referred by..."
            />
          </label>
          <label style={{ flexDirection: "row", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.applied}
              onChange={(e) => set("applied", e.target.checked)}
            />
            <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)", textTransform: "none", letterSpacing: 0 }}>
              Applied
            </span>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn-ghost btn-small" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary btn-small">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TrackerView({ tracker }) {
  const { applications, loading, error, add, update, remove } = tracker;
  const [modal, setModal] = useState(null); // null | { mode: "add" | "edit", entry }

  const handleSave = async (form) => {
    if (modal.mode === "add") {
      await add(form);
    } else {
      const { id, ...patch } = form;
      await update(id, patch);
    }
    setModal(null);
  };

  const handleAppliedToggle = async (app) => {
    await update(app.id, { applied: !app.applied });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this application?")) return;
    await remove(id);
  };

  return (
    <div className="tracker-view">
      <div className="tracker-header">
        <span className="tracker-title">Applications</span>
        <button
          className="btn-primary btn-small"
          onClick={() => setModal({ mode: "add", entry: {} })}
        >
          + Add Application
        </button>
      </div>

      {loading && (
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading...</p>
      )}

      {error && (
        <div className="error-banner">{error}</div>
      )}

      {!loading && !error && applications.length === 0 && (
        <div className="tracker-table-wrap">
          <div className="tracker-empty">
            No applications yet.<br />
            Tailor a resume and log it, or add one manually.
          </div>
        </div>
      )}

      {applications.length > 0 && (
        <div className="tracker-table-wrap">
          <table className="tracker-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Company</th>
                <th>Role</th>
                <th>Type</th>
                <th>Location</th>
                <th>Applied</th>
                <th>URL</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{app.date}</td>
                  <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{app.company}</td>
                  <td>{app.job_title}</td>
                  <td><WorkTypeBadge value={app.work_type} /></td>
                  <td>{app.location || <span style={{ color: "var(--text-muted)" }}>—</span>}</td>
                  <td className="applied-cell">
                    <input
                      type="checkbox"
                      checked={app.applied}
                      onChange={() => handleAppliedToggle(app)}
                      style={{ cursor: "pointer" }}
                    />
                  </td>
                  <td className="url-cell">
                    {app.url ? (
                      <a href={app.url} target="_blank" rel="noreferrer">Link</a>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>—</span>
                    )}
                  </td>
                  <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {app.notes || <span style={{ color: "var(--text-muted)" }}>—</span>}
                  </td>
                  <td className="actions-cell">
                    <button
                      className="btn-ghost btn-small"
                      onClick={() => setModal({ mode: "edit", entry: app })}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-ghost btn-small"
                      style={{ color: "var(--error)", borderColor: "var(--error)" }}
                      onClick={() => handleDelete(app.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ApplicationModal
          initial={modal.mode === "edit" ? modal.entry : {}}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
