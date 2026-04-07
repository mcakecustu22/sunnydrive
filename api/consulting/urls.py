from django.urls import path

from .views import AnalyzePlanView, EVModelsView

urlpatterns = [
    path("ev-models/", EVModelsView.as_view(), name="ev-models"),
    path("analyze/", AnalyzePlanView.as_view(), name="analyze"),
]
