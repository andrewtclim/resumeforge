import { useState, useCallback } from "react";
import { tailorResume, refineResume } from "../api/client";
import {
  buildFinalResume,
  buildFilename,
  extractErrorMessage,
  scrapeAndTailor,
  downloadResumePdf,
} from "../utils/resume";

const STATUS_MESSAGES = [
  "Analyzing job description...",
  "Identifying key pain points...",
  "Selecting relevant experience...",
  "Reframing your experience...",
  "Finalizing tailored content...",
];

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
        const { resume: result, jobDescription } = await scrapeAndTailor({
          url,
          companyName,
          jobTitle,
        });
        setJobDescription(jobDescription);
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
    await downloadResumePdf(
      buildFinalResume(resume, edits),
      buildFilename(jobInput.companyName, jobInput.jobTitle)
    );
  }, [resume, edits, jobInput]);

  return {
    phase,
    resume,
    edits,
    jobInput,
    jobDescription,
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
