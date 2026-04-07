from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    # ลบคำว่า "api/" ออก ให้เหลือแค่นี้ 👇
    path("", include("consulting.urls")), 
]