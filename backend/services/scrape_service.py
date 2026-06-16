import httpx
from bs4 import BeautifulSoup
import logging

logger = logging.getLogger(__name__)

TIMEOUT = 15.0
MAX_CHARS = 8000

STRIP_TAGS = {"nav", "footer", "script", "style", "aside", "header"}

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


async def scrape_job_description(url: str) -> str:
    async with httpx.AsyncClient(
        headers=BROWSER_HEADERS, follow_redirects=True, timeout=TIMEOUT
    ) as client:
        try:
            response = await client.get(url)
        except httpx.TimeoutException:
            raise httpx.TimeoutException(
                f"Request to {url!r} timed out after {TIMEOUT}s. "
                "Try pasting the job description directly."
            )

    if response.status_code == 403:
        raise ValueError(
            "The site returned 403 Forbidden — it is blocking automated requests. "
            "Please paste the job description text directly instead of using the URL."
        )

    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup.find_all(STRIP_TAGS):
        tag.decompose()

    # Walk selectors from most to least semantic; use the first match with enough text
    selectors = [
        "article",
        "main",
        "[class*='job-description']",
        "[class*='jobDescription']",
        "[class*='description']",
        "[id*='job']",
        "body",
    ]
    for selector in selectors:
        container = soup.select_one(selector)
        if container:
            text = container.get_text(separator="\n", strip=True)
            if len(text) > 200:
                logger.debug("Scraped %d chars via selector %r", len(text), selector)
                return text[:MAX_CHARS]

    return soup.get_text(separator="\n", strip=True)[:MAX_CHARS]
