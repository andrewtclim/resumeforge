import { useState } from "react";

export default function JobInput({ onSubmitText, onSubmitUrl, errorMessage }) {
  const [tab, setTab] = useState("paste");
  const [jdText, setJdText] = useState("");
  const [url, setUrl] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (tab === "paste") {
      onSubmitText({ jobDescription: jdText, companyName: company, jobTitle: title });
    } else {
      onSubmitUrl({ url, companyName: company, jobTitle: title });
    }
  };

  return (
    <form className="job-input-form" onSubmit={handleSubmit}>
      <div>
        <h1 className="form-headline">Tailor your resume to any job.</h1>
        <p className="form-sub">
          Paste a job description or drop in the URL. Claude reframes your real experience — never invents.
        </p>
      </div>

      <div className="field-row">
        <input
          className="field"
          placeholder="Company name"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          required
        />
        <input
          className="field"
          placeholder="Job title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div>
        <div className="tab-bar">
          <button
            type="button"
            className={`tab${tab === "paste" ? " active" : ""}`}
            onClick={() => setTab("paste")}
          >
            Paste JD
          </button>
          <button
            type="button"
            className={`tab${tab === "url" ? " active" : ""}`}
            onClick={() => setTab("url")}
          >
            From URL
          </button>
        </div>
      </div>

      {tab === "paste" ? (
        <textarea
          className="jd-textarea"
          placeholder="Paste the full job description here..."
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          rows={12}
          required
        />
      ) : (
        <input
          className="field url-field"
          type="url"
          placeholder="https://jobs.company.com/posting/12345"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
      )}

      {errorMessage && <div className="error-banner">{errorMessage}</div>}

      <div>
        <button className="btn-primary" type="submit">
          Tailor Resume →
        </button>
      </div>
    </form>
  );
}
