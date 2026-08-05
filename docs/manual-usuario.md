# Manual de usuario

## Acceso al sistema

1. Ingresá a `/register` si todavía no tenés una cuenta de estudiante.
2. Completá nombre, CI, correo, contraseña y, opcionalmente, teléfono.
3. Tras el registro, iniciá sesión en `/login` con correo y contraseña. El CI es un dato obligatorio del perfil, no una credencial de acceso ni una verificación externa del registro.

El sistema reconoce automáticamente si la cuenta pertenece a un estudiante o a un administrador y abre el panel correspondiente. Podés cambiar entre español e inglés desde los selectores de idioma disponibles en las pantallas principales.

## Estudiantes

### Rendir el examen

1. Desde el Panel del estudiante, elegí **Iniciar examen** cuando su estado sea **Disponible**.
2. Si existe un intento en curso, elegí **Reanudar examen**; no se crea un segundo intento.
3. Respondé las preguntas y navegá con Anterior, Siguiente o la navegación de preguntas.
4. Esperá la confirmación de guardado antes de continuar si el sistema la muestra.
5. Elegí **Entregar examen** y confirmá la acción. No podrás cambiar respuestas luego de la entrega.

El temporizador se calcula con el plazo definido por el servidor. Al vencer, el sistema intenta entregar el examen automáticamente; si no logra confirmarlo, usá **Reintentar entrega** o **Recargar intento**. Una respuesta no elegida cuenta como incorrecta al calcular el porcentaje.

Un estudiante no puede finalizar más de un examen durante el mismo día de negocio del CBA, definido en la zona horaria `America/La_Paz`.

### Resultado e historial

Al finalizar se muestra el porcentaje y el nivel CEFR asignado. En **Historial de exámenes** podés consultar solo tus intentos finalizados y abrir cada detalle. El resultado histórico se conserva aunque los rangos CEFR activos cambien después.

## Administradores

Iniciá sesión en `/login`. El menú del panel incluye Dashboard, Estudiantes, Preguntas, Niveles, Configuración del examen, Reportes y Registro de Auditoría. Si el cierre de sesión falla, el panel muestra un mensaje y permite reintentar sin perder la sesión.

### Dashboard

Muestra totales de estudiantes y exámenes, exámenes del día, promedio, distribución por nivel y exámenes recientes. Es una vista de consulta.

### Estudiantes

Buscá por nombre, CI o correo. Abrí un perfil para consultar sus intentos. Solo se pueden editar el nombre completo y el teléfono; CI y correo son campos de identidad de solo lectura. Los intentos y resultados no se modifican desde esta pantalla.

### Preguntas

Creá, editá o eliminá preguntas del banco. Cada pregunta requiere nivel, texto y opciones; la interfaz exige entre cuatro y diez opciones y exactamente una respuesta correcta. Una pregunta vinculada a intentos existentes puede no eliminarse por protección de integridad. Los cambios quedan auditados.

### Niveles CEFR

Editá el nombre y descripción de un nivel o abrí el editor de distribución. Los rangos activos deben cubrir todos los enteros de 0 a 100 sin huecos ni solapamientos. Cuando cambia un rango, el sistema crea versiones históricas para preservar resultados anteriores. Desactivar un nivel redistribuye su rango entre vecinos de forma determinista y conserva el nivel como histórico.

Si otra persona actualiza la distribución antes de guardar, el sistema recarga la información actual: revisala antes de volver a confirmar.

### Configuración del examen

Definí tiempo límite, cantidad de preguntas y `puntaje de aprobación` para futuros intentos. La configuración tiene revisión: si otra persona la cambia antes de guardar, se recargan los valores nuevos y debes revisarlos.

El puntaje de aprobación todavía no se muestra como aprobado/reprobado en el resultado actual. El nivel CEFR se asigna por los rangos de niveles activos, no por este campo.

### Reportes

Filtrá por fechas de finalización, nivel CEFR y estado del examen. Podés exportar el resultado filtrado a CSV o Excel. Cada exportación está limitada a 5.000 filas. Ambos formatos incluyen exactamente: fecha de finalización, nombre completo del estudiante, CI, estado del examen, puntaje y nivel CEFR. No incluyen respuestas, teléfono ni correo.

### Registro de auditoría

Filtrá por fecha, administrador, entidad y acción. La vista muestra fecha/hora, actor, entidad, acción y resumen seguro; no expone el contenido detallado anterior/posterior de los cambios.

## Mensajes y recuperación

- Ante un error de carga, usá **Intentar de nuevo** o **Actualizar** en la pantalla afectada.
- Si el sistema indica que el examen ya fue completado hoy, esperá al siguiente día de negocio del CBA.
- Si no hay preguntas suficientes al iniciar el examen, contactá al administrador: debe haber suficientes preguntas válidas para la cantidad configurada.
- No compartas tu contraseña ni la sesión con otra persona.
