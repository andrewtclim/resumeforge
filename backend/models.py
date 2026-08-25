from pydantic import BaseModel


class TailorRequest(BaseModel):
    job_description: str
    job_title: str
    company_name: str


class ResumeSection(BaseModel):
    role: str
    company: str
    location: str
    dates: str
    bullets: list[str]


class ProjectSection(BaseModel):
    name: str
    url: str
    tech_stack: str
    dates: str
    bullets: list[str]


class EducationSection(BaseModel):
    school: str
    location: str
    degree: str
    dates: str
    bullets: list[str] = []


class TailoredResume(BaseModel):
    summary_title: str
    experience: list[ResumeSection]
    projects: list[ProjectSection]
    education: list[EducationSection] = []
    skills: dict[str, list[str]]
    sections_order: list[str]
    tailoring_notes: list[str] = []
    work_type: str = ""
    location: str = ""


class RefineRequest(BaseModel):
    job_description: str
    job_title: str
    company_name: str
    current_resume: TailoredResume
    feedback: str


class ScrapeRequest(BaseModel):
    url: str


class RenderRequest(BaseModel):
    resume: TailoredResume


class JobApplication(BaseModel):
    id: str = ""
    date: str = ""
    company: str
    job_title: str
    applied: bool = False
    url: str = ""
    work_type: str = ""
    location: str = ""
    notes: str = ""


class ApplicationUpdate(BaseModel):
    date: str | None = None
    company: str | None = None
    job_title: str | None = None
    applied: bool | None = None
    url: str | None = None
    work_type: str | None = None
    location: str | None = None
    notes: str | None = None
