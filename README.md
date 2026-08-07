# CBA English Level

Sistema web de exámenes de colocación del Centro Boliviano Americano, con identidad visual CBA Tarija. Permite que estudiantes se registren, rindan un examen temporizado y consulten su resultado e historial; el personal administrador gestiona el banco de preguntas, los niveles CEFR, la configuración y los reportes.

## Inicio rápido

1. Instalá Node.js y npm, Docker y la Supabase CLI.
2. Instalá dependencias con `npm install`.
3. Ejecutá `npm run dev:local` y abrí `http://localhost:5173`.

La aplicación no configura esas variables automáticamente: `.env.local` sigue siendo obligatorio después de `supabase start` y para cualquier proyecto remoto. La aplicación falla al iniciar si falta alguna de las dos variables `VITE_*`; no se incluyen credenciales en el repositorio.

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

El comando oficial para desarrollo local es `npm run dev:local`. Inicia Supabase,
reinicia exclusivamente la base de datos local con todas las migraciones y fixtures,
y abre Vite en `http://localhost:5173`. El reset elimina datos locales previos; nunca
usar este comando contra un proyecto remoto.

Ejemplo de `.env.local`:

```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<publishable-key-local-de-supabase-status>
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
