# Dockerfile for Flask backend (Cloud Run compatible)
# Uses Python slim image and runs Gunicorn in production

FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Set workdir
WORKDIR /app

# System deps (if needed)
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Default port for Cloud Run
ENV PORT=8080

# Health
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import requests; import os; import sys;\nimport socket;\nimport time;\nimport urllib.request;\nurl=f'http://127.0.0.1:{os.environ.get('PORT','8080')}/health';\nurllib.request.urlopen(url)" || exit 1

# Use Gunicorn in production; fallback to python app.py
# You can override CMD to `python app.py` for local testing
CMD ["gunicorn", "app:app", "-b", "0.0.0.0:8080", "--workers", "2", "--threads", "8", "--timeout", "0"]
