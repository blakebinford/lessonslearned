from django.db import models
from django.conf import settings


class Organization(models.Model):
    name = models.CharField(max_length=255)
    profile_text = models.TextField(
        blank=True,
        help_text="QMS programs, procedures, and capabilities already in place. "
        "Used to prevent AI from recommending things you already have.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="organizations"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["name"]


class Lesson(models.Model):
    SEVERITY_CHOICES = [
        ("Critical", "Critical"),
        ("High", "High"),
        ("Medium", "Medium"),
        ("Low", "Low"),
    ]

    WORK_TYPE_CHOICES = [
        ("Pipeline Construction", "Pipeline Construction"),
        ("Compressor Station", "Compressor Station"),
        ("Meter Station", "Meter Station"),
        ("HDD/Bore", "HDD/Bore"),
        ("Hydrostatic Test", "Hydrostatic Test"),
        ("Tie-In", "Tie-In"),
        ("Coating/Cathodic Protection", "Coating/Cathodic Protection"),
        ("Civil/Earthwork", "Civil/Earthwork"),
        ("Fabrication", "Fabrication"),
        ("Commissioning", "Commissioning"),
        ("Integrity/Repair", "Integrity/Repair"),
        ("Environmental", "Environmental"),
        ("Other", "Other"),
    ]

    PHASE_CHOICES = [
        ("Pre-Construction", "Pre-Construction"),
        ("Mobilization", "Mobilization"),
        ("Construction", "Construction"),
        ("Mechanical Completion", "Mechanical Completion"),
        ("Commissioning", "Commissioning"),
        ("Close-Out", "Close-Out"),
    ]

    DISCIPLINE_CHOICES = [
        ("Quality", "Quality"),
        ("Welding", "Welding"),
        ("NDE", "NDE"),
        ("Coatings", "Coatings"),
        ("Civil", "Civil"),
        ("Mechanical", "Mechanical"),
        ("Electrical", "Electrical"),
        ("Environmental", "Environmental"),
        ("Safety", "Safety"),
        ("Project Controls", "Project Controls"),
        ("Materials/Procurement", "Materials/Procurement"),
        ("Regulatory", "Regulatory"),
    ]

    ENVIRONMENT_CHOICES = [
        ("Arctic/Cold Weather", "Arctic/Cold Weather"),
        ("Desert/Extreme Heat", "Desert/Extreme Heat"),
        ("Coastal/Saltwater", "Coastal/Saltwater"),
        ("Wetland/Swamp", "Wetland/Swamp"),
        ("Mountain/Steep Terrain", "Mountain/Steep Terrain"),
        ("Urban/Congested", "Urban/Congested"),
        ("River/Water Crossing", "River/Water Crossing"),
        ("Normal", "Normal"),
    ]

    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="lessons"
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    root_cause = models.TextField(blank=True)
    recommendation = models.TextField(blank=True)
    impact = models.TextField(blank=True)
    work_type = models.CharField(max_length=50, blank=True, choices=WORK_TYPE_CHOICES)
    phase = models.CharField(max_length=50, blank=True, choices=PHASE_CHOICES)
    discipline = models.CharField(max_length=50, blank=True, choices=DISCIPLINE_CHOICES)
    severity = models.CharField(max_length=20, default="Medium", choices=SEVERITY_CHOICES)
    environment = models.CharField(max_length=50, blank=True, choices=ENVIRONMENT_CHOICES)
    project = models.CharField(max_length=255, blank=True, help_text="Source project name")
    location = models.CharField(max_length=255, blank=True)
    keywords = models.TextField(blank=True, help_text="Comma-separated keywords/tags")

    # Tracking fields
    logged_by = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=50, blank=True)
    assigned_to = models.CharField(max_length=255, blank=True)
    supporting_docs = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="lessons"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.severity})"

    class Meta:
        ordering = ["-created_at"]


class SOWAnalysis(models.Model):
    organization = models.ForeignKey(
        Organization, on_delete=models.CASCADE, related_name="sow_analyses"
    )
    filename = models.CharField(max_length=255, blank=True)
    sow_text = models.TextField()
    work_type = models.CharField(max_length=100, blank=True)
    results = models.JSONField(default=dict, help_text="AI analysis results JSON")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"SOW Analysis: {self.filename or 'Untitled'} ({self.created_at:%Y-%m-%d})"

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "SOW analyses"
