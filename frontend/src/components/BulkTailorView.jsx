import { useState } from "react";
import { CONCURRENCY_LIMIT, isJobReady } from "../hooks/useBulkTailor";
import ApplyPrompt from "./ApplyPrompt";
import DownloadButton from "./DownloadButton";
import ResumePreview from "./ResumePreview";

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
  const editable = !locked && (job.status === "idle" || job.status === "failed");
  const set = (patch) => bulk.updateJob(job.id, patch);

  return (
    <div className={`bulk-card status-${job.status}`}>
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
              onClick={() => setLogging((l) => !l)}
            >
              Log to tracker
            </button>
          </div>
          {logging && (
            <ApplyPrompt
              startInForm
              resume={job.resume}
              jobInput={{
                companyName: job.companyName,
                jobTitle: job.jobTitle,
                jobUrl: job.mode === "url" ? job.url : "",
              }}
              onLog={onLog}
              onDismiss={() => setLogging(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

export default function BulkTailorView({ bulk, onLog }) {
  const [reviewId, setReviewId] = useState(null);
  const { jobs, running, doneCount } = bulk;

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
          onLog={onLog}
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
    </div>
  );
}
