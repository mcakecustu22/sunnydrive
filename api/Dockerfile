# ใช้ Python version ที่คุณพัฒนา
FROM python:3.11-slim

# ตั้งค่า environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

# ลง dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ก๊อปปี้โค้ดทั้งหมด
COPY . .

# สั่งรันรวบรวมไฟล์ static (สำหรับ whitenoise)
RUN python manage.py collectstatic --noinput

# สั่งรัน server ผ่าน gunicorn (พอร์ต 8080 ตรงกับที่ตั้งในหน้าเว็บ)
CMD ["gunicorn", "--bind", ":8080", "config.wsgi"]