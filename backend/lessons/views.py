import logging
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.shortcuts import get_object_or_404

from .models import Organization, Lesson, SOWAnalysis
from .serializers import (
    OrganizationSerializer,
    LessonSerializer,
    SOWAnalyzeRequestSerializer,
    ChatMessageSerializer,
)
from .parsers import parse_xlsx, parse_csv
from . import ai

logger = logging.getLogger(__name__)


class OrganizationViewSet(viewsets.ModelViewSet):
    serializer_class = OrganizationSerializer

    def get_queryset(self):
        return Organization.objects.filter(created_by=self.request.user)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class LessonViewSet(viewsets.ModelViewSet):
    serializer_class = LessonSerializer

    def get_queryset(self):
        qs = Lesson.objects.filter(organization__created_by=self.request.user)
        org_id = self.request.query_params.get("org")
        if org_id:
            qs = qs.filter(organization_id=org_id)
        # Filters
        discipline = self.request.query_params.get("discipline")
        if discipline:
            qs = qs.filter(discipline=discipline)
        severity = self.request.query_params.get("severity")
        if severity:
            qs = qs.filter(severity=severity)
        work_type = self.request.query_params.get("work_type")
        if work_type:
            qs = qs.filter(work_type=work_type)
        search = self.request.query_params.get("search")
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(root_cause__icontains=search)
                | Q(recommendation__icontains=search)
                | Q(keywords__icontains=search)
                | Q(project__icontains=search)
                | Q(location__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        org_id = self.request.data.get("organization")
        org = get_object_or_404(Organization, id=org_id, created_by=self.request.user)
        serializer.save(organization=org, created_by=self.request.user)

    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def import_file(self, request):
        """Import lessons from an XLSX or CSV file."""
        org_id = request.data.get("organization")
        if not org_id:
            return Response({"error": "organization is required"}, status=400)
        org = get_object_or_404(Organization, id=org_id, created_by=request.user)

        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response({"error": "No file uploaded"}, status=400)

        file_bytes = uploaded.read()
        ext = uploaded.name.rsplit(".", 1)[-1].lower()

        if ext in ("xlsx", "xls", "xlsm"):
            parsed, error = parse_xlsx(file_bytes)
        elif ext in ("csv", "tsv"):
            parsed, error = parse_csv(file_bytes)
        else:
            return Response({"error": f"Unsupported file type: .{ext}"}, status=400)

        if error:
            return Response({"error": error}, status=400)
        if not parsed:
            return Response({"error": "No valid lessons found in file"}, status=400)

        # Create lesson objects
        created = 0
        for lesson_data in parsed:
            Lesson.objects.create(
                organization=org,
                created_by=request.user,
                **lesson_data,
            )
            created += 1

        return Response({
            "imported": created,
            "total_in_file": len(parsed),
            "filename": uploaded.name,
        })


class SOWAnalysisViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only viewset for past SOW analyses."""

    def get_queryset(self):
        return SOWAnalysis.objects.filter(organization__created_by=self.request.user)

    def get_serializer_class(self):
        from .serializers import SOWAnalysisSerializer
        return SOWAnalysisSerializer


@api_view(["POST"])
def analyze_sow(request):
    """Run AI analysis on a scope of work against the lessons database."""
    try:
        print(">>> STEP 1: entered view")
        org_id = request.data.get("organization")
        sow_text = request.data.get("sow_text", "")
        work_type = request.data.get("work_type", "")
        filename = request.data.get("filename", "")
        print(f">>> STEP 2: org={org_id}, text_len={len(sow_text)}, wt={work_type}")

        if not org_id:
            return Response({"error": "organization is required"}, status=400)
        if not sow_text:
            return Response({"error": "sow_text is required"}, status=400)

        org = get_object_or_404(Organization, id=org_id, created_by=request.user)
        print(f">>> STEP 3: org found = {org.name}")

        lessons_qs = Lesson.objects.filter(organization=org).values(
            "id", "title", "description", "root_cause", "recommendation",
            "impact", "work_type", "phase", "discipline", "severity",
            "environment", "project", "location", "keywords",
        )
        lessons_list = list(lessons_qs)
        print(f">>> STEP 4: {len(lessons_list)} lessons loaded")

        org_profile = {"name": org.name, "profile_text": org.profile_text}
        print(">>> STEP 5: calling AI")

        results = ai.analyze_sow(sow_text, work_type, lessons_list, org_profile)
        print(f">>> STEP 6: AI returned, keys={list(results.keys()) if isinstance(results, dict) else 'not a dict'}")

        analysis = SOWAnalysis.objects.create(
            organization=org,
            filename=filename,
            sow_text=sow_text[:10000],
            work_type=work_type,
            results=results,
            created_by=request.user,
        )
        print(f">>> STEP 7: saved analysis id={analysis.id}")

        return Response({"id": analysis.id, "results": results})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)


@api_view(["POST"])
def upload_sow_file(request):
    """Extract text from an uploaded SOW document."""
    uploaded = request.FILES.get("file")
    if not uploaded:
        return Response({"error": "No file uploaded"}, status=400)

    ext = uploaded.name.rsplit(".", 1)[-1].lower()
    file_bytes = uploaded.read()

    text = ""
    if ext == "txt":
        text = file_bytes.decode("utf-8-sig")
    elif ext == "docx":
        try:
            import docx
            import io
            doc = docx.Document(io.BytesIO(file_bytes))
            text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except ImportError:
            return Response({"error": "python-docx not installed on server"}, status=500)
    elif ext == "pdf":
        try:
            import pymupdf
            doc = pymupdf.open(stream=file_bytes, filetype="pdf")
            text = "\n".join(page.get_text() for page in doc)
            doc.close()
        except ImportError:
            return Response(
                {"error": "pymupdf not installed. Install with: pip install pymupdf"},
                status=500,
            )
    else:
        return Response({"error": f"Unsupported file type: .{ext}"}, status=400)

    return Response({
        "text": text,
        "filename": uploaded.name,
        "length": len(text),
    })


@api_view(["POST"])
def chat_analyst(request):
    """AI chat analyst endpoint."""
    serializer = ChatMessageSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    org_id = request.data.get("organization")
    if not org_id:
        return Response({"error": "organization is required"}, status=400)
    org = get_object_or_404(Organization, id=org_id, created_by=request.user)

    message = serializer.validated_data["message"]
    history = serializer.validated_data.get("history", [])

    lessons = list(
        Lesson.objects.filter(organization=org).values(
            "id", "title", "description", "root_cause", "recommendation",
            "work_type", "discipline", "severity", "environment",
        )
    )

    org_profile = {"name": org.name, "profile_text": org.profile_text}

    try:
        response_text = ai.chat_with_analyst(message, history, lessons, org_profile)
    except Exception as e:
        logger.exception("Chat analyst failed")
        return Response({"error": str(e)}, status=500)

    return Response({"response": response_text})


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def register(request):
    """Simple user registration endpoint."""
    from django.contrib.auth.models import User

    username = request.data.get("username", "").strip()
    password = request.data.get("password", "")
    email = request.data.get("email", "").strip()

    if not username or not password:
        return Response({"error": "username and password required"}, status=400)
    if User.objects.filter(username=username).exists():
        return Response({"error": "Username already taken"}, status=400)

    user = User.objects.create_user(username=username, password=password, email=email)

    # Create default org
    Organization.objects.create(name=f"{username}'s Organization", created_by=user)

    # Create auth token
    from rest_framework.authtoken.models import Token
    token, _ = Token.objects.get_or_create(user=user)

    return Response({"token": token.key, "user_id": user.id, "username": user.username})


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def login_view(request):
    """Token-based login."""
    from django.contrib.auth import authenticate
    from rest_framework.authtoken.models import Token

    username = request.data.get("username", "")
    password = request.data.get("password", "")

    user = authenticate(username=username, password=password)
    if not user:
        return Response({"error": "Invalid credentials"}, status=401)

    token, _ = Token.objects.get_or_create(user=user)
    return Response({"token": token.key, "user_id": user.id, "username": user.username})