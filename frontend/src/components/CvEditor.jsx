import { useState, useEffect, useRef } from "react";
import { getCv, saveCv } from "../api/client";

export default function CvEditor({ onClose }) {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("loading"); // loading | ready | saving | saved | error
  const [errorMsg, setErrorMsg] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    getCv()
      .then((text) => {
        setContent(text);
        setStatus("ready");
      })
      .catch(() => {
        setStatus("error");
        setErrorMsg("Could not load CV from server.");
      });
  }, []);

  // Focus textarea once loaded
  useEffect(() => {
    if (status === "ready") textareaRef.current?.focus();
  }, [status]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = async () => {
    setStatus("saving");
    setErrorMsg("");
    try {
      await saveCv(content);
      setStatus("saved");
      setTimeout(() => setStatus("ready"), 2000);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setErrorMsg(typeof detail === "string" ? detail : "Save failed.");
      setStatus("error");
    }
  };

  const lineCount = content.split("\n").length;

  return (
    <div className="cv-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cv-editor-panel">
        <div className="cv-editor-header">
          <div>
            <h2 className="cv-editor-title">Master CV</h2>
            <p className="cv-editor-sub">
              {status === "loading" ? "Loading…" : `${lineCount} lines · changes apply to next tailor run`}
            </p>
          </div>
          <div className="cv-editor-actions">
            {status === "saved" && (
              <span className="cv-save-confirm">Saved</span>
            )}
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={status === "loading" || status === "saving"}
            >
              {status === "saving" ? "Saving…" : "Save"}
            </button>
            <button className="btn-ghost" onClick={onClose}>Close</button>
          </div>
        </div>

        {(status === "error") && (
          <div className="error-banner" style={{ margin: "0 24px 12px" }}>{errorMsg}</div>
        )}

        <textarea
          ref={textareaRef}
          className="cv-textarea"
          value={content}
          onChange={(e) => { setContent(e.target.value); setStatus("ready"); }}
          spellCheck={false}
          disabled={status === "loading"}
          placeholder="Paste your LaTeX CV here…"
        />
      </div>
    </div>
  );
}
