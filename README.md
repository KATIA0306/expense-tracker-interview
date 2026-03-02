# Expense Tracker - Interview Exercise

A simple expense tracking application built with React, TypeScript, Node.js, and SQLite.

<img width="1058" height="635" alt="image" src="https://github.com/user-attachments/assets/74719286-c2ba-4d6a-91a7-21920cd9021a" />

## Project Structure

```
expense-tracker-interview/
├── backend/          # Node.js + Express + Knex API
├── frontend/         # React + Vite + TanStack Query
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Backend Setup

```bash
cd backend
npm install
npm run db:migrate    # Run database migrations
npm run db:seed       # Seed with sample data
npm run dev           # Start dev server on http://localhost:3002
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev           # Start dev server on http://localhost:5173
```

### Test Accounts

After seeding, you can login with:
- Email: `demo@example.com`
- Password: `password123`

## Tech Stack

### Backend
- Node.js + Express
- TypeScript
- Knex.js (query builder)
- SQLite (database)
- JWT (authentication)

### Frontend
- React 18
- TypeScript
- Vite
- TanStack Query (data fetching)
- Tailwind CSS (styling)

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token

### Expenses
- `GET /api/expenses` - List user's expenses
- `POST /api/expenses` - Create expense
- `PUT /api/expenses/:id` - Update expense
- `DELETE /api/expenses/:id` - Delete expense

### Categories
- `GET /api/categories` - List all categories

### Email import (CSV → LLM → DB)
- **Feature**: Upload a CSV of email data; an LLM parses out purchases/expenses and you can upload them to the database.
- **LLM evaluations**: See [evals/README.md](evals/README.md) for promptfoo-based evals (email receipt filter + expense extraction). Run from repo root: `npx promptfoo eval -c evals/promptfooconfig.yaml` or from backend: `npm run eval:emails`. Requires `GOOGLE_API_KEY` or `GEMINI_API_KEY`.
