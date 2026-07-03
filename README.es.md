# CBA — Sistema de Exámenes de Colocación

**Plataforma para administrar y rendir exámenes de colocación de inglés en el Centro Boliviano Americano.**

## Stack

| Categoría | Tecnología |
|---|---|
| Frontend | React 19 — TypeScript — Vite |
| Estilos | Tailwind CSS 4 |
| Backend | Supabase (BaaS) |
| Base de Datos | PostgreSQL |
| Auth | Supabase Auth |
| Deploy | Vercel |

## Estructura del Proyecto

```
├── database/
│   └── migrations/      # Migraciones SQL
├── docs/
│   └── latex/           # Documentación en LaTeX
├── public/              # Assets estáticos
├── scripts/             # Scripts auxiliares
├── src/
│   ├── components/
│   │   ├── atoms/       # Componentes base
│   │   ├── molecules/   # Componentes compuestos
│   │   ├── organisms/   # Componentes de feature
│   │   └── screens/     # Páginas completas
│   ├── hooks/           # Custom hooks
│   ├── lib/             # Cliente Supabase
│   ├── services/        # Lógica de negocio
│   ├── types/           # Interfaces TypeScript
│   └── utils/           # Funciones auxiliares
├── .env.example
├── AGENTS.md
├── package.json
└── vite.config.ts
```

## Instalación

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Variables de Entorno

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Licencia

MIT
