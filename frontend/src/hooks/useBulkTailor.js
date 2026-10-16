import { useState, useCallback, useEffect, useRef } from "react";
import JSZip from "jszip";
import { refineResume } from "../api/client";
import {
  buildFinalResume,
  buildFilename,
  extractErrorMessage,
  scrapeAndTailor,
  renderPdfBlob,
  saveBlob,
  downloadResumePdf,
  todayLocal,
} from "../utils/resume";

// Max jobs in flight at once. Keeps us under Anthropic rate limits and inside
// Cloud Run's 1Gi memory (tectonic is heavy).
export const CONCURRENCY_LIMIT = 3;

const STORAGE_KEY = "bulk_tailor_batch";
const ACTIVE = ["queued", "scraping", "tailoring", "rendering"];

let idCounter = 0;
const newId = () => `${Date.now().toString(36)}-${idCounter++}`;

const blankJob = () => ({
  id: newId(),
  companyName: "",
  jobTitle: "",
  mode: "paste", // paste | url
  jobDescription: "",
  url: "",
  status: "idle", // idle | queued | scraping | tailoring | rendering | done | failed
  error: null,
  resume: null,
  resolvedJd: "", // JD text actually used (scraped or pasted); needed for refine
  edits: {},
});

function loadBatch() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved) && saved.length) {
      // Anything in flight when the page closed was cut off; let the user retry it.
      return saved.map((j) => {
        const clean = { ...j, refining: false, refineError: null };
        return ACTIVE.includes(j.status)
          ? { ...clean, status: "failed", error: "Interrupted by page refresh. Retry to run it again." }
          : clean;
      });
    }
  } catch {
    // fall through to a fresh batch
  }
  return [blankJob()];
}

export function isJobReady(j) {
  return Boolean(
    j.companyName.trim() &&
      j.jobTitle.trim() &&
      (j.mode === "paste" ? j.jobDescription.trim() : j.url.trim())
  );
}

export function useBulkTailor() {
  const [jobs, setJobs] = useState(loadBatch);
  const [zipping, setZipping] = useState(false);
  const [zipError, setZipError] = useState(null);

  // Rendered PDFs live only in memory; they are re-rendered from the saved JSON
  // after a refresh or whenever the resume changes.
  const pdfCache = useRef(new Map());
  const queue = useRef([]);
  const active = useRef(0);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    } catch {
      // storage full or unavailable; the batch just won't survive a refresh
    }
  }, [jobs]);

  const patchJob = useCallback((id, patch) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));
  }, []);

  const runJob = useCallback(
    async (job) => {
      try {
        const { resume, jobDescription } = await scrapeAndTailor(
          {
            url: job.mode === "url" ? job.url.trim() : "",
            jobDescription: job.jobDescription,
            companyName: job.companyName,
            jobTitle: job.jobTitle,
          },
          (stage) => patchJob(job.id, { status: stage })
        );
        patchJob(job.id, { status: "rendering", resume, resolvedJd: jobDescription, edits: {} });
        pdfCache.current.set(job.id, await renderPdfBlob(resume));
        patchJob(job.id, { status: "done", error: null });
      } catch (err) {
        pdfCache.current.delete(job.id);
        patchJob(job.id, { status: "failed", error: extractErrorMessage(err) });
      }
    },
    [patchJob]
  );

  const pump = useCallback(
    function drain() {
      while (active.current < CONCURRENCY_LIMIT && queue.current.length) {
        const job = queue.current.shift();
        active.current += 1;
        runJob(job).finally(() => {
          active.current -= 1;
          drain();
        });
      }
    },
    [runJob]
  );

  const enqueue = useCallback(
    (toRun) => {
      const ids = new Set(toRun.map((j) => j.id));
      setJobs((prev) =>
        prev.map((j) => (ids.has(j.id) ? { ...j, status: "queued", error: null } : j))
      );
      queue.current.push(...toRun);
      pump();
    },
    [pump]
  );

  const running = jobs.some((j) => ACTIVE.includes(j.status));
  const canStart =
    !running && jobs.every(isJobReady) && jobs.some((j) => j.status === "idle");
  const doneCount = jobs.filter((j) => j.status === "done").length;

  const startAll = useCallback(() => {
    if (!canStart) return;
    enqueue(jobs.filter((j) => j.status === "idle"));
  }, [canStart, enqueue, jobs]);

  const retry = useCallback(
    (id) => {
      const job = jobs.find((j) => j.id === id);
      if (job && job.status === "failed" && isJobReady(job)) enqueue([job]);
    },
    [enqueue, jobs]
  );

  const addJob = useCallback(() => setJobs((prev) => [...prev, blankJob()]), []);

  const removeJob = useCallback((id) => {
    pdfCache.current.delete(id);
    queue.current = queue.current.filter((j) => j.id !== id);
    setJobs((prev) => {
      const next = prev.filter((j) => j.id !== id);
      return next.length ? next : [blankJob()];
    });
  }, []);

  const updateJob = useCallback((id, patch) => patchJob(id, patch), [patchJob]);

  const clearBatch = useCallback(() => {
    queue.current = [];
    pdfCache.current.clear();
    setZipError(null);
    setJobs([blankJob()]);
  }, []);

  // ---- review / edit / refine on a finished job ----

  const updateBullet = useCallback((id, section, itemIndex, bulletIndex, value) => {
    pdfCache.current.delete(id);
    setJobs((prev) =>
      prev.map((j) =>
        j.id === id
          ? { ...j, edits: { ...j.edits, [`${section}:${itemIndex}:${bulletIndex}`]: value.trim() } }
          : j
      )
    );
  }, []);

  const refine = useCallback(
    async (id, feedback) => {
      const job = jobs.find((j) => j.id === id);
      if (!job?.resume || !feedback.trim()) return;
      patchJob(id, { refining: true, refineError: null });
      try {
        const result = await refineResume({
          job_description: job.resolvedJd,
          company_name: job.companyName,
          job_title: job.jobTitle,
          current_resume: buildFinalResume(job.resume, job.edits),
          feedback,
        });
        pdfCache.current.delete(id);
        patchJob(id, { resume: result, edits: {}, refining: false });
      } catch (err) {
        patchJob(id, { refining: false, refineError: extractErrorMessage(err) });
      }
    },
    [jobs, patchJob]
  );

  const getBlob = useCallback(async (job) => {
    const cached = pdfCache.current.get(job.id);
    if (cached) return cached;
    const blob = await renderPdfBlob(buildFinalResume(job.resume, job.edits));
    pdfCache.current.set(job.id, blob);
    return blob;
  }, []);

  const downloadPdf = useCallback(
    async (id) => {
      const job = jobs.find((j) => j.id === id);
      if (!job?.resume) return;
      await downloadResumePdf(
        buildFinalResume(job.resume, job.edits),
        buildFilename(job.companyName, job.jobTitle)
      );
    },
    [jobs]
  );

  const downloadZip = useCallback(async () => {
    const finished = jobs.filter((j) => j.status === "done" && j.resume);
    if (!finished.length) return;
    setZipping(true);
    setZipError(null);
    try {
      const zip = new JSZip();
      const used = new Set();
      // Render in groups of CONCURRENCY_LIMIT so a post-refresh zip doesn't
      // hit tectonic with every job at once.
      for (let i = 0; i < finished.length; i += CONCURRENCY_LIMIT) {
        const group = finished.slice(i, i + CONCURRENCY_LIMIT);
        const blobs = await Promise.all(group.map(getBlob));
        group.forEach((job, k) => {
          let name = buildFilename(job.companyName, job.jobTitle);
          for (let n = 2; used.has(name); n++) {
            name = buildFilename(job.companyName, job.jobTitle).replace(/\.pdf$/, `_${n}.pdf`);
          }
          used.add(name);
          zip.file(name, blobs[k]);
        });
      }
      saveBlob(await zip.generateAsync({ type: "blob" }), `resumes_${todayLocal()}.zip`);
    } catch (err) {
      setZipError(err.message || "Failed to build zip");
    } finally {
      setZipping(false);
    }
  }, [jobs, getBlob]);

  return {
    jobs,
    running,
    canStart,
    doneCount,
    zipping,
    zipError,
    startAll,
    retry,
    addJob,
    removeJob,
    updateJob,
    clearBatch,
    updateBullet,
    refine,
    downloadPdf,
    downloadZip,
  };
}
