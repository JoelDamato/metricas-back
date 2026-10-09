# Seguimiento CSM local · 6 de octubre de 2026

Implementado en el servidor local (puerto 3101), sin publicar la interfaz en producción.

- Semáforo de plataforma con etapas y ventanas, alertas primero, orden por prioridad/días/nombre, búsqueda y filtros por estado. Ocultar/restaurar sólo afecta cada lista durante la visita.
- Excluye ingresos anteriores a 2026, ingresos sin fecha válida, renovaciones, personalizados, sin acceso, pausa y abandono. No usa la fecha de creación en Supabase como fecha de ingreso.
- Umbrales existentes de módulos conservados. Ventanas y tramos de sesiones permiten configurar amarillo y rojo compartidos; no se inventan límites para etapas sin reglas.
- Notas por GHL ID compartidas, autor/fecha y control de revisión para evitar sobrescrituras simultáneas.
- Diagnóstico medido desde F. Onboarding, hasta 7 días inclusive y después de 7; pendientes por cohorte de onboarding. Fechas incompletas se informan, no se clasifican artificialmente.
- Sesiones sin Costos 2 y gráfico anual mensual por tipo de sesión.
- Semáforo entre sesiones, desglose por cliente con filtros realizada/pendiente y segmentación separada de modelo/rubro.
- No se reorganizó navegación ni se retiraron accesos existentes.

Persistencia: migraciones 20261006210000 y 20261006213000 instaladas en Supabase compartido. Tablas privadas de notas/reglas; perfiles livianos se actualizan por trigger del receptor GHL. No se modificaron históricos de CSM ni contactos GHL.

Validación: 20 pruebas de cálculo, filtros, persistencia SQL y concurrencia aprobadas. Seis vistas recorridas con Puppeteer como Mati Randazzo, sin errores JavaScript. Se comprobaron filtros, ocultar/restaurar, apertura de reglas y vista móvil. Las pruebas de escritura se ejecutaron en PGlite, sin dejar notas o reglas de prueba en clientes reales.

Pendiente de origen: no se encontró un campo Rubro en el catálogo GHL recibido. La interfaz muestra “Sin rubro informado”; se solicitó el nombre del campo si ya existe. La lectura queda preparada para Rubro/rubro sin confundirlo con modelo de negocio.
