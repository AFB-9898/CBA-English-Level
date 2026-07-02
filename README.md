# CBA English Level

Sistema de Exámenes de Colocación para el Centro Boliviano Americano (CBA).

Determina automáticamente el nivel de inglés de nuevos estudiantes mediante exámenes en línea.

## Tecnologías

- **Frontend:** React + Vite
- **Backend:** Supabase (PostgreSQL, API REST, Auth)
- **Base de datos:** PostgreSQL (Supabase)
- **Control de versiones:** Git + GitHub

## Estructura del proyecto

```
CBA-English-Level/
├── frontend/           → Aplicación React
├── supabase/           → Migraciones y configuración
├── docs/               → Documentación
│   └── latex/          → Informe LaTeX
├── AGENTS.md           → Documento maestro del proyecto
├── requerimientos.md   → PRD del sistema
└── .env.example        → Variables de entorno requeridas
```

## Instalación local

```bash
# Clonar el repo
git clone https://github.com/tu-usuario/CBA-English-Level.git

# Instalar dependencias del frontend
cd frontend
npm install

# Configurar variables de entorno
cp ../.env.example ../.env
# Editar .env con las credenciales de Supabase

# Iniciar desarrollo
npm run dev
```

## Ramas

- `main` — producción
- `develop` — integración
- `feature/*` — ramas de trabajo
