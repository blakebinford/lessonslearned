from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r"organizations", views.OrganizationViewSet, basename="organization")
router.register(r"lessons", views.LessonViewSet, basename="lesson")
router.register(r"sow-analyses", views.SOWAnalysisViewSet, basename="sow-analysis")

urlpatterns = [
    path("", include(router.urls)),
    path("sow/analyze/", views.analyze_sow, name="analyze-sow"),
    path("sow/upload/", views.upload_sow_file, name="upload-sow"),
    path("chat/", views.chat_analyst, name="chat-analyst"),
    path("register/", views.register, name="register"),
    path("login/", views.login_view, name="login"),
]
