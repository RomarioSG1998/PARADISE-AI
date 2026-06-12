# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies (needed by curl-cffi)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    tesseract-ocr \
    tesseract-ocr-por \
    tesseract-ocr-eng \
    poppler-utils \
    libpoppler-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --prefix=/install --no-cache-dir -r requirements.txt

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Install runtime OCR system dependencies (Tesseract + Poppler)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-por \
    tesseract-ocr-eng \
    poppler-utils \
    libpoppler-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY app.py .
COPY database/ ./database/
COPY templates/ ./templates/
COPY static/ ./static/
COPY routes/ ./routes/
COPY services/ ./services/
COPY utils/ ./utils/

# .env is injected at runtime via docker-compose / --env-file
# hub.db is persisted via a named volume

ENV PYTHONUNBUFFERED=1 \
    FLASK_ENV=production

EXPOSE 5000

CMD ["python", "app.py"]
