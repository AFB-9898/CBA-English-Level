<p align="center">
  <a href="docs/assets/brand/logo.png">
    <img src="docs/assets/brand/logo.png" alt="CBA Logo" width="200">
  </a>
</p>

<h1 align="center">CBA English Level</h1>

<div align="center">

![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript_6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite_8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

![Status](https://img.shields.io/badge/Status-Development-7C3AED?style=for-the-badge)

</div>

---

<p align="center">
  <strong>Online placement exam system for the Centro Boliviano Americano (CBA).</strong><br>
  Automatically determines the English level of new students through timed online tests.
</p>

---

📄 Read this in: **English** | [Español](README.es.md)

---

## Preview

[![CBA — Mockup Principal](docs/assets/mockup.png)](docs/assets/mockup.png)

[![CBA — Dashboard Administrativo](docs/assets/dashboard.png)](docs/assets/dashboard.png)

---

## Table of Contents

- [What It Does](#what-it-does)
- [Key Features](#key-features)
- [Business Workflow](#business-workflow)
- [Stack](#stack)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Security](#security)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Team](#team)
- [License](#license)

---

## What It Does

CBA English Level is a web-based placement testing platform that streamlines the entire evaluation process for new students — from registration and online testing to automatic level assignment and result delivery.

**Before:** Placement tests were paper-based, manually graded, and results took days to process.

**After:** Students register online, take a timed adaptive test, and receive their English level instantly. Administrators manage questions, configure exams, and generate reports from a single dashboard.

---

## Key Features

### Student Module

- **Online Registration** — Students sign up with personal data and contact info

[![Student Registration](docs/assets/registro.png)](docs/assets/registro.png)

- **Timed Exam** — Configurable countdown timer with automatic submission
- **Random Questions** — Each exam draws from a pool, preventing memorization
- **Instant Results** — Level assigned immediately after submission
- **One Exam Per Day** — Business rule enforced at the database level

### Admin Module

- **Secure Login** — Authentication via Supabase Auth (email/password)

[![Admin Login](docs/assets/login.png)](docs/assets/login.png)

- **Question Management** — Full CRUD with categories, options, and correct answers
- **Level Management** — Define non-overlapping score ranges per level
- **Exam Configuration** — Set time limits, question count, and passing scores
- **Dashboard** — Real-time statistics on exams taken, levels assigned, and trends
- **Reports** — Export to CSV and Excel for institutional records

---

## Business Workflow

```
Student registration → Exam initiation → Timed questions
      → Auto-submit (on time completion or manual finish)
           → Score calculation → Level assignment
                → Instant result display
                     → Historical record kept
```

[![Exam Result](docs/assets/resultado.png)](docs/assets/resultado.png)

---

## Stack

| Category | Technology |
|---|---|
| **UI Framework** | React 19 |
| **Language** | TypeScript 6 |
| **Styling** | Tailwind CSS 4 |
| **Build Tool** | Vite 8 |
| **Backend / BaaS** | Supabase |
| **Database** | PostgreSQL (via Supabase) |
| **Authentication** | Supabase Auth |
| **Deployment** | Vercel |

---

## Architecture

The project follows a **Frontend + BaaS** architecture with **Atomic Design** for UI components:

```
Client (React + Supabase SDK)
       ↓
Supabase (PostgreSQL + RLS + Functions + Triggers)
       ↓
       DB
```

```
src/
├── components/
│   ├── atoms/              # Primitive UI elements
│   ├── molecules/          # Composed UI units
│   ├── organisms/          # Feature components
│   └── screens/            # Full page views
├── hooks/                  # Custom React hooks
├── lib/                    # Supabase client initialization
├── services/               # Business logic and data access
├── types/                  # Global TypeScript interfaces
└── utils/                  # Utility functions
```

### Business Logic Distribution

| Rule | Implementation |
|---|---|
| Access control | Row Level Security (RLS) |
| Critical rules (no history edits) | SQL Triggers |
| Score / level calculation | SQL Functions |
| Integrity validations | Constraints + SQL Functions |
| Timer, UI logic | React (frontend) |
| CSV / Excel reports | Frontend libraries |

---

## Database Schema

The database is hosted on **Supabase (PostgreSQL)** with RLS enabled on all tables.

Main entities:

- **students** — Registered users taking exams
- **admins** — System administrators
- **levels** — English levels with min/max score ranges
- **questions** — Test questions with options and correct answer
- **exams** — Exam sessions linked to students
- **exam_config** — System-wide exam settings

---

## Security

- **Row Level Security (RLS)** enabled on all tables
- **Supabase Auth** for authentication with JWT session management
- **Route guards** on all private pages
- **Backend validation** via SQL constraints and triggers
- **XSS protection** via input sanitization
- **SQL injection** prevented by Supabase parameterized queries

---

## Installation

### Prerequisites

- Node.js 18+ and npm
- A [Supabase](https://supabase.com) account (free tier works)
- Git

### 1. Clone the repository

```bash
git clone https://github.com/AFB-9898/CBA-English-Level.git
cd CBA-English-Level
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Set up the database

`supabase/migrations/` is the project's only migration authority. From the
repository root, use the Supabase CLI to apply the complete ordered set:

```bash
supabase db reset --local  # local development
# supabase db push         # linked remote project
```

Do not execute migration scripts from `database/`; that directory contains
documentation and database design assets only.

### 5. Run locally

```bash
npm run dev
# Runs at http://localhost:5173
```

### 6. Build for production

```bash
npm run build    # Outputs to dist/
npm run preview  # Preview production build locally
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous API key |

---

## Deployment

The project is deployed on **Vercel** with the following configuration:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

To deploy your own instance:

1. Push the repository to GitHub
2. Import the project on [vercel.com](https://vercel.com)
3. Add the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables
4. Deploy

---

## Team

| Member | Role | Responsibilities |
|---|---|---|
| Abraham Flores Barrionuevo | Frontend Developer + Supabase Backend | Application architecture, Atomic Design system, Supabase setup (Auth, RLS policies, Storage), database schema design, exam logic, reports |

- Abraham Flores Barrionuevo — [@AFB-9898](https://github.com/AFB-9898)

---

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

