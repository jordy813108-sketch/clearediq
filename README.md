# cleaREDiq — AI Receipt Fraud Detection Platform

## Stack
- **Frontend**: Next.js 14, Tailwind CSS, ShadCN UI, TypeScript
- **Backend**: Python FastAPI, PostgreSQL, Redis, Celery
- **Storage**: AWS S3 (or Cloudflare R2)
- **OCR**: Google Vision API or AWS Textract
- **Auth**: NextAuth.js (frontend) + JWT (backend)
- **Payments**: Stripe (add in Phase 2)

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL 15+
- Redis
- Docker (optional)

### 1. Clone and install

```bash
# Frontend
cd frontend
npm install
cp .env.example .env.local
# Fill in your env vars

# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in your env vars
```

### 2. Database setup

```bash
cd backend
alembic upgrade head
python app/db/seed.py   # optional demo data
```

### 3. Run dev servers

```bash
# Terminal 1 — backend
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend && npm run dev

# Terminal 3 — worker (optional for async jobs)
cd backend && celery -A app.worker worker --loglevel=info
```

### 4. Docker (all-in-one)

```bash
docker-compose up --build
```

Open http://localhost:3000

## API Docs
FastAPI auto-docs at http://localhost:8000/docs

## Environment Variables

### Frontend (.env.local)
```
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Backend (.env)
```
DATABASE_URL=postgresql://user:pass@localhost:5432/clearediq
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-jwt-secret
GOOGLE_VISION_API_KEY=your-key
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET=clearediq-receipts
AWS_REGION=us-east-1
```

## Project Structure

```
clearediq/
├── frontend/          # Next.js app
│   └── src/
│       ├── app/       # App router pages
│       ├── components/ # UI components
│       ├── lib/       # API client, utils
│       └── types/     # TypeScript types
├── backend/           # FastAPI app
│   └── app/
│       ├── api/       # Route handlers
│       ├── services/  # Business logic
│       ├── models/    # SQLAlchemy models
│       ├── schemas/   # Pydantic schemas
│       └── core/      # Config, auth, DB
├── docker/            # Dockerfiles
└── docker-compose.yml
```

## Roadmap
- [x] MVP: Upload, OCR, Rules engine, Fraud scoring, Dashboard
- [ ] Phase 2: ML models, image forensics (OpenCV/ELA)
- [ ] Phase 3: Merchant fingerprinting
- [ ] Phase 4: Behavioral anomaly detection
- [ ] Phase 5: Enterprise integrations (Concur, Expensify, SAP)
