# ---- Stage 1: Build React frontend ----
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Python backend + tectonic ----
FROM python:3.11-slim

# Install system dependencies for tectonic
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    fontconfig \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Install tectonic binary
RUN curl -fsSL \
    https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.16.9/tectonic-0.16.9-x86_64-unknown-linux-musl.tar.gz \
    | tar xz -C /usr/local/bin/

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ ./backend/
COPY cv/ ./cv/
COPY templates/ ./templates/

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Pre-warm the tectonic package cache so the first real compile isn't slow
RUN printf '%s\n' '\documentclass{article}\usepackage{enumitem}\usepackage[hidelinks]{hyperref}\usepackage{tabularx}\usepackage{titlesec}\usepackage{fancyhdr}\begin{document}warmup\end{document}' \
    > /tmp/warmup.tex \
    && tectonic /tmp/warmup.tex --outdir /tmp \
    && rm /tmp/warmup.*

ENV PYTHONUNBUFFERED=1
EXPOSE 8080

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
