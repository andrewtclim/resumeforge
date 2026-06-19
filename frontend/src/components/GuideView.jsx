import { useState } from "react";

const CLAUDE_PROMPT = `You are my job application assistant. I'll share a job description and my resume below. Help me answer application questions (e.g. "Why do you want to work here?"). Keep responses to ~250–300 words, based only on my actual experience — never invent skills or accomplishments — and write in a natural, human voice.

---
JOB DESCRIPTION:
[paste JD here]

MY RESUME:
[paste resume text here]`;

const steps = [
  {
    number: "1",
    title: "Generate your tailored resume",
    body: (
      <>
        Go to the <strong>Tailor</strong> tab. Paste the job description or drop in the URL,
        fill in the company and role, and hit <strong>Generate</strong>. Claude will reframe
        your real experience to match the role — no fabrication. Review the bullets, edit
        anything inline, then download the PDF.
      </>
    ),
  },
  {
    number: "2",
    title: "Set up Claude.ai for follow-up questions",
    body: (
      <>
        Most applications ask extra questions like "Why do you want to work here?" or "Tell
        us about a challenge you overcame." Open{" "}
        <a href="https://claude.ai" target="_blank" rel="noreferrer">
          claude.ai
        </a>
        , start a new conversation, and paste the prompt below. Fill in the JD and your
        resume where indicated, then ask it any question from the application.
      </>
    ),
    prompt: true,
  },
  {
    number: "3",
    title: "Log the application",
    body: (
      <>
        Once you've submitted, head to the <strong>Tracker</strong> tab and add an entry.
        Or — after generating a resume — use the <strong>"Did you apply?"</strong> banner
        that appears automatically. It pre-fills company, role, and work type so logging
        takes two seconds.
      </>
    ),
  },
];

export default function GuideView() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(CLAUDE_PROMPT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="guide-view">
      <div className="guide-header">
        <h1 className="form-headline">How to use ResumeForge</h1>
        <p className="form-sub">Three steps from job posting to submitted application.</p>
      </div>

      <div className="guide-steps">
        {steps.map((step) => (
          <div className="guide-step" key={step.number}>
            <div className="guide-step-number">{step.number}</div>
            <div className="guide-step-content">
              <h2 className="guide-step-title">{step.title}</h2>
              <p className="guide-step-body">{step.body}</p>
              {step.prompt && (
                <div className="guide-prompt-block">
                  <button
                    className="guide-copy-btn"
                    onClick={handleCopy}
                  >
                    {copied ? "Copied!" : "Copy prompt"}
                  </button>
                  <pre>{CLAUDE_PROMPT}</pre>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
