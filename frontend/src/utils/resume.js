import { scrapeJob, tailorResume, renderPdf } from "../api/client";

export function buildFinalResume(resume, edits) {
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

export function buildFilename(companyName, jobTitle) {
  const slug = (s) =>
    s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `${slug(companyName)}_${slug(jobTitle)}_resume.pdf`;
}

export function extractErrorMessage(err) {
  const detail = err.response?.data?.detail;
  if (!detail) return err.message || "Unknown error";
  if (typeof detail === "string") return detail;
  if (typeof detail === "object" && detail.message) return detail.message;
  return JSON.stringify(detail);
}

// Local date (not UTC) as YYYY-MM-DD.
export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Scrape the URL first if given, then tailor. `onStage` is called with
// "scraping" / "tailoring" so callers can show progress.
// Returns { resume, jobDescription } so callers can keep the resolved JD for refine.
export async function scrapeAndTailor({ url, jobDescription, companyName, jobTitle }, onStage) {
  let jd = jobDescription;
  if (url) {
    onStage?.("scraping");
    jd = await scrapeJob(url);
  }
  onStage?.("tailoring");
  const resume = await tailorResume({
    job_description: jd,
    company_name: companyName,
    job_title: jobTitle,
  });
  return { resume, jobDescription: jd };
}

// Axios returns error bodies as a Blob when responseType is "blob", so the
// structured detail has to be parsed out of the blob.
async function parseRenderErrorDetail(err) {
  const data = err.response?.data;
  if (!(data instanceof Blob)) return null;
  try {
    return JSON.parse(await data.text()).detail ?? null;
  } catch {
    return null;
  }
}

// Render a PDF blob, throwing an Error with a readable message on failure.
export async function renderPdfBlob(resume) {
  try {
    return await renderPdf(resume);
  } catch (err) {
    const detail = await parseRenderErrorDetail(err);
    if (detail?.message) throw new Error(detail.message, { cause: err });
    throw new Error(extractErrorMessage(err), { cause: err });
  }
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function downloadResumePdf(resume, filename) {
  try {
    saveBlob(await renderPdf(resume), filename);
  } catch (err) {
    const detail = await parseRenderErrorDetail(err);
    if (detail?.error === "pdflatex_unavailable") {
      alert(`PDF rendering unavailable\n\n${detail.message}\n\nTo install:\n${detail.install_hint}`);
      return;
    }
    alert(`PDF generation failed: ${extractErrorMessage(err)}`);
  }
}
