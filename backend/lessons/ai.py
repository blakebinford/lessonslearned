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

        # Handle truncation mid-risk-object: find the last complete JSON
        # object in a "risks" array and discard the partial one.
        risks_key = '"risks"'
        if risks_key in repaired:
            # Find the last complete "}" that closes a risk object
            last_complete = repaired.rfind("}")
            if last_complete > 0:
                # Check if we're inside an unterminated string value
                # (odd number of quotes after last complete object)
                after_last = repaired[last_complete + 1:]
                if after_last.count('"') % 2 != 0 or (
                    after_last.strip().rstrip(",").strip()
                    and not after_last.strip().startswith("]")
                    and not after_last.strip().startswith("}")
                ):
                    # Truncate to the last complete risk object
                    # Walk back to find the last "}" that is part of a
                    # complete object (followed by valid array content)
                    pos = last_complete
                    while pos > 0:
                        try:
                            # Try closing array and outer object from here
                            candidate = repaired[:pos + 1].rstrip().rstrip(",")
                            candidate += "]}"
                            json.loads(candidate)
                            repaired = repaired[:pos + 1].rstrip().rstrip(",") + "]}"
                            try:
                                return json.loads(repaired)
                            except json.JSONDecodeError:
                                pass
                            break
                        except json.JSONDecodeError:
                            # Find the next "}" going backwards
                            pos = repaired.rfind("}", 0, pos)
                    # If the walk-back didn't produce valid JSON, fall
                    # through to the generic bracket-closing repair below.

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
    """Generate project risk register from applicable lessons and identified gaps."""
    sow_text = context["sow_text"][:6000]
    matches = context["matches"]
    gaps = context["gaps"]
    org_profile = context.get("org_profile", {})

    # Build matched lessons detail block
    lessons_detail = []
    for m in matches:
        entry = {
            "lessonId": m.get("lessonId"),
            "relevance": m.get("relevance", ""),
            "reason": m.get("reason", ""),
        }
        if m.get("lesson"):
            entry["lesson"] = m["lesson"]
        lessons_detail.append(entry)

    org_context = ""
    if org_profile.get("profile_text"):
        org_context = (
            f"\nORGANIZATION CONTEXT — EXISTING PROGRAMS:\n"
            f"Organization: {org_profile.get('name', '')}\n"
            f"The following programs and systems are ALREADY IN PLACE. "
            f"Reference these in mitigations where applicable instead of "
            f"recommending new programs:\n"
            f"{org_profile['profile_text'][:4000]}\n"
        )

    system_prompt = (
        "You are a senior quality risk management specialist for pipeline and "
        "energy construction. Generate a project-specific quality risk register "
        "based on historical lessons learned and identified gaps from a scope of "
        "work analysis."
    )

    user_msg = f"""Based on the following scope of work, matched lessons learned, and identified gaps, generate a project-specific quality risk register.

SCOPE OF WORK:
{sow_text}

MATCHED LESSONS LEARNED ({len(lessons_detail)} lessons):
{json.dumps(lessons_detail, indent=1)}

IDENTIFIED GAPS (risk areas with no historical lessons):
{json.dumps(gaps, indent=1)}
{org_context}
INSTRUCTIONS:
- Derive risks from BOTH the matched lessons (historical evidence) AND the identified gaps (unknown risks).
- For risks derived from lessons, include the specific lesson IDs in source_lessons.
- For risks derived from gaps where no historical data exists, set source_lessons to ["No historical data — gap-based risk"].
- Assign likelihood based on how frequently similar issues appear in the lessons database.
- Consequence should reflect schedule, cost, and safety/regulatory impact.
- Risk level matrix: Critical = High likelihood + High consequence, High = High/Med or Med/High, Medium = Med/Med or Low/High or High/Low, Low = Low/Low or Low/Med or Med/Low.
- Mitigations should reference the organization's existing programs where applicable (per org context above).
- Suggest a responsible role for each risk (e.g. "Project Quality Manager", "Lead Welding Inspector", "NDE Level III"), not a person name.
- Generate up to 10 risks — enough to be useful but not padded with obvious filler.
- Keep each field value under 30 words. Be precise, not verbose.
- Number risks QR-001 through QR-XXX.

Respond ONLY in valid JSON with this exact structure:
{{
  "risks": [
    {{
      "id": "QR-001",
      "category": "e.g. Welding Quality",
      "description": "1 concise sentence referencing scope conditions",
      "likelihood": "High" or "Medium" or "Low",
      "consequence": "High" or "Medium" or "Low",
      "risk_level": "Critical" or "High" or "Medium" or "Low",
      "source_lessons": ["list of lesson IDs or gap-based note"],
      "mitigation": "1 concise sentence",
      "residual_risk": "Low" or "Medium",
      "owner": "Suggested responsible role"
    }}
  ],
  "summary": "2-3 sentence overview of the risk profile for this scope"
}}"""

    text = _call_anthropic(system_prompt, user_msg, max_tokens=8000)
    result = _parse_json_response(text)

    if "error" in result:
        return {
            "title": "Risk Register",
            "status": "error",
            "message": result["error"],
        }

    if "risks" in result and isinstance(result["risks"], list):
        print(f">>> Risk register: {len(result['risks'])} risks parsed")

    result["title"] = "Risk Register"
    return result


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