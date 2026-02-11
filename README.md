# Lessons Learned

A web application for capturing, managing, and applying construction quality lessons learned across projects. Upload a scope of work and AI cross-references your lessons database to surface applicable lessons, identify gaps, and generate actionable recommendations for bid review.

Built for pipeline and energy construction quality management.

## Features

- **Lessons Log** — Add, edit, search, and filter lessons with structured metadata (discipline, severity, work type, phase, environment, project, location)
- **XLSX/CSV Import** — Bulk import lessons from spreadsheets with automatic column mapping
- **SOW Analysis** — Upload a scope of work and AI identifies applicable lessons, gaps, and recommendations filtered by work type (pipeline vs. facilities vs. HDD, etc.)
- **Organization Profile** — Upload your Quality Manual so the AI knows what programs you already have and stops recommending things you've already built
- **AI Analyst Chat** — Conversational interface to query patterns, draft new lessons, and identify database gaps
- **Export for Bid Review** — Clean formatted report with lessons grouped by relevance, recommendations, and gap analysis
- **Multi-user** — Token-based authentication, per-organization data isolation

## Tech Stack

- **Backend**: Django 5 + Django REST Framework
- **Frontend**: React 18 + Vite
- **Database**: PostgreSQL (production) / SQLite (development)
- **AI**: Anthropic Claude API (proxied through backend)
- **Deployment**: Docker Compose

---

## Quick Start (Local Development)

### Prerequisites

- Python 3.11+
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### 1. Clone and configure

```bash
git clone <your-repo-url> lessons-learned
cd lessons-learned
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### 2. Backend setup

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run migrations and create a superuser
python manage.py migrate
python manage.py createsuperuser

# Start the dev server
python manage.py runserver
```

The API is now running at `http://localhost:8000`. Django admin is at `http://localhost:8000/admin/`.

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The frontend is now running at `http://localhost:5173`. Vite automatically proxies `/api/*` requests to the Django backend.

### 4. Create your account

Open `http://localhost:5173` in your browser. Register a new account — this automatically creates an Organization for you. Start adding lessons or import from a spreadsheet.

---

## Production Deployment (Docker)

### 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with production values:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
DJANGO_SECRET_KEY=<generate-a-random-key>
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
DB_PASSWORD=a-strong-database-password
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

Generate a Django secret key:
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 2. Build and run

```bash
docker compose up -d --build
```

This starts three containers:
- **db** — PostgreSQL on port 5432
- **backend** — Django/Gunicorn on port 8000
- **frontend** — Nginx serving React + proxying API on port 3000

### 3. Create admin user

```bash
docker compose exec backend python manage.py createsuperuser
```

### 4. Access the app

Open `http://localhost:3000` (or your domain).

---

## Deploy to Railway / Render

For a managed deployment without Docker:

### Railway

1. Push your repo to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Add a PostgreSQL service
4. Add a new service from your repo, set root directory to `backend`
5. Add environment variables from `.env.example`
6. Set the start command: `python manage.py migrate && gunicorn config.wsgi --bind 0.0.0.0:$PORT --workers 3 --timeout 120`
7. For the frontend, either deploy as a separate static site or build and serve via Django's whitenoise

### Render

1. Create a new Web Service from your repo
2. Set build command: `cd backend && pip install -r requirements.txt && python manage.py migrate`
3. Set start command: `cd backend && gunicorn config.wsgi:application --bind 0.0.0.0:$PORT --workers 3 --timeout 120`
4. Add a PostgreSQL database
5. Set environment variables

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/register/` | Create account |
| POST | `/api/login/` | Get auth token |
| GET/POST | `/api/organizations/` | List/create orgs |
| PATCH | `/api/organizations/:id/` | Update org profile |
| GET/POST | `/api/lessons/` | List/create lessons |
| PATCH | `/api/lessons/:id/` | Update lesson |
| DELETE | `/api/lessons/:id/` | Delete lesson |
| POST | `/api/lessons/import_file/` | Import XLSX/CSV |
| POST | `/api/sow/upload/` | Extract text from SOW doc |
| POST | `/api/sow/analyze/` | Run AI analysis |
| POST | `/api/chat/` | AI analyst chat |

All endpoints except register/login require `Authorization: Token <your-token>` header.

---

## Project Structure

```
lessons-learned/
├── backend/
│   ├── config/           # Django settings, URLs, WSGI
│   ├── lessons/          # Main app
│   │   ├── models.py     # Organization, Lesson, SOWAnalysis
│   │   ├── views.py      # REST API endpoints
│   │   ├── serializers.py
│   │   ├── parsers.py    # XLSX/CSV import logic
│   │   ├── ai.py         # Anthropic API integration
│   │   ├── admin.py      # Django admin config
│   │   └── urls.py
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Main application (auth, dashboard, all tabs)
│   │   ├── api.js        # API client
│   │   ├── styles.js     # Shared styles and constants
│   │   └── main.jsx      # Entry point
│   ├── package.json
│   ├── vite.config.js
│   ├── nginx.conf
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Import Format

The importer auto-detects column headers. Supported column names:

| Your Column | Maps To |
|------------|---------|
| LL # | ID |
| Date Logged | Created date |
| Project Name/Number | Project |
| Region | Location |
| Discipline | Discipline (auto-mapped) |
| Category | Keywords |
| Phase/Milestone | Phase |
| Logged By | Keywords |
| Situation/Context | Title + Description |
| What Happened | Description |
| Impact | Impact |
| Root Cause | Root Cause |
| Recommendation | Recommendation |
| Keywords/Tags | Keywords |
| Status | Keywords |

---

## Configuration

### AI Model

Change the Anthropic model in `.env`:

```
ANTHROPIC_MODEL=claude-sonnet-4-20250514
```

### Adding Work Types

Edit the choices in `backend/lessons/models.py` (Lesson.WORK_TYPE_CHOICES) and `frontend/src/styles.js` (WORK_TYPES array).

### SOW Work Type Filters

Edit `frontend/src/styles.js` (SOW_WORK_TYPES array) to add or modify scope categories for the SOW analysis filter.
