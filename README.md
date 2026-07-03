# CBA English Level

**Placement exam system for the Centro Boliviano Americano (CBA).**

Automatically determines the English level of new students through online placement tests.

## Stack

| Category | Technology |
|---|---|
| Frontend | React 19 — TypeScript — Vite |
| Styling | Tailwind CSS 4 |
| Backend | Supabase (BaaS) |
| Database | PostgreSQL |
| Auth | Supabase Auth |
| Deploy | Vercel |

## Project Structure

```
├── database/
│   └── migrations/      # SQL migrations
├── docs/
│   └── latex/           # LaTeX documentation
├── public/              # Static assets
├── scripts/             # Helper scripts
├── src/
│   ├── components/
│   │   ├── atoms/       # Base components
│   │   ├── molecules/   # Composite components
│   │   ├── organisms/   # Feature components
│   │   └── screens/     # Page views
│   ├── hooks/           # Custom hooks
│   ├── lib/             # Supabase client
│   ├── services/        # Business logic
│   ├── types/           # TypeScript interfaces
│   └── utils/           # Utility functions
├── .env.example
├── AGENTS.md            # Project master document
├── requerimientos.md    # PRD (Spanish)
├── package.json
└── vite.config.ts
```

## Local Setup

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
npm run dev
```

## Environment Variables

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Branches

- `main` — production
- `develop` — integration
- `feature/*` — working branches

## License

MIT
