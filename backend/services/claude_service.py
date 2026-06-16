import asyncio
import json
import logging

import anthropic

from backend.cv_store import get_master_cv
from backend.models import TailoredResume

logger = logging.getLogger(__name__)

_client = anthropic.Anthropic()

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
semicolon, or restructure the sentence instead.
9. tailoring_notes must be a bullet list of 3-5 items. Each bullet starts with a \
past-tense verb (e.g., "Moved...", "Reframed...", "Dropped...", "Elevated...", \
"Prioritized..."). Explain what changed and why. Format as a JSON array of strings.
10. Extract work_type and location directly from the job description. work_type must be \
one of "remote", "hybrid", "onsite", or "" if not mentioned. location is the city/state \
or "Remote" as stated in the JD, or "" if not mentioned."""

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
    raw_json = await _call_with_retry(user_message)
    return TailoredResume.model_validate_json(raw_json)


async def _call_with_retry(user_message: str, max_attempts: int = 2) -> str:
    bad_response: str = ""

    for attempt in range(max_attempts):
        if attempt == 0:
            messages = [{"role": "user", "content": user_message}]
        else:
            messages = [
                {"role": "user", "content": user_message},
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
            max_tokens=2000,
            system=SYSTEM_PROMPT,
            messages=messages,
        )

        raw = _strip_markdown_fences(response.content[0].text)

        try:
            json.loads(raw)
            return raw
        except json.JSONDecodeError as exc:
            logger.warning("Attempt %d/%d — JSON parse failed: %s", attempt + 1, max_attempts, exc)
            bad_response = raw

    raise ValueError(
        f"Claude returned invalid JSON after {max_attempts} attempts. "
        f"Last response snippet: {bad_response[:400]}"
    )
