import { useState, useRef } from "react";
import DownloadButton from "./DownloadButton";

function BulletItem({ value, editKey, edits, onBulletEdit, section, itemIndex, bulletIndex }) {
  const ref = useRef(null);
  const isEdited = edits[editKey] !== undefined;

  return (
    <li>
      <span
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className={`bullet-text${isEdited ? " edited" : ""}`}
        onBlur={(e) => {
          const text = e.currentTarget.textContent;
          onBulletEdit(section, itemIndex, bulletIndex, text);
        }}
      >
        {edits[editKey] ?? value}
      </span>
    </li>
  );
}

function ExperienceSection({ resume, edits, onBulletEdit }) {
  return (
    <section className="resume-section">
      <h2 className="section-label">Experience</h2>
      {resume.experience.map((job, i) => (
        <div key={i} className="resume-entry">
          <div className="entry-header">
            <div>
              <span className="entry-title">{job.role}</span>
              {job.company && (
                <span className="entry-sub"> — {job.company}{job.location ? `, ${job.location}` : ""}</span>
              )}
            </div>
            <span className="entry-dates">{job.dates}</span>
          </div>
          <ul className="bullet-list">
            {job.bullets.map((bullet, j) => (
              <BulletItem
                key={j}
                value={bullet}
                editKey={`experience:${i}:${j}`}
                edits={edits}
                onBulletEdit={onBulletEdit}
                section="experience"
                itemIndex={i}
                bulletIndex={j}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function ProjectsSection({ resume, edits, onBulletEdit }) {
  return (
    <section className="resume-section">
      <h2 className="section-label">Projects</h2>
      {resume.projects.map((proj, i) => (
        <div key={i} className="resume-entry">
          <div className="entry-header">
            <div>
              <span className="entry-title">{proj.name}</span>
              {proj.tech_stack && (
                <span className="entry-sub"> · {proj.tech_stack}</span>
              )}
            </div>
            {proj.dates && <span className="entry-dates">{proj.dates}</span>}
          </div>
          <ul className="bullet-list">
            {proj.bullets.map((bullet, j) => (
              <BulletItem
                key={j}
                value={bullet}
                editKey={`projects:${i}:${j}`}
                edits={edits}
                onBulletEdit={onBulletEdit}
                section="projects"
                itemIndex={i}
                bulletIndex={j}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function SkillsSection({ resume }) {
  return (
    <section className="resume-section">
      <h2 className="section-label">Skills</h2>
      {Object.entries(resume.skills).map(([category, items]) => (
        <p key={category} className="skills-row">
          <strong>{category}:</strong> {items.join(", ")}
        </p>
      ))}
    </section>
  );
}

function EducationSection({ resume }) {
  if (!resume.education?.length) return null;
  return (
    <section className="resume-section">
      <h2 className="section-label">Education</h2>
      {resume.education.map((edu, i) => (
        <div key={i} className="resume-entry">
          <div className="entry-header">
            <div>
              <span className="entry-title">{edu.school}</span>
              {edu.location && <span className="entry-sub"> — {edu.location}</span>}
            </div>
            <span className="entry-dates">{edu.dates}</span>
          </div>
          <p className="entry-sub" style={{ marginBottom: edu.bullets?.length ? 6 : 0 }}>{edu.degree}</p>
          {edu.bullets?.length > 0 && (
            <ul className="bullet-list">
              {edu.bullets.map((b, j) => (
                <li key={j}><span className="bullet-text">{b}</span></li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </section>
  );
}

const SECTION_RENDERERS = {
  experience: (props) => <ExperienceSection {...props} />,
  projects: (props) => <ProjectsSection {...props} />,
  education: (props) => <EducationSection {...props} />,
  skills: (props) => <SkillsSection {...props} />,
};

export default function ResumePreview({ resume, edits, onBulletEdit, onDownload }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const order = resume.sections_order?.length
    ? resume.sections_order
    : ["experience", "projects", "skills"];

  // Ensure skills is always present
  const orderedSections = order.includes("skills") ? order : [...order, "skills"];

  return (
    <div className="preview-layout">
      <div className="preview-toolbar">
        <button className="btn-ghost btn-small" onClick={() => setSidebarOpen((o) => !o)}>
          {sidebarOpen ? "Hide notes" : "Why these changes?"}
        </button>
        <DownloadButton onDownload={onDownload} />
      </div>

      <div className="preview-body">
        <div className="resume-doc">
          <section className="resume-section">
            <h2 className="section-label">Target Role</h2>
            <p style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-primary)" }}>
              {resume.summary_title}
            </p>
          </section>

          {orderedSections.map((sectionKey) => {
            const renderer = SECTION_RENDERERS[sectionKey];
            if (!renderer) return null;
            return renderer({ key: sectionKey, resume, edits, onBulletEdit });
          })}
        </div>

        {sidebarOpen && (
          <aside className="why-sidebar">
            <h3>Why these changes?</h3>
            {Array.isArray(resume.tailoring_notes) ? (
              <ul className="notes-list">
                {resume.tailoring_notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            ) : (
              <p>{resume.tailoring_notes}</p>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
