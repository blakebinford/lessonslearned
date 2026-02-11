from django.contrib import admin
from .models import Organization, Lesson, SOWAnalysis


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ["name", "created_by", "created_at"]
    search_fields = ["name"]


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ["title", "severity", "discipline", "work_type", "project", "organization", "created_at"]
    list_filter = ["severity", "discipline", "work_type", "organization"]
    search_fields = ["title", "description", "keywords", "project"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(SOWAnalysis)
class SOWAnalysisAdmin(admin.ModelAdmin):
    list_display = ["filename", "work_type", "organization", "created_at"]
    list_filter = ["organization", "work_type"]
    readonly_fields = ["created_at"]
