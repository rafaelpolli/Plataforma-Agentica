# Hugging Face Spaces Docker SDK image for the Engine.
# HF runs the container exposed on port 7860 over HTTPS.
# Local: docker build -t engine . && docker run -p 7860:7860 engine
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

RUN pip install --no-cache-dir uv

# Copy dependency manifest first so the layer caches across code changes.
COPY pyproject.toml ./
RUN uv pip install --system --no-cache .

# Then copy source.
COPY engine ./engine

EXPOSE 7860

# Bind to 0.0.0.0:7860 — HF Spaces requires this exact port.
CMD ["uvicorn", "engine.main:app", "--host", "0.0.0.0", "--port", "7860"]
