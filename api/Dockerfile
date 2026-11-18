FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd -m -u 1000 app && mkdir -p /data/uploads && chown -R app:app /data /app
USER app
EXPOSE 8000
# 1 worker saja: hemat RAM. Migrasi dijalankan oleh app saat startup.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers"]
