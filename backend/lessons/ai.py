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
        resp.raise_for_status()
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


def analyze_sow(sow_text, work_type, lessons, org_profile):
    """
    Cross-reference a scope of work against the lessons learned database.
    Returns structured analysis results.
    """
    lessons_context = [
        {
            "id": l["id"],
            "title": l["title"],
            "description": l["description"],
            "rootCause": l.get("root_cause", ""),
            "recommendation": l.get("recommendation", ""),
            "workType": l.get("work_type", ""),
            "phase": l.get("phase", ""),
            "discipline": l.get("discipline", ""),
            "severity": l.get("severity", ""),
            "environment": l.get("environment", ""),
            "project": l.get("project", ""),
            "location": l.get("location", ""),
            "keywords": l.get("keywords", ""),
        }
        for l in lessons
    ]

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
