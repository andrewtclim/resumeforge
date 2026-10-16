import asyncio
import json
import logging

import anthropic

from backend.cv_store import get_master_cv
from backend.models import TailoredResume

logger = logging.getLogger(__name__)

_client = anthropic.Anthropic()

# A full tailored resume (experience, projects, skills, notes) can exceed 2000 tokens;
# a cut-off response is invalid JSON.
MAX_OUTPUT_TOKENS = 4096

SYSTEM_PROMPT = """You are a professional resume strategist. Your job is to tailor a candidate's resume \
to a specific job description, maximizing relevance and fit without fabricating any \
experience, skills, or metrics.

STRICT RULES:
1. Every bullet point in your output must be directly traceable to content in the \
provided master CV. You may reframe, reorder, or rephrase — but you must NEVER \
invent roles, projects, metrics, tools, or skills the candidate does not have.
2. Mirror the vocabulary and phrasing of the job description where it authentically \
maps to the candidate's real experience.
3. Prioritize surface-level fit: lead with the experience and projects most relevant \
to the role. Deprioritize or omit content that does not serve the application.
4. Reframe bullet points to speak to the company's pain points and priorities as \
inferred from the job description — not just to list tasks.
5. Keep the output tight. This is a one-page resume. Every bullet must earn its place.
6. Set sections_order strategically: for internships and new-grad roles, put "education" \
first — recruiters screening interns look there first. For experienced roles, lead with \
"experience". Use your judgment based on the seniority signals in the job description.
7. Output ONLY valid JSON matching the TailoredResume schema. No preamble, no markdown \
fences, no explanation outside the JSON.
8. Never use em dashes (—) or en dashes (–) anywhere in the output. Use a comma, \
semicolon, or restructure the sentence instead. The master CV is LaTeX, where "--" is \
source notation for an en dash and "---" for an em dash. Never copy these through: \
"200--400 tasks" becomes "200-400 tasks" or "200 to 400 tasks", and \
"Magnit --- Contract with Meta" becomes "Magnit, Contract with Meta". The ONLY exception is \
the "dates" field, where "Aug 2025 -- Present" is correct and must be left as is: LaTeX \
renders that double hyphen as the en dash a date range wants. Everywhere else (bullets, \
roles, companies, titles, skills, tailoring_notes) no string may contain two consecutive \
hyphens.
9. tailoring_notes must be a bullet list of 3-5 items. Each bullet starts with a \
past-tense verb (e.g., "Moved...", "Reframed...", "Dropped...", "Elevated...", \
"Prioritized..."). Explain what changed and why. Format as a JSON array of strings.
10. Extract work_type and location directly from the job description. work_type must be \
one of "remote", "hybrid", "onsite", or "" if not mentioned. location is the city/state \
or "Remote" as stated in the JD, or "" if not mentioned.
11. The master CV stores slash-separated title variants (e.g. "Machine Learning Engineer \
/ Data Analyst", "Data Analyst / Data Labeling Analyst III / Data Quality Analyst III", \
"Lunch Buddy / Personalized RAG Recommendation Pipeline"). These are alternatives, not \
compound titles. Pick exactly ONE variant based on the target role and output that alone. \
Never concatenate two or more, and never keep the slash. Discarding the other variants is \
the point: do NOT preserve them in parentheses, after a comma, after a colon, or in any \
other form. "Lunch Buddy / Personalized RAG Recommendation Pipeline" becomes either \
"Lunch Buddy" or "Personalized RAG Recommendation Pipeline", never \
"Personalized RAG Recommendation Pipeline (Lunch Buddy)". This applies to summary_title, \
experience roles, and project names. Do NOT apply this rule anywhere else: slashes inside \
skills ("Supervised/Unsupervised Learning") and inside framing tags are real content and \
must be preserved verbatim.
12. Bullets in the master CV are grouped under \\frameLabel{...} blocks (MLE, AI-ENG, CC, \
ANALYST, REC-V2). These are alternative framings of the SAME work, not additional \
accomplishments. For each role or project, choose the single framing closest to the target \
job and draw bullets only from it. Never mix bullets from two framings for the same entry, \
and never list the same accomplishment twice in different wording.
13. Some master CV entries carry an "INCLUSION RULE" in their LaTeX comments. These are \
binding. If an entry's rule says to omit it unless the job meets a condition, leave the \
entry out entirely unless the job description clearly meets that condition. When an entry \
is left out, also drop any skills the comments tie to it."""

JSON_SCHEMA = """{
  "summary_title": "string — the job title to display on the resume header",
  "experience": [
    {
      "role": "string",
      "company": "string",
      "location": "string",
      "dates": "string",
      "bullets": ["string", "..."]
    }
  ],
  "projects": [
    {
      "name": "string",
      "url": "string",
      "tech_stack": "string",
      "dates": "string",
      "bullets": ["string", "..."]
    }
  ],
  "education": [
    {
      "school": "string",
      "location": "string",
      "degree": "string",
      "dates": "string",
      "bullets": ["string"]
    }
  ],
  "skills": {
    "category_name": ["skill1", "skill2"]
  },
  "sections_order": ["experience", "projects", "education"],
  "tailoring_notes": ["Moved X to the top because...", "Reframed Y to emphasize...", "..."],
  "work_type": "remote | hybrid | onsite | ''",
  "location": "City, State | Remote | ''"
}"""


def _build_user_message(job_description: str, company_name: str, job_title: str) -> str:
    cv_content = get_master_cv() or "(no master CV provided — do your best with the job description alone)"
    return f"""MASTER CV (source of truth — do not invent anything not present here):
---
{cv_content}
---

JOB DESCRIPTION:
Company: {company_name}
Title: {job_title}
---
{job_description}
---

Tailor the resume for this role. Output a JSON object matching this schema exactly:

{JSON_SCHEMA}

Remember: only include skills and experience that exist in the master CV."""


def _strip_markdown_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Drop opening fence (```json or ```)
        lines = lines[1:]
        # Drop closing fence if present
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


async def tailor_resume(
    job_description: str,
    company_name: str,
    job_title: str,
) -> TailoredResume:
    user_message = _build_user_message(job_description, company_name, job_title)
    base_messages = [{"role": "user", "content": user_message}]
    raw_json = await _call_with_retry(base_messages)
    return TailoredResume.model_validate_json(raw_json)


async def refine_resume(
    job_description: str,
    company_name: str,
    job_title: str,
    current_resume: TailoredResume,
    feedback: str,
) -> TailoredResume:
    """Regenerate a tailored resume, applying the user's freeform feedback to the
    version they are currently looking at. Replays the original tailoring turn so
    Claude keeps the job description, master CV, and no-fabrication rules in view."""
    user_message = _build_user_message(job_description, company_name, job_title)
    base_messages = [
        {"role": "user", "content": user_message},
        {"role": "assistant", "content": current_resume.model_dump_json()},
        {
            "role": "user",
            "content": (
                "Here is my feedback on the resume you just produced. Apply it and return "
                "the FULL updated resume.\n\n"
                f"FEEDBACK:\n{feedback}\n\n"
                "All original rules still apply: no fabrication (only content from the master CV), "
                "no em dashes, keep it to one page, and refresh tailoring_notes to reflect what you "
                "changed in this revision. Output ONLY the corrected JSON object matching the same "
                "schema, with no markdown fences or preamble."
            ),
        },
    ]
    raw_json = await _call_with_retry(base_messages)
    return TailoredResume.model_validate_json(raw_json)


async def _call_with_retry(base_messages: list[dict], max_attempts: int = 2) -> str:
    bad_response: str = ""

    for attempt in range(max_attempts):
        if attempt == 0:
            messages = base_messages
        else:
            messages = [
                *base_messages,
                {"role": "assistant", "content": bad_response},
                {
                    "role": "user",
                    "content": (
                        "Your previous response was not valid JSON or did not match the required schema. "
                        "Return ONLY the corrected JSON object with no markdown fences, no preamble, "
                        "and no text outside the opening and closing braces."
                    ),
                },
            ]

        response = await asyncio.to_thread(
            _client.messages.create,
            model="claude-sonnet-4-6",
            max_tokens=MAX_OUTPUT_TOKENS,
            system=SYSTEM_PROMPT,
            messages=messages,
        )

        raw = _strip_markdown_fences(response.content[0].text)
        truncated = response.stop_reason == "max_tokens"
        if truncated:
            logger.warning("Attempt %d/%d — response hit max_tokens (%d)", attempt + 1, max_attempts, MAX_OUTPUT_TOKENS)

        try:
            json.loads(raw)
            return raw
        except json.JSONDecodeError as exc:
            logger.warning("Attempt %d/%d — JSON parse failed: %s", attempt + 1, max_attempts, exc)
            bad_response = raw

    reason = "was cut off at the token limit" if truncated else "was invalid JSON"
    raise ValueError(
        f"Claude's response {reason} after {max_attempts} attempts. "
        f"Last response snippet: {bad_response[:400]}"
    )
