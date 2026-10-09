# Grabaciones

Página local `/views/grabaciones.html`; acceso para roles total, comercial y CSM según los permisos de la página.

Lee `Grabacion de llamadas` del archivo de GHL en `csm_ghl_contacts.fields` mediante la tabla compacta `recording_sources`, sincronizada por trigger, sin consultar Notion. Extrae enlaces HTTP/HTTPS, los deduplica por cliente y permite buscar por nombre. La biblioteca se actualiza con una caché de lectura de 60 segundos; la interfaz pagina 20 enlaces.

Cada enlace tiene un identificador estable por GHL ID y URL. Sus comentarios se guardan en `recording_comments`, son visibles al equipo y sólo el autor puede editar o borrar los propios. La API obtiene la identidad de la sesión y exige revisión para editar/borrar, evitando pisar cambios concurrentes. RLS habilitado sin permisos públicos; acceso por servicio autenticado del backend.

Migraciones: `20261008120000_recording_comments.sql` y `20261008121000_recording_sources.sql`. No modifica el webhook CSM ni los datos de contactos. Si GHL cambia la URL, se considera otra grabación y los comentarios anteriores se conservan en la base.

Verificación: `node --test test/recordings.test.js`. El cambio de aplicación queda en local; requiere despliegue para habilitar la página en producción.

## Top

Solapas Todas y Top. La selección es compartida y persiste en `recording_top` (migración `20261008123000_recording_top.sql`). Sólo `leonardoalaniz19@gmail.com` y `matirandazzo@gmail.com` pueden agregar o quitar, validado en servidor. Todos los usuarios con acceso a Grabaciones pueden consultar Top y sus comentarios, que siguen vinculados al mismo enlace. Agregar una grabación ya seleccionada no reemplaza su autor original.
