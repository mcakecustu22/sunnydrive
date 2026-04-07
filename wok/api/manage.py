#!/usr/bin/env python
import os
import sys
from dotenv import load_dotenv  # <-- 1. เพิ่มบรรทัดนี้

def main() -> None:
    load_dotenv()  # <-- 2. เพิ่มบรรทัดนี้เพื่อโหลด .env ก่อนเริ่มระบบ
    
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError("Couldn't import Django.") from exc
    execute_from_command_line(sys.argv)

if __name__ == "__main__":
    main()