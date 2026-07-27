FROM debian:trixie-slim AS libredwg-builder

ARG LIBREDWG_VERSION=0.14
ARG LIBREDWG_SHA256=62ebb73b984f865960f20ed26619ea5f8789d5e3fd088fa40a2598384da81275

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential pkg-config python3 ca-certificates curl xz-utils \
    && curl -fsSL "https://github.com/LibreDWG/libredwg/releases/download/${LIBREDWG_VERSION}/libredwg-${LIBREDWG_VERSION}.tar.xz" -o /tmp/libredwg.tar.xz \
    && echo "${LIBREDWG_SHA256}  /tmp/libredwg.tar.xz" | sha256sum -c - \
    && mkdir /tmp/libredwg-src \
    && tar -xJf /tmp/libredwg.tar.xz -C /tmp/libredwg-src --strip-components=1 \
    && cd /tmp/libredwg-src \
    && ./configure --disable-bindings --disable-docs --disable-shared \
    && make -j2 \
    && install -Dm755 programs/dwg2SVG /opt/libredwg/dwg2SVG \
    && install -Dm755 programs/dwg2dxf /opt/libredwg/dwg2dxf

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    TMPDIR=/tmp/belgelab \
    OPENBLAS_CORETYPE=generic

RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-tur \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
COPY --from=libredwg-builder /opt/libredwg/dwg2SVG /usr/local/bin/dwg2SVG
COPY --from=libredwg-builder /opt/libredwg/dwg2dxf /usr/local/bin/dwg2dxf
RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /tmp/belgelab \
    && chown -R appuser:appuser /app /tmp/belgelab
USER appuser

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=3)"

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT} --workers 2 --threads 2 --timeout 180 --access-logfile - --error-logfile - server:app"]
