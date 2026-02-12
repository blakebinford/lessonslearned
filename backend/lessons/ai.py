"""
Anthropic API integration for lessons learned analysis.
All AI calls are proxied through the backend to protect the API key.
"""
import json
import logging
import httpx
from django.conf import settings

logger = logging.getLogger(__name__)

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"


def _call_anthropic(system_prompt, user_message, max_tokens=4000, messages=None):
    """Make a request to the Anthropic API. Returns the text response."""
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY not configured. Set it in your environment.")

    if messages is None:
        messages = [{"role": "user", "content": user_message}]

    payload = {
        "model": settings.ANTHROPIC_MODEL,
        "max_tokens": max_tokens,
        "system": system_prompt,
        "messages": messages,
    }

    headers = {
        "Content-Type": "application/json",
        "x-api-key": settings.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
    }

    with httpx.Client(timeout=120) as client:
        resp = client.post(ANTHROPIC_URL, json=payload, headers=headers)
        if not resp.is_success:
            error_body = resp.text
            logger.error(f"Anthropic API error {resp.status_code}: {error_body[:500]}")
            raise ValueError(f"Anthropic API error {resp.status_code}: {error_body[:300]}")
        data = resp.json()

    text_parts = [
        block["text"] for block in data.get("content", []) if block.get("type") == "text"
    ]
    return "\n".join(text_parts)


def _parse_json_response(text):
    """Parse JSON from AI response, with repair for truncated responses."""
    clean = text.replace("```json", "").replace("```", "").strip()

    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        # Attempt repair
        repaired = clean
        # Fix unterminated strings
        if repaired.count('"') % 2 != 0:
            repaired += '"'
        # Remove trailing commas
        repaired = repaired.rstrip().rstrip(",")
        # Close open brackets using a stack
        stack = []
        for ch in repaired:
            if ch == "{":
                stack.append("}")
            elif ch == "[":
                stack.append("]")
            elif ch in ("}", "]") and stack:
                stack.pop()
        repaired += "".join(reversed(stack))

        try:
            return json.loads(repaired)
        except json.JSONDecodeError as e:
            logger.warning(f"JSON repair failed: {e}")
            return {"error": "Analysis response was truncated. Please try again."}


def _build_analysis_context(sow_analysis, lessons, org_profile):
    """
    Build the shared context dict used by all deliverable generators.
    Accepts a SOWAnalysis model instance, the lessons queryset (list of dicts),
    and the org_profile dict.
    Returns a dict with sow_text, work_type, matches (with full lesson details),
    gaps, recommendations, summary, and org_profile.
    """
    results = sow_analysis.results or {}
    matches = results.get("matches", [])

    # Build a lookup of lessons by id
    lessons_by_id = {l["id"]: l for l in lessons}

    # Enrich matches with full lesson details
    enriched_matches = []
    for m in matches:
        lesson = lessons_by_id.get(m.get("lessonId"))
        enriched = {
            "lessonId": m.get("lessonId"),
            "relevance": m.get("relevance", ""),
            "reason": m.get("reason", ""),
        }
        if lesson:
            enriched["lesson"] = {
                "id": lesson["id"],
                "title": lesson.get("title", ""),
                "description": lesson.get("description", "")[:500],
                "root_cause": lesson.get("root_cause", "")[:300],
                "recommendation": lesson.get("recommendation", "")[:300],
                "work_type": lesson.get("work_type", ""),
                "phase": lesson.get("phase", ""),
                "discipline": lesson.get("discipline", ""),
                "severity": lesson.get("severity", ""),
                "environment": lesson.get("environment", ""),
                "project": lesson.get("project", ""),
                "location": lesson.get("location", ""),
                "keywords": lesson.get("keywords", "")[:100],
            }
        enriched_matches.append(enriched)

    return {
        "sow_text": sow_analysis.sow_text[:8000],
        "work_type": sow_analysis.work_type or "",
        "summary": results.get("summary", ""),
        "matches": enriched_matches,
        "gaps": results.get("gaps", []),
        "recommendations": results.get("recommendations", []),
        "org_profile": org_profile,
    }


DELIVERABLE_TYPES = {
    "risk_register",
    "staffing_estimate",
    "spec_gaps",
    "executive_narrative",
}


def generate_deliverable(deliverable_type, context, params=None):
    """
    Dispatch to the appropriate deliverable generator stub.
    context comes from _build_analysis_context().
    Returns a dict with the deliverable content.
    """
    generators = {
        "risk_register": _generate_risk_register,
        "staffing_estimate": _generate_staffing_estimate,
        "spec_gaps": _generate_spec_gaps,
        "executive_narrative": _generate_executive_narrative,
    }
    generator = generators.get(deliverable_type)
    if not generator:
        raise ValueError(f"Unknown deliverable type: {deliverable_type}")
    return generator(context, params or {})


def _generate_risk_register(context, params):
    """Stub: Generate project risk register from applicable lessons."""
    return {
        "title": "Risk Register",
        "status": "stub",
        "message": "Risk register generation not yet implemented. "
        "Will produce a structured risk register from the "
        f"{len(context['matches'])} applicable lessons.",
    }


def _generate_staffing_estimate(context, params):
    """Stub: Estimate quality staffing requirements for scope."""
    return {
        "title": "Quality Staffing Estimate",
        "status": "stub",
        "message": "Staffing estimate generation not yet implemented. "
        "Will estimate quality staffing requirements based on "
        "the scope and lessons history.",
    }


def _generate_spec_gaps(context, params):
    """Stub: Flag code/standard risks from lessons history."""
    return {
        "title": "Specification Gaps",
        "status": "stub",
        "message": "Specification gap analysis not yet implemented. "
        "Will flag code and standard risks from "
        f"{len(context['gaps'])} identified gaps.",
    }


def _generate_executive_narrative(context, params):
    """Stub: One-page executive narrative for bid review."""
    return {
        "title": "Executive Summary",
        "status": "stub",
        "message": "Executive narrative generation not yet implemented. "
        "Will produce a one-page narrative summarizing the scope "
        "analysis for bid review.",
    }


def analyze_sow(sow_text, work_type, lessons, org_profile):
    """
    Cross-reference a scope of work against the lessons learned database.
    Returns structured analysis results.
    """
    lessons_context = [
        {
            "id": l["id"],
            "title": l["title"],
            "description": l["description"][:300],
            "rootCause": l.get("root_cause", "")[:200],
            "recommendation": l.get("recommendation", "")[:200],
            "workType": l.get("work_type", ""),
            "phase": l.get("phase", ""),
            "discipline": l.get("discipline", ""),
            "severity": l.get("severity", ""),
            "environment": l.get("environment", ""),
            "project": l.get("project", ""),
            "location": l.get("location", ""),
            "keywords": l.get("keywords", "")[:100],
        }
        for l in lessons
    ]

    # Truncate SOW to fit context window
    sow_text = sow_text[:8000]

    org_context = ""
    if org_profile.get("profile_text"):
        org_context = f"""
CRITICAL — ORGANIZATION CONTEXT:
{f'Organization: {org_profile["name"]}' if org_profile.get("name") else ""}
The following programs, procedures, and systems are ALREADY IN PLACE at this organization. Do NOT recommend establishing, creating, or implementing any of these — they already exist. Instead, focus your recommendations on how to APPLY these existing programs effectively to the specific scope, or flag where existing programs may need to be adapted for this scope's unique conditions.

EXISTING PROGRAMS AND CAPABILITIES:
{org_profile["profile_text"][:6000]}
"""

    work_type_filter = ""
    if work_type:
        work_type_filter = f"""
CRITICAL — SCOPE WORK TYPE: {work_type}
Only include lessons that are genuinely applicable to {work_type} work. Be strict about this:
- Do NOT match lessons that are specific to a different work type. For example, pipeline mainline spread activities (field bending, stringing, lowering-in, mainline welding production, ROW grading) do NOT apply to facilities/compressor station work, and vice versa.
- DO match lessons about cross-cutting topics that apply regardless of work type: procurement issues, material traceability, QMS processes, NDE, client communication, welding quality (when the welding methods overlap), coating, safety, weather/environmental conditions.
- When in doubt whether a lesson crosses over, err on the side of EXCLUDING it. The user would rather miss a marginal match than get irrelevant results.
"""

    system_prompt = f"""You are a senior quality and construction management analyst for pipeline and energy construction projects. You have access to a lessons learned database and a scope of work document.
{org_context}
{work_type_filter}
Your task: Cross-reference the scope of work against the lessons learned database and identify which lessons are applicable to the upcoming work. Consider matches based on:
- Work type (pipeline, compressor station, HDD, etc.) — {"FILTER STRICTLY per above" if work_type else "match broadly"}
- Environmental conditions (arctic, desert, wetland, etc.)
- Location similarities
- Phase of work
- Discipline overlap
- Similar materials, methods, or equipment
- Seasonal/weather parallels
- Regulatory or code similarities

Respond ONLY in valid JSON with this exact structure:
{{
  "summary": "Brief 2-3 sentence overview of the scope and key risk areas",
  "matches": [
    {{
      "lessonId": <the lesson ID as an integer>,
      "relevance": "High" or "Medium" or "Low",
      "reason": "1-2 sentence explanation of why this lesson applies to this scope"
    }}
  ],
  "gaps": ["List of risk areas in the SOW where no lessons learned exist"],
  "recommendations": ["Top 3-5 actionable recommendations based on the applicable lessons.{' Do NOT recommend creating programs that already exist per the organization context above.' if org_profile.get('profile_text') else ''}"]
}}

Be thorough but practical. A senior Quality Director will use this to prepare for the work. Keep your JSON response complete but concise — 1-2 sentences per field is sufficient."""

    user_msg = ""
    if work_type:
        user_msg += f"SCOPE WORK TYPE: {work_type}\n\n"
    user_msg += f"SCOPE OF WORK:\n{sow_text[:8000]}\n\n"
    user_msg += f"LESSONS LEARNED DATABASE ({len(lessons_context)} entries):\n"
    user_msg += json.dumps(lessons_context, indent=1)

    text = _call_anthropic(system_prompt, user_msg, max_tokens=4000)
    return _parse_json_response(text)


def chat_with_analyst(message, history, lessons, org_profile):
    """
    AI chat analyst with full lessons database context.
    Returns the assistant's response text.
    """
    lessons_summary = json.dumps(
        [
            {
                "id": l["id"],
                "title": l["title"],
                "desc": l["description"][:200],
                "rootCause": l.get("root_cause", "")[:200],
                "rec": l.get("recommendation", "")[:200],
                "workType": l.get("work_type", ""),
                "discipline": l.get("discipline", ""),
                "severity": l.get("severity", ""),
                "env": l.get("environment", ""),
            }
            for l in lessons
        ],
        indent=1,
    )

    org_context = ""
    if org_profile.get("profile_text"):
        org_context = f"\nThe organization already has established programs and procedures. Do not recommend creating programs that already exist. Here is their organizational context:\n{org_profile['profile_text'][:4000]}"

    system_prompt = f"""You are a senior quality and construction management analyst helping manage a lessons learned database for pipeline and energy construction. You have {len(lessons)} lessons in the database.

Current database:
{lessons_summary}

Help the user:
- Find relevant lessons for specific situations
- Suggest new lessons that should be captured
- Analyze patterns across lessons (recurring root causes, high-risk areas)
- Draft lesson content when asked
- Identify gaps in the database
{org_context}
Be direct and field-practical. This is for a senior Quality Director."""

    messages = list(history) + [{"role": "user", "content": message}]
    return _call_anthropic(system_prompt, "", max_tokens=1000, messages=messages)