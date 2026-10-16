import { useState } from "react";
import { useTailor } from "./hooks/useTailor";
import { useTracker } from "./hooks/useTracker";
import { useBulkTailor } from "./hooks/useBulkTailor";
import JobInput from "./components/JobInput";
import TailoringStatus from "./components/TailoringStatus";
import ResumePreview from "./components/ResumePreview";
import CvEditor from "./components/CvEditor";
import LoginGate from "./components/LoginGate";
import ApplyPrompt from "./components/ApplyPrompt";
import TrackerView from "./components/TrackerView";
import BulkTailorView from "./components/BulkTailorView";
import GuideView from "./components/GuideView";

function AppShell() {
  const tailor = useTailor();
  const tracker = useTracker();
  const bulk = useBulkTailor();
  const [activeTab, setActiveTab] = useState("tailor");
  const [cvEditorOpen, setCvEditorOpen] = useState(false);
  const [applyPromptDismissed, setApplyPromptDismissed] = useState(false);

  const handleLog = async (entry) => {
    await tracker.add(entry);
  };

  // Reset apply prompt when tailor resets to input
  const handleReset = () => {
    setApplyPromptDismissed(false);
    tailor.reset();
  };

  const showApplyPrompt =
    tailor.phase === "review" &&
    !applyPromptDismissed &&
    tailor.jobInput.companyName;

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="logo">Resume<span>Forge</span></span>

        <nav className="header-center">
          <button
            className={`header-tab${activeTab === "tailor" ? " active" : ""}`}
            onClick={() => setActiveTab("tailor")}
          >
            Tailor
          </button>
          <button
            className={`header-tab${activeTab === "bulk" ? " active" : ""}`}
            onClick={() => setActiveTab("bulk")}
          >
            Bulk Tailor
          </button>
          <button
            className={`header-tab${activeTab === "tracker" ? " active" : ""}`}
            onClick={() => setActiveTab("tracker")}
          >
            Tracker
            {tracker.applications.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: "0.7rem", opacity: 0.7 }}>
                {tracker.applications.length}
              </span>
            )}
          </button>
          <button
            className={`header-tab${activeTab === "guide" ? " active" : ""}`}
            onClick={() => setActiveTab("guide")}
          >
            Guide
          </button>
        </nav>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-ghost btn-small" onClick={() => setCvEditorOpen(true)}>
            Edit CV
          </button>
          {activeTab === "tailor" && tailor.phase !== "input" && tailor.phase !== "error" && (
            <button className="btn-ghost btn-small" onClick={handleReset}>
              ← Start Over
            </button>
          )}
        </div>
      </header>

      <main className="app-main">
        {activeTab === "tailor" && (
          <>
            {(tailor.phase === "input" || tailor.phase === "error") && (
              <JobInput
                onSubmitText={tailor.submit}
                onSubmitUrl={tailor.submitFromUrl}
                errorMessage={tailor.errorMessage}
              />
            )}
            {tailor.phase === "processing" && (
              <TailoringStatus message={tailor.statusMessage} />
            )}
            {tailor.phase === "review" && (
              <div style={{ width: "100%", maxWidth: 1100, display: "flex", flexDirection: "column", gap: 10 }}>
                {showApplyPrompt && (
                  <ApplyPrompt
                    resume={tailor.resume}
                    jobInput={tailor.jobInput}
                    onLog={handleLog}
                    onDismiss={() => setApplyPromptDismissed(true)}
                  />
                )}
                <ResumePreview
                  resume={tailor.resume}
                  edits={tailor.edits}
                  onBulletEdit={tailor.updateBullet}
                  onDownload={tailor.downloadPdf}
                  onRefine={tailor.refine}
                  refining={tailor.refining}
                  refineError={tailor.refineError}
                />
              </div>
            )}
          </>
        )}

        {activeTab === "bulk" && (
          <BulkTailorView bulk={bulk} onLog={handleLog} />
        )}

        {activeTab === "tracker" && (
          <TrackerView tracker={tracker} />
        )}

        {activeTab === "guide" && <GuideView />}
      </main>

      {cvEditorOpen && <CvEditor onClose={() => setCvEditorOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <LoginGate>
      <AppShell />
    </LoginGate>
  );
}
