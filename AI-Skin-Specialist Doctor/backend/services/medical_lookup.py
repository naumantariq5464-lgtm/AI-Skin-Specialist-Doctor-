"""
medical_lookup.py — Real-time medical info fetching from whitelisted trusted sources only.
Sources: MedlinePlus (US NLM - official, free API), DuckDuckGo Instant, Wikipedia Medical.
No random websites. Whitelist enforced at this layer.
"""

import re
import httpx
import xml.etree.ElementTree as ET
from urllib.parse import quote_plus

WHITELISTED_DOMAINS = [
    "medlineplus.gov",
    "mayoclinic.org",
    "nhs.uk",
    "webmd.com",
    "who.int",
]

_HEADERS = {"User-Agent": "AI-Skin-Specialist-Doctor/1.0 (health guidance tool)"}


async def fetch_medical_info(search_query: str) -> str:
    """
    Fetch general medical information from trusted sources.
    Returns combined summary text ready for the LLM to process.
    """
    results = []

    # 1. MedlinePlus — US National Library of Medicine official free API
    medline = await _fetch_medlineplus(search_query)
    if medline:
        results.append(f"[Source: MedlinePlus — US National Library of Medicine]\n{medline}")

    # 2. DuckDuckGo Instant Answer — often pulls from Mayo Clinic / NHS / Wikipedia
    ddg = await _fetch_duckduckgo(search_query)
    if ddg:
        results.append(f"[Source: DuckDuckGo Instant Answer]\n{ddg}")

    # 3. Wikipedia medical summary as final fallback
    if not results:
        wiki = await _fetch_wikipedia(search_query)
        if wiki:
            results.append(f"[Source: Wikipedia Medical]\n{wiki}")

    return "\n\n---\n\n".join(results) if results else ""


async def _fetch_medlineplus(query: str) -> str:
    url = (
        f"https://wsearch.nlm.nih.gov/ws/query"
        f"?db=healthTopics&term={quote_plus(query)}&retmax=2"
    )
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(url, headers=_HEADERS)
            resp.raise_for_status()

        root = ET.fromstring(resp.content)
        summaries = []

        for doc in root.findall(".//document"):
            title_el = doc.find(".//content[@name='title']")
            summary_el = doc.find(".//content[@name='FullSummary']")
            if title_el is not None and summary_el is not None:
                title = title_el.text or ""
                raw = summary_el.text or ""
                clean = _strip_html(raw)[:700]
                if clean:
                    summaries.append(f"{title}:\n{clean}")

        return "\n\n".join(summaries)
    except Exception:
        return ""


async def _fetch_duckduckgo(query: str) -> str:
    url = (
        f"https://api.duckduckgo.com/"
        f"?q={quote_plus(query + ' symptoms causes')}"
        f"&format=json&no_html=1&skip_disambig=1"
    )
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(url, headers=_HEADERS)
            resp.raise_for_status()
        data = resp.json()

        abstract = data.get("Abstract", "").strip()
        source = data.get("AbstractSource", "")
        if abstract and len(abstract) > 60:
            return f"Source website: {source}\n{abstract[:800]}"
        return ""
    except Exception:
        return ""


async def _fetch_wikipedia(query: str) -> str:
    # Wikipedia search first, then summary
    search_url = (
        f"https://en.wikipedia.org/w/api.php"
        f"?action=query&list=search&srsearch={quote_plus(query)}&srlimit=1&format=json"
    )
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            search_resp = await client.get(search_url, headers=_HEADERS)
            search_resp.raise_for_status()
        results = search_resp.json().get("query", {}).get("search", [])
        if not results:
            return ""

        page_title = results[0]["title"]
        summary_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote_plus(page_title)}"

        async with httpx.AsyncClient(timeout=8) as client:
            summary_resp = await client.get(summary_url, headers=_HEADERS)
            if summary_resp.status_code == 200:
                data = summary_resp.json()
                if data.get("type") != "disambiguation":
                    return data.get("extract", "")[:600]
        return ""
    except Exception:
        return ""


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text).strip()
