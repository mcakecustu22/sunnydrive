import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent





# Lightweight .env loader for local development.
env_path = BASE_DIR / ".env"
if env_path.exists():
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())

DEBUG = os.getenv("DEBUG", "False") == "True"
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

if os.getenv("FLY_APP_NAME"):
    ALLOWED_HOSTS.append(f"{os.getenv('FLY_APP_NAME')}.fly.dev")

GOOGLE_SOLAR_API_KEY = os.environ.get("GOOGLE_SOLAR_API_KEY")
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "consulting",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",  # ← เพิ่มบรรทัดนี้
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "config.wsgi.application"

import dj_database_url

# settings.py
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# สำคัญ: ต้องระบุ STATIC_ROOT เพื่อให้รันบนเซิร์ฟเวอร์ได้
STATIC_ROOT = BASE_DIR / "staticfiles"

LANGUAGE_CODE = "th-th"
TIME_ZONE = "Asia/Bangkok"
USE_I18N = True
USE_TZ = True

STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ตั้งค่า CORS เพื่อให้ Vercel ยิง API มาหาได้
CORS_ALLOWED_ORIGINS = [
    "https://sunnydrive1.vercel.app",       
]

# หากต้องการให้ครอบคลุมตอนพัฒนา (Optional)
if DEBUG:
    CORS_ALLOWED_ORIGINS.append("http://localhost:5173") # พอร์ตปกติของ Vite
