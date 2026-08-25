<p align="center">
  <img src="docs/assets/brand/logo.png" alt="Logo de CBA English Level" width="220" />
</p>

<h1 align="center">CBA English Level</h1>

<p align="center">
  <a href="README.md">English</a> | <a href="README.es.md">Español</a>
</p>

<p align="center">
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React 19" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5" /></a>
  <a href="https://vite.dev/"><img src="https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite 6" /></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white" alt="Supabase PostgreSQL" /></a>
  <a href="https://vercel.com/"><img src="https://img.shields.io/badge/Vercel-Production-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel Production" /></a>
</p>

> Aplicación web para evaluar el nivel de inglés de nuevos estudiantes mediante exámenes configurables, resultados inmediatos e historial verificable.

## Vista previa

<p align="center">
  <img src="docs/assets/mockup.png" alt="Vista general del sistema CBA English Level" width="760" />
</p>

| Registro e inicio de sesión | Dashboard administrativo |
|---|---|
| <img src="docs/assets/registro.png" alt="Registro de estudiante" width="360" /> | <img src="docs/assets/dashboard.png" alt="Dashboard administrativo" width="360" /> |

| Resultado del examen | Acceso al sistema |
|---|---|
| <img src="docs/assets/resultado.png" alt="Resultado del examen" width="360" /> | <img src="docs/assets/login.png" alt="Inicio de sesión" width="360" /> |

## Contenido

- [Inicio rápido](#inicio-rápido)
- [Qué está implementado](#qué-está-implementado)
- [Rutas principales](#rutas-principales)
- [Arquitectura](#arquitectura)
- [Configuración local](#configuración-local)
- [Límites operativos conocidos](#límites-operativos-conocidos)
- [Documentación final](#documentación-final)
- [Autor](#autor)

## Inicio rápido

1. Instale Node.js y npm, Docker y la CLI de Supabase.
2. Instale las dependencias con `npm install`.
3. Ejecute `npm run dev:local` y abra `http://localhost:5173`.

La aplicación no configura estas variables automáticamente: `.env.local` sigue siendo obligatorio después de `supabase start` y para cualquier proyecto remoto. La aplicación falla al iniciar si falta alguna de las dos variables `VITE_*`; no se incluyen credenciales en el repositorio.

## Qué está implementado

| Área | Capacidades actuales |
|---|---|
| Estudiante | Registro con correo/contraseña, inicio de sesión, panel de estado, inicio o reanudación de intento, temporizador basado en hora del servidor, guardado de respuestas, entrega, resultado e historial de intentos finalizados. |
| Administración | Dashboard, consulta y edición limitada de perfiles de estudiantes, banco de preguntas, niveles CEFR versionados, configuración del examen, reportes CSV/XLSX y auditoría. |
| Examen | Selección aleatoria de preguntas válidas, snapshots inmutables de configuración, preguntas, opciones y niveles, cálculo de porcentaje y asignación CEFR. |
| Seguridad | Supabase Auth, rutas protegidas por rol, RLS y RPC con comprobación de rol; el flujo del estudiante no expone respuestas correctas. |

## Rutas principales

| Ruta | Acceso | Función |
|---|---|---|
| `/register` | Pública | Registro de estudiante. |
| `/login` | Pública | Inicio de sesión de estudiante o administrador. |
| `/student` | Estudiante | Estado del examen, último resultado e inicio/reanudación. |
| `/student/exam/:attemptId` | Estudiante propietario | Examen y resultado del intento. |
| `/student/history` | Estudiante propietario | Historial de intentos finalizados. |
| `/admin` | Administrador | Dashboard. |
| `/admin/students` | Administrador | Búsqueda, perfil y resultados de estudiantes. |
| `/admin/questions` | Administrador | Banco de preguntas. |
| `/admin/levels` | Administrador | Niveles CEFR y distribución de puntajes. |
| `/admin/exam-configuration` | Administrador | Configuración del examen para futuros intentos. |
| `/admin/reports` | Administrador | Reportes y exportación. |
| `/admin/audit-log` | Administrador | Cronología de auditoría. |

## Arquitectura

```text
React 19 + TypeScript + Vite + Tailwind CSS
                 |
          Supabase JavaScript SDK
                 |
Supabase Auth + PostgreSQL + RLS + RPC + triggers
```

El frontend organiza componentes en `atoms`, `molecules` y `organisms`, páginas en `src/pages`, hooks de acceso en `src/hooks` y el cliente de Supabase en `src/lib/supabase.ts`. La interfaz está localizada en español e inglés; la identidad visual emplea estilos CBA para autenticación, estudiante y administración.

La fuente de verdad del esquema es `supabase/migrations/`, en orden numérico. `database/` contiene documentación y diagramas, no scripts para aplicar manualmente.

## Configuración local

El comando oficial para desarrollo local es `npm run dev:local`. Inicia Supabase, reinicia exclusivamente la base de datos local con todas las migraciones y fixtures, y abre Vite en `http://localhost:5173`. El reinicio elimina datos locales previos; nunca use este comando contra un proyecto remoto.

Ejemplo de `.env.local`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<clave-publicable-local-de-supabase-status>
```

`.env.local` se crea con los valores públicos que entrega `supabase status -o env`; no se documentan ni versionan claves secretas. `supabase/seed.sql` crea solamente los fixtures sintéticos de administrador y estudiante cuando se ejecuta `supabase db reset --local`.

Comandos disponibles: `npm run dev:local`, `npm run dev`, `npm run build`, `npm run preview`, `npm run lint` y `npm test`. La configuración local de Supabase expone API en el puerto `54321`, base de datos en `54322` y Studio en `54323`.

## Límites operativos conocidos

- La configuración exige suficientes preguntas válidas: cada pregunta seleccionable debe tener al menos dos opciones y exactamente una correcta.
- El máximo configurado de preguntas no se valida al guardar la configuración; el intento se rechaza al iniciar si el banco no alcanza ese número.
- `passing_score` se guarda y se versiona, pero el ciclo actual solo persiste porcentaje y nivel CEFR: no hay resultado aprobado/reprobado almacenado ni mostrado.
- Los reportes exportan como máximo 5.000 filas por consulta filtrada.
- La recuperación documentada de backups es únicamente para una pila Supabase local; no automatiza una restauración remota o de producción.

## Documentación final

- [Manual técnico](docs/manual-tecnico.md)
- [Manual de usuario](docs/manual-usuario.md)
- [Modelo entidad-relación](database/diagrama-uml.puml)
- [Modelo relacional](database/modelo-relacional.md)
- [Diccionario de datos](database/data-dictionary.md)
- [Procedimiento de backups](docs/daily-backups.md)

## Autor

**Abraham Flores Barrionuevo** - Full-Stack Developer

- GitHub: [@AFB-9898](https://github.com/AFB-9898)
- Proyecto académico desarrollado para el Centro Boliviano Americano (CBA), Tarija.
