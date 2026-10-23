# Full stack image: FastAPI backend that also serves the front end.
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 FRONTEND_DIR=/srv/frontend NAGARSETU_DB=/data/nagarsetu.db
WORKDIR /srv/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY index.html favicon.svg /srv/frontend/
COPY css /srv/frontend/css
COPY js /srv/frontend/js
RUN useradd -m app && mkdir /data && chown app /data
USER app
VOLUME /data
EXPOSE 8000
# One worker only: the database is SQLite and the deadline worker runs inside the app.
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8000","--workers","1"]
