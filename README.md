# VerifyDent

### **DSOLVE 2026** · DRISHTI · College of Engineering Trivandrum (CET)

**BUILD. SOLVE. DEMONSTRATE.**

|                   |                                                                      |
| ----------------- | -------------------------------------------------------------------- |
| **Problem:**      | Problem 3: Insurance Verification                                    |
| **Team Name:**    | EvoKind                                                              |
| **Team Members:** | Devika Sajeesh · Niyas S Makkiyil · Devadathan J · Ejo Abhilash       |
| **Institution:**  | College of Engineering Trivandrum                                              |
| **Live Demo:**    | https://drive.google.com/file/d/1NQ9npxgC5XjKGZvu9Y-PWc158-7MwH72/view?usp=drivesdk  |
| **Pitch Video:**  | [Social media pitch video link]                                      |

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Our Solution](#our-solution)
- [Key Features](#key-features)
- [Screenshots & Demo](#screenshots--demo)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Usage / Demo Script](#usage--demo-script)
- [Limitations & Future Scope](#limitations--future-scope)
- [Team](#team)
- [Submission Checklist](#submission-checklist)

---

## Problem Statement

> Problem 3: Insurance Verification

> Develop a solution to simplify and automate insurance verification for dental practices.

Currently, dental practices often need to manually contact insurance companies to verify whether a patient's insurance is active and what coverage is available. This process can take 20–30 minutes per patient, creating significant administrative effort and delays.

The solution should explore ways to automate or significantly reduce this manual process by quickly verifying insurance eligibility and presenting the relevant information to the dental practice in a simple and usable format.

### Why this matters

Insurance verification is a high-friction administrative task for dental teams.
Staff need to collect information from a card, enter it into payer systems,
interpret benefit responses, and connect the result to the patient's
appointment. Delays or transcription errors can affect scheduling, treatment
planning, and the patient's financial expectations.

---

## Our Solution

VerifyDent is a full-stack web application that turns an insurance card and a
scheduled appointment into a reviewable verification record — cutting the
typical 20–30 minute manual verification process down to seconds.

Staff can create or open an appointment, enter insurance details manually or
upload a card for OCR extraction, review the extracted fields, run a payer
verification, and inspect treatment coverage before confirming a plan.

Human review stays in the loop: extracted values include field confidence,
missing values remain visible, and verification results are linked directly
back to the appointment rather than being a separate lookup.

---

## Key Features

- **Appointment dashboard** — Create appointments, view scheduled patients, and
  open an appointment-specific verification workspace.
- **Insurance intake** — Upload a PDF, PNG, JPG, or JPEG card for OCR extraction,
  or enter member and payer fields through the manual form.
- **Review before verification** — Inspect and correct extracted values before
  sending them to the verification workflow.
- **Payer simulation and normalization** — Run deterministic provider adapters
  for the demo, retain the raw response, and expose normalized benefit data.
- **Treatment planning** — Add planned treatments and review benefit,
  eligibility, estimate, and recommendation analysis.
- **Persistent records** — Patients, policies, verification results, and
  appointments are stored in Supabase (PostgreSQL), with SQLite available
  for zero-setup local development.

---

## Screenshots & Demo

Screenshots and a public pitch video will be added before the submission
deadline. The full application can be demonstrated locally using the script
below, or via the live Vercel deployment linked above.

---

## Tech Stack

| Layer          | Technology                                    | Why we chose it                                                             |
| -------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| Frontend       | React 19, TypeScript, Vite, Tailwind CSS v4   | Fast, typed workflow UI with a small local toolchain                        |
| Backend        | Python 3.12+, FastAPI, Uvicorn                | Explicit API contracts, async-ready, and simple local development           |
| Database       | Supabase (PostgreSQL) via SQLAlchemy           | Hosted Postgres with zero-config — SQLite fallback for local dev            |
| OCR            | Tesseract 5 via pytesseract + pypdfium2        | Local document processing without sending card images to a third party      |
| Provider layer | Deterministic mock provider adapters           | Repeatable demos and tests without live payer credentials                   |
| Deployment     | Vercel (frontend static + backend serverless)  | Single-command deploys from GitHub, free Hobby tier                         |

---

## Getting Started

### Prerequisites

- Python 3.12 or newer
- Node.js 20 or newer and npm
- Tesseract OCR 5.x for real card extraction (Windows)
- A Supabase project (or skip with `EXTRACTION_PROVIDER=mock` and local SQLite)

No external API keys are required for the local demo. The provider layer uses
fictional deterministic responses.

### Installation and startup

Open two PowerShell terminals from the repository root.

#### Backend

```powershell
Set-Location backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
Copy-Item .env.example .env
# Edit .env and fill in your DATABASE_URL (Supabase) and other values
.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

On Windows, install Tesseract if it is not already available:

```powershell
winget install UB-Mannheim.TesseractOCR
```

The default configuration expects
`C:\Program Files\Tesseract-OCR\tesseract.exe`. Update `TESSERACT_CMD` in
`backend/.env` if Tesseract is installed elsewhere.

For a demo without Tesseract (e.g. on Vercel or CI), set
`EXTRACTION_PROVIDER=mock` — this returns fictional sample values.

#### Frontend

```powershell
Set-Location frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open <http://127.0.0.1:5173>. The backend API documentation is available at
<http://127.0.0.1:8000/docs>.

### Environment Variables

Copy `backend/.env.example` to `backend/.env`. Keep real secrets out of Git.

**Backend (`backend/.env`)**

| Variable               | Description                                      | Example                                                      |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------------ |
| `DATABASE_URL`         | SQLAlchemy database URL                          | `postgresql+psycopg2://user:pass@db.xxx.supabase.co:5432/postgres` |
| `CORS_ORIGINS`         | Comma-separated frontend origins                 | `http://localhost:5173,https://your-app.vercel.app`          |
| `EXTRACTION_PROVIDER`  | `auto`, `ocr`, or deterministic `mock`           | `mock`                                                       |
| `TESSERACT_CMD`        | Absolute Tesseract executable path               | `C:\Program Files\Tesseract-OCR\tesseract.exe`               |
| `MAX_UPLOAD_SIZE_MB`   | Maximum document upload size                     | `10`                                                         |

**Frontend (`frontend/.env`)**

| Variable            | Description                                              | Example                          |
| ------------------- | -------------------------------------------------------- | -------------------------------- |
| `VITE_BACKEND_URL`  | URL of the FastAPI backend (omit for local dev default)  | `https://your-app.vercel.app`    |

---

## Usage / Demo Script

_This doubles as your live demo runbook (3–5 min)._

1. **Boot** — Start the backend and frontend using the commands above.
2. **Schedule** — Create an appointment with a fictional patient and open it
   from the dashboard.
3. **Capture insurance** — Upload a sample insurance card or switch to manual
   entry. Review the extracted fields and confidence values.
4. **Verify** — Confirm the fields and run the provider verification. Show the
   eligibility status, benefits, and raw provider response.
5. **Plan treatment** — Add one or more treatments and run the treatment-plan
   analysis to show coverage and an estimated patient responsibility.
6. **Close the loop** — Return to the dashboard and show that the appointment
   now carries its verification status.

---

## Limitations & Future Scope

### Known Limitations

- Provider responses are deterministic mock simulations; the project does not
  connect to production payer clearinghouses yet.
- OCR requires a local Tesseract installation and still requires staff review
  for low-confidence or missing fields. Tesseract is not available on Vercel's
  serverless runtime — use `EXTRACTION_PROVIDER=mock` in production.
- Authentication, authorization, audit logging, and production secrets
  management are outside the current demo scope.

### Future Scope

- Add authenticated practice and staff accounts with role-based access.
- Integrate approved payer or clearinghouse APIs behind the provider interface.
- Replace Tesseract with a cloud vision API (e.g. Google Document AI) so OCR
  works in serverless environments without a local binary.
- Add durable audit events, encrypted document handling, and end-to-end tests.
- Add automated frontend end-to-end tests and richer appointment filtering.

---

## Team

| Name             | Role(s)                  | GitHub                                         |
| ---------------- | ------------------------ | ---------------------------------------------- |
| Devika Sajeesh   | Backend  | —  [Devika-Sajeesh](https://github.com/Devika-Sajeesh)                                          |
| Niyas S Makiyil  | Frontend  | [Niyasmkyl](https://github.com/Niyasmkyl)      |
| Devadathan J     | Backend  | [Devadathan05](https://github.com/Devadathan05)|
| Ejo Abhilash     | Frontend  | — [tve24ee064-max](https://github.com/tve24ee064-max)                                             |

---

## Submission Checklist

**Before 6:00 AM (Code Freeze) – Sat, Sept 19th:**

- [ ] Clean, runnable source code committed to this **public** repo
- [ ] `README.md` fully filled in (all sections above)
- [ ] Pitch video (>30s, English) posted on team member's social profile
      tagging **@DrishtiCET** & **@CareStack** and link added above
- [ ] All secrets/API keys removed from the repo
- [ ] Quick-start verified from a fresh clone (`git clone` → run)

---

**[Problem Statements](./docs/problem-statements.md)** ·
**[Submission Checklist](./SUBMISSION_CHECKLIST.md)** ·
**DSOLVE 2026 Guidelines**
