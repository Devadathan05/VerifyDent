# Backend — VerifyDent

Put your server-side code here: REST/graph APIs, business logic, database models,
ML inference services, background jobs, etc.

## Stack

- Language / runtime: Python 3.14+
- Framework: FastAPI + Uvicorn
- Database: SQLite by default
- OCR: Tesseract 5.x via pytesseract

## Local Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env
.venv\Scripts\python -m uvicorn app.main:app --reload
```

### Windows Tesseract

Install Tesseract with the Windows installer, or with Windows Package Manager:

```powershell
winget install UB-Mannheim.TesseractOCR
```

The verified executable on this machine is:

```text
C:\Program Files\Tesseract-OCR\tesseract.exe
```

Set the preferred configuration in `backend/.env`:

```text
EXTRACTION_PROVIDER=ocr
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
```

The application also checks PATH and the common `Program Files` and `Program
Files (x86)` installation paths. It never silently falls back to mock data.

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `your-database-connection-string` |
| `API_KEY` | Third-party service API key | `sk-xxxxxxxxxxxxxxxxxx` |
| `PORT` | Port the backend listens on | `8000` |

> Values above are illustrative examples only — replace them with your own.
> Never commit real `.env` values — see root `.gitignore`. A starting point is
> provided in `.env.example`.

## Tests

```bash
cd backend
.venv\Scripts\python -m pytest
```

## Project Layout (adjust to your stack)

```
backend/
├── <entry point>      # server/app entry point
├── <api / routes>     # endpoints
├── <config / core>    # config, security
├── <models / data>    # database models & access
├── <services>         # business logic
├── tests/
└── .env.example
```