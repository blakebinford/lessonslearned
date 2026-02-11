from rest_framework import serializers
from .models import Organization, Lesson, SOWAnalysis


class OrganizationSerializer(serializers.ModelSerializer):
    lesson_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = ["id", "name", "profile_text", "lesson_count", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def get_lesson_count(self, obj):
        return obj.lessons.count()


class LessonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = [
            "id", "title", "description", "root_cause", "recommendation", "impact",
            "work_type", "phase", "discipline", "severity", "environment",
            "project", "location", "keywords",
            "logged_by", "status", "assigned_to", "supporting_docs",
            "created_by", "created_at", "updated_at",
        ]
        read_only_fields = ["created_by", "created_at", "updated_at"]


class LessonBulkImportSerializer(serializers.Serializer):
    file = serializers.FileField(help_text="XLSX, XLS, or CSV file to import")


class SOWAnalysisSerializer(serializers.ModelSerializer):
    class Meta:
        model = SOWAnalysis
        fields = ["id", "filename", "sow_text", "work_type", "results", "created_at"]
        read_only_fields = ["results", "created_at"]


class SOWAnalyzeRequestSerializer(serializers.Serializer):
    sow_text = serializers.CharField(max_length=500000, required=False, default="")
    work_type = serializers.CharField(max_length=100, required=False, default="")
    filename = serializers.CharField(max_length=255, required=False, default="")


class SOWFileUploadSerializer(serializers.Serializer):
    file = serializers.FileField(help_text=".docx, .txt, or .pdf file")


class ChatMessageSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=5000, required=False, default="")
    history = serializers.ListField(
        child=serializers.DictField(), required=False, default=list
    )
