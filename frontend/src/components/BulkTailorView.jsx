import { useState, useRef, useEffect } from "react";
import { CONCURRENCY_LIMIT, isJobReady } from "../hooks/useBulkTailor";
import DownloadButton from "./DownloadButton";
import ResumePreview from "./ResumePreview";
import { todayLocal } from "../utils/resume";

// Drop a file named wahoo.png/.gif/.jpg/.webp in src/assets to replace the emoji.
const wahooFiles = import.meta.glob("../assets/wahoo.{png,gif,jpg,jpeg,webp}", {
  eager: true,
  import: "default",
});
const WAHOO_SRC = Object.values(wahooFiles)[0];
const CELEBRATION_MS = 1600;

function buildNotes(notes) {
  if (!notes) return "";
  return Array.isArray(notes) ? notes.join("\n") : notes;
}

const STATUS_LABELS = {
  idle: "Ready",
  queued: "Queued",
  scraping: "Scraping…",
  tailoring: "Tailoring…",
  rendering: "Rendering PDF…",
  done: "Done",
  failed: "Failed",
};

function JobCard({ job, locked, bulk, onLog, onReview }) {
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState(null);
  const editable = !locked && (job.status === "idle" || job.status === "failed");
  const set = (patch) => bulk.updateJob(job.id, patch);

  const handleLog = async () => {
    if (logging || job.logged) return;
    setLogging(true);
    setLogError(null);
    try {
      await onLog(job.id, {
        company: job.companyName,
        job_title: job.jobTitle,
        applied: true,
        work_type: job.resume.work_type || "",
        location: job.resume.location || "",
        date: todayLocal(),
        url: job.mode === "url" ? job.url.trim() : "",
        notes: buildNotes(job.resume.tailoring_notes),
      });
    } catch (err) {
      setLogError(err?.response?.data?.detail || err?.message || "Failed to save. Try again.");
    } finally {
      setLogging(false);
    }
  };

  return (
    <div id={`bulk-job-${job.id}`} className={`bulk-card status-${job.status}`}>
      <div className="bulk-card-head">
        <span className={`bulk-status status-${job.status}`}>{STATUS_LABELS[job.status]}</span>
        <button
          type="button"
          className="btn-ghost btn-small"
          onClick={() => bulk.removeJob(job.id)}
          disabled={locked}
          aria-label="Remove job"
        >
          ✕
        </button>
      </div>

      <div className="field-row">
        <input
          className="field"
          placeholder="Company name"
          value={job.companyName}
          onChange={(e) => set({ companyName: e.target.value })}
          disabled={!editable}
        />
        <input
          className="field"
          placeholder="Job title"
          value={job.jobTitle}
          onChange={(e) => set({ jobTitle: e.target.value })}
          disabled={!editable}
        />
      </div>

      <div className="tab-bar">
        <button
          type="button"
          className={`tab${job.mode === "paste" ? " active" : ""}`}
          onClick={() => set({ mode: "paste" })}
          disabled={!editable}
        >
          Paste JD
        </button>
        <button
          type="button"
          className={`tab${job.mode === "url" ? " active" : ""}`}
          onClick={() => set({ mode: "url" })}
          disabled={!editable}
        >
          From URL
        </button>
      </div>

      {job.mode === "paste" ? (
        <textarea
          className="jd-textarea bulk-jd"
          placeholder="Paste the full job description here..."
          value={job.jobDescription}
          onChange={(e) => set({ jobDescription: e.target.value })}
          rows={5}
          disabled={!editable}
        />
      ) : (
        <input
          className="field url-field"
          type="url"
          placeholder="https://jobs.company.com/posting/12345"
          value={job.url}
          onChange={(e) => set({ url: e.target.value })}
          disabled={!editable}
        />
      )}

      {job.status === "failed" && (
        <div className="error-banner">{job.error}</div>
      )}

      {job.status === "failed" && (
        <div className="bulk-card-actions">
          <button
            type="button"
            className="btn-primary btn-small"
            onClick={() => bulk.retry(job.id)}
            disabled={locked || !isJobReady(job)}
          >
            Retry
          </button>
        </div>
      )}

      {job.status === "done" && (
        <>
          <div className="bulk-card-actions">
            <DownloadButton onDownload={() => bulk.downloadPdf(job.id)} />
            <button type="button" className="btn-ghost btn-small" onClick={onReview}>
              Review
            </button>
            <button
              type="button"
              className="btn-ghost btn-small"
              onClick={handleLog}
              disabled={logging || job.logged}
            >
              {job.logged ? "Logged ✓" : logging ? "Logging…" : "Log to tracker"}
            </button>
          </div>
          {logError && <div className="error-banner">{logError}</div>}
        </>
      )}
    </div>
  );
}

export default function BulkTailorView({ bulk, onLog }) {
  const [reviewId, setReviewId] = useState(null);
  const [celebrating, setCelebrating] = useState(false);
  const timer = useRef(null);
  const { jobs, running, doneCount } = bulk;

  useEffect(() => () => clearTimeout(timer.current), []);

  // Save to the tracker, mark the card logged, celebrate, then move on to the
  // next job that still needs logging.
  const handleLog = async (id, entry) => {
    await onLog(entry);
    bulk.updateJob(id, { logged: true });
    setCelebrating(true);
    const i = jobs.findIndex((j) => j.id === id);
    const rest = jobs.slice(i + 1);
    const next = rest.find((j) => j.status === "done" && !j.logged) ?? rest[0];
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setCelebrating(false);
      if (next) {
        document
          .getElementById(`bulk-job-${next.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, CELEBRATION_MS);
  };

  const reviewing = jobs.find((j) => j.id === reviewId && j.resume);
  if (reviewing) {
    return (
      <div style={{ width: "100%", maxWidth: 1100, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <button className="btn-ghost btn-small" onClick={() => setReviewId(null)}>
            ← Back to batch
          </button>
          <span className="bulk-review-title">
            {reviewing.companyName} — {reviewing.jobTitle}
          </span>
        </div>
        <ResumePreview
          resume={reviewing.resume}
          edits={reviewing.edits}
          onBulletEdit={(...args) => bulk.updateBullet(reviewing.id, ...args)}
          onDownload={() => bulk.downloadPdf(reviewing.id)}
          onRefine={(feedback) => bulk.refine(reviewing.id, feedback)}
          refining={reviewing.refining}
          refineError={reviewing.refineError}
          jobDescription={reviewing.resolvedJd}
        />
      </div>
    );
  }

  return (
    <div className="bulk-view">
      <div>
        <h1 className="form-headline">Bulk tailor.</h1>
        <p className="form-sub">
          Queue up several jobs, then come back to a set of ready PDFs. Up to {CONCURRENCY_LIMIT} run at a time.
        </p>
      </div>

      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          locked={running}
          bulk={bulk}
          onLog={handleLog}
          onReview={() => setReviewId(job.id)}
        />
      ))}

      <div>
        <button
          type="button"
          className="btn-ghost bulk-add"
          onClick={bulk.addJob}
          disabled={running}
          aria-label="Add job"
        >
          +
        </button>
      </div>

      <div className="bulk-footer">
        <button className="btn-primary" onClick={bulk.startAll} disabled={!bulk.canStart}>
          Tailor all →
        </button>
        <span className="bulk-progress">
          {doneCount} / {jobs.length} done
        </span>
        <div className="bulk-footer-right">
          <button
            className="btn-ghost"
            onClick={bulk.downloadZip}
            disabled={bulk.zipping || doneCount === 0}
          >
            {bulk.zipping ? "Building zip…" : "Download all (.zip)"}
          </button>
          <button className="btn-ghost" onClick={bulk.clearBatch} disabled={running}>
            Clear batch
          </button>
        </div>
      </div>
      {bulk.zipError && <div className="error-banner">{bulk.zipError}</div>}

      {celebrating && (
        <div className="wahoo" aria-hidden="true">
          {WAHOO_SRC ? <img src={WAHOO_SRC} alt="" /> : <span>🐶👍</span>}
          <strong>Wahoo!</strong>
        </div>
      )}
    </div>
  );
}
