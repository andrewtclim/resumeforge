import logging
import os
import pathlib
import shutil
import subprocess
import tempfile

from backend.models import TailoredResume

logger = logging.getLogger(__name__)

TEMPLATE_PATH = pathlib.Path(__file__).parent.parent.parent / "templates" / "resume_template.tex"

# Prefer tectonic (lightweight, auto-downloads packages) over pdflatex (requires full TeX Live)
_TECTONIC = shutil.which("tectonic")
_PDFLATEX = shutil.which("pdflatex")

LATEX_ENGINE = _TECTONIC or _PDFLATEX
PDFLATEX_AVAILABLE: bool = LATEX_ENGINE is not None  # kept for render.py compatibility

if not LATEX_ENGINE:
    logger.warning(
        "No LaTeX engine found — PDF rendering will be unavailable. "
        "Install tectonic (recommended, ~30MB): brew install tectonic  "
        "or full TeX Live: brew install --cask mactex"
    )
else:
    engine_name = "tectonic" if _TECTONIC else "pdflatex"
    logger.info("LaTeX engine: %s (%s)", engine_name, LATEX_ENGINE)

# Characters that must be escaped in LaTeX user content.
# Backslash is handled first — it is the prefix for all other escapes.
_LATEX_ESCAPES = [
    ("\\", r"\textbackslash{}"),
    ("&", r"\&"),
    ("%", r"\%"),
    ("$", r"\$"),
    ("#", r"\#"),
    ("_", r"\_"),
    ("{", r"\{"),
    ("}", r"\}"),
    ("~", r"\textasciitilde{}"),
    ("^", r"\textasciicircum{}"),
]


def _esc(text: str) -> str:
    for char, replacement in _LATEX_ESCAPES:
        text = text.replace(char, replacement)
    return text


def _build_experience_block(resume: TailoredResume) -> str:
    lines = [r"  \resumeSubHeadingListStart"]
    for job in resume.experience:
        lines.append(
            f"    \\resumeSubheading\n"
            f"      {{{_esc(job.company)}}}{{{_esc(job.dates)}}}\n"
            f"      {{{_esc(job.role)}}}{{{_esc(job.location)}}}"
        )
        lines.append("      \\resumeItemListStart")
        for bullet in job.bullets:
            lines.append(f"        \\resumeItem{{{_esc(bullet)}}}")
        lines.append("      \\resumeItemListEnd")
    lines.append(r"  \resumeSubHeadingListEnd")
    return "\n".join(lines)


def _build_projects_block(resume: TailoredResume) -> str:
    lines = [r"  \resumeSubHeadingListStart"]
    for proj in resume.projects:
        heading = f"\\textbf{{{_esc(proj.name)}}}"
        if proj.tech_stack:
            heading += f" $|$ \\emph{{{_esc(proj.tech_stack)}}}"
        date_part = _esc(proj.dates) if proj.dates else ""
        lines.append(f"    \\resumeProjectHeading\n      {{{heading}}}{{{date_part}}}")
        lines.append("      \\resumeItemListStart")
        for bullet in proj.bullets:
            lines.append(f"        \\resumeItem{{{_esc(bullet)}}}")
        lines.append("      \\resumeItemListEnd")
    lines.append(r"  \resumeSubHeadingListEnd")
    return "\n".join(lines)


def _build_skills_block(resume: TailoredResume) -> str:
    lines = []
    for category, items in resume.skills.items():
        items_str = ", ".join(_esc(s) for s in items)
        lines.append(f"     \\textbf{{{_esc(category)}}}: {items_str} \\\\")
    return "\n".join(lines)


def _build_education_block(resume: TailoredResume) -> str:
    if not resume.education:
        return "  % No education entries"
    lines = [r"  \resumeSubHeadingListStart"]
    for edu in resume.education:
        lines.append(
            f"    \\resumeSubheading\n"
            f"      {{{_esc(edu.school)}}}{{{_esc(edu.location)}}}\n"
            f"      {{{_esc(edu.degree)}}}{{{_esc(edu.dates)}}}"
        )
        if edu.bullets:
            lines.append("      \\resumeItemListStart")
            for bullet in edu.bullets:
                lines.append(f"        \\resumeItem{{{_esc(bullet)}}}")
            lines.append("      \\resumeItemListEnd")
    lines.append(r"  \resumeSubHeadingListEnd")
    return "\n".join(lines)


_SECTION_BUILDERS = {
    "experience": lambda r: (
        "%-----------EXPERIENCE-----------\n"
        "\\section{Experience}\n"
        + _build_experience_block(r)
    ),
    "projects": lambda r: (
        "\n%-----------PROJECTS-----------\n"
        "\\section{Projects}\n"
        + _build_projects_block(r)
    ),
    "education": lambda r: (
        "\n%-----------EDUCATION-----------\n"
        "\\section{Education}\n"
        + _build_education_block(r)
    ),
    "skills": lambda r: (
        "\n%-----------TECHNICAL SKILLS-----------\n"
        "\\section{Technical Skills}\n"
        " \\begin{itemize}[leftmargin=0.15in, label={}]\n"
        "  \\small{\\item{\n"
        + _build_skills_block(r)
        + "\n  }}\n \\end{itemize}"
    ),
}


def populate_template(resume: TailoredResume, personal_info: dict) -> str:
    template = TEMPLATE_PATH.read_text(encoding="utf-8")

    # Personal info tokens
    replacements = {
        "{{NAME}}": _esc(personal_info.get("name", "")),
        "{{TITLE}}": _esc(personal_info.get("title", "")),
        "{{PHONE}}": _esc(personal_info.get("phone", "")),
        "{{EMAIL}}": personal_info.get("email", ""),   # email in href — don't escape @
        "{{LINKEDIN}}": personal_info.get("linkedin", ""),
        "{{GITHUB}}": personal_info.get("github", ""),
    }
    for token, value in replacements.items():
        template = template.replace(token, value)

    # Build ordered sections body
    order = resume.sections_order if resume.sections_order else ["experience", "projects", "skills"]
    # Always include skills if not listed explicitly
    if "skills" not in order:
        order = list(order) + ["skills"]

    sections_body_parts = []
    for section in order:
        builder = _SECTION_BUILDERS.get(section)
        if builder:
            sections_body_parts.append(builder(resume))

    template = template.replace("{{SECTIONS_BODY}}", "\n".join(sections_body_parts))
    return template


def compile_to_pdf(latex_source: str) -> bytes:
    if not LATEX_ENGINE:
        raise RuntimeError(
            "No LaTeX engine is installed. "
            "Install tectonic (recommended): brew install tectonic  "
            "or full TeX Live: brew install --cask mactex"
        )

    with tempfile.TemporaryDirectory() as tmpdir:
        tex_path = os.path.join(tmpdir, "resume.tex")

        with open(tex_path, "w", encoding="utf-8") as f:
            f.write(latex_source)

        if _TECTONIC:
            # tectonic handles multiple passes automatically and outputs to the same dir
            compile_cmd = [
                "tectonic",
                "--outdir", tmpdir,
                tex_path,
            ]
            result = subprocess.run(
                compile_cmd,
                capture_output=True,
                text=True,
                timeout=120,  # first run downloads packages — give it time
            )
            if result.returncode != 0:
                log_tail = (result.stderr or result.stdout or "")[-1000:]
                raise RuntimeError(f"tectonic failed. Output:\n{log_tail}")
        else:
            # pdflatex requires two passes to resolve references
            compile_cmd = [
                "pdflatex",
                "-interaction=nonstopmode",
                "-halt-on-error",
                "-output-directory", tmpdir,
                tex_path,
            ]
            for pass_num in range(1, 3):
                result = subprocess.run(
                    compile_cmd,
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                if result.returncode != 0:
                    log_tail = (result.stdout or result.stderr or "")[-1000:]
                    raise RuntimeError(
                        f"pdflatex failed on pass {pass_num}. Log tail:\n{log_tail}"
                    )

        pdf_path = os.path.join(tmpdir, "resume.pdf")
        with open(pdf_path, "rb") as f:
            return f.read()
