import { useState, useCallback } from "react";
import { scrapeJob, tailorResume, refineResume, renderPdf } from "../api/client";

const STATUS_MESSAGES = [
  "Analyzing job description...",
  "Identifying key pain points...",
  "Selecting relevant experience...",
  "Reframing your experience...",
  "Finalizing tailored content...",
];

function buildFinalResume(resume, edits) {
  return {
    ...resume,
    experience: resume.experience.map((job, i) => ({
      ...job,
      bullets: job.bullets.map((b, j) => edits[`experience:${i}:${j}`] ?? b),
    })),
    projects: resume.projects.map((proj, i) => ({
      ...proj,
      bullets: proj.bullets.map((b, j) => edits[`projects:${i}:${j}`] ?? b),
    })),
  };
}

function buildFilename(companyName, jobTitle) {
  const slug = (s) =>
    s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `${slug(companyName)}_${slug(jobTitle)}_resume.pdf`;
}

function extractErrorMessage(err) {
  const detail = err.response?.data?.detail;
  if (!detail) return err.message || "Unknown error";
  if (typeof detail === "string") return detail;
  if (typeof detail === "object" && detail.message) return detail.message;
  return JSON.stringify(detail);
}

export function useTailor() {
  const [phase, setPhase] = useState("input");
  const [resume, setResume] = useState(null);
  const [edits, setEdits] = useState({});
  const [jobInput, setJobInput] = useState({ companyName: "", jobTitle: "", jobUrl: "" });
  const [jobDescription, setJobDescription] = useState("");
  const [errorMessage, setErrorMessage] = useState(null);
  const [statusIndex, setStatusIndex] = useState(0);
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState(null);

  const startStatusCycle = useCallback(() => {
    setStatusIndex(0);
    return setInterval(() => {
      setStatusIndex((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 2200);
  }, []);

  const runTailor = useCallback(
    async (payload) => {
      setPhase("processing");
      setErrorMessage(null);
      const intervalId = startStatusCycle();
      try {
        const result = await tailorResume(payload);
        setResume(result);
        setEdits({});
        setPhase("review");
      } catch (err) {
        setErrorMessage(extractErrorMessage(err));
        setPhase("error");
      } finally {
        clearInterval(intervalId);
      }
    },
    [startStatusCycle]
  );

  const submit = useCallback(
    ({ jobDescription, companyName, jobTitle }) => {
      setJobInput({ companyName, jobTitle, jobUrl: "" });
      setJobDescription(jobDescription);
      return runTailor({
        job_description: jobDescription,
        company_name: companyName,
        job_title: jobTitle,
      });
    },
    [runTailor]
  );

  const submitFromUrl = useCallback(
    async ({ url, companyName, jobTitle }) => {
      setJobInput({ companyName, jobTitle, jobUrl: url });
      setPhase("processing");
      setErrorMessage(null);
      const intervalId = startStatusCycle();
      try {
        const jobDescription = await scrapeJob(url);
        setJobDescription(jobDescription);
        const result = await tailorResume({
          job_description: jobDescription,
          company_name: companyName,
          job_title: jobTitle,
        });
        setResume(result);
        setEdits({});
        setPhase("review");
      } catch (err) {
        setErrorMessage(extractErrorMessage(err));
        setPhase("error");
      } finally {
        clearInterval(intervalId);
      }
    },
    [startStatusCycle]
  );

  const updateBullet = useCallback((section, itemIndex, bulletIndex, value) => {
    const trimmed = value.trim();
    setEdits((prev) => ({
      ...prev,
      [`${section}:${itemIndex}:${bulletIndex}`]: trimmed,
    }));
  }, []);

  const refine = useCallback(
    async (feedback) => {
      if (!resume || !feedback.trim()) return;
      setRefining(true);
      setRefineError(null);
      // Refine the version the user is currently looking at (base + inline edits),
      // so their manual tweaks are carried into the revision.
      const current = buildFinalResume(resume, edits);
      try {
        const result = await refineResume({
          job_description: jobDescription,
          company_name: jobInput.companyName,
          job_title: jobInput.jobTitle,
          current_resume: current,
          feedback,
        });
        setResume(result);
        setEdits({});
      } catch (err) {
        setRefineError(extractErrorMessage(err));
      } finally {
        setRefining(false);
      }
    },
    [resume, edits, jobDescription, jobInput]
  );

  const reset = useCallback(() => {
    setPhase("input");
    setResume(null);
    setEdits({});
    setJobDescription("");
    setErrorMessage(null);
    setRefineError(null);
  }, []);

  const downloadPdf = useCallback(async () => {
    if (!resume) return;
    const final = buildFinalResume(resume, edits);
    try {
      const blob = await renderPdf(final);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildFilename(jobInput.companyName, jobInput.jobTitle);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      // Check for structured 503 pdflatex_unavailable error
      // Axios returns blob on error too — parse it
      const responseData = err.response?.data;
      if (responseData instanceof Blob) {
        try {
          const text = await responseData.text();
          const parsed = JSON.parse(text);
          const detail = parsed.detail;
          if (detail?.error === "pdflatex_unavailable") {
            alert(`PDF rendering unavailable\n\n${detail.message}\n\nTo install:\n${detail.install_hint}`);
            return;
          }
        } catch (_) {
          // fall through to generic error
        }
      }
      alert(`PDF generation failed: ${extractErrorMessage(err)}`);
    }
  }, [resume, edits]);

  return {
    phase,
    resume,
    edits,
    jobInput,
    errorMessage,
    statusMessage: STATUS_MESSAGES[statusIndex],
    submit,
    submitFromUrl,
    updateBullet,
    refine,
    refining,
    refineError,
    reset,
    downloadPdf,
  };
}
