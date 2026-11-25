# Códigos fijos de modelo de negocio y rubro (TA-8962)

GHL guarda en el contacto sólo el texto de la opción (los campos de contacto no admiten una clave aparte). El código fijo vive en el catálogo de `modules/csm/business-segment.js` y el panel lo guarda en `csm_business_segments` (`modelo_codigo`, `rubro_codigo`).

## Reglas

- Un código no se cambia ni se reutiliza nunca. Una opción nueva lleva el siguiente número libre de su modelo; «Otros» es siempre el 99.
- **Renombrar** una opción: cambiar `nombre` en el catálogo, pasar el nombre viejo a `antes` y renombrarla en GHL. Los contactos que quedaron con el texto viejo se siguen reconociendo con el mismo código y el panel muestra el nombre nuevo.
- **Unificar** dos opciones: sacar la que se absorbe, y en la que queda sumar su nombre a `antes` y su código a `codigosAntes`.
- Después de tocar la lista en GHL: `node scripts/verificar_catalogo_rubros.js` (sólo lee) tiene que dar OK.

## Catálogo al 25-11-2026

### GAS · Gastronomía

| Código | Rubro |
|---|---|
| GAS-01 | Restaurante y comidas |
| GAS-02 | Panadería |
| GAS-03 | Pastelería |
| GAS-04 | Cafetería |
| GAS-05 | Heladería |
| GAS-06 | Bar y bebidas |
| GAS-99 | Otros |

### FAB · Fabricación

| Código | Rubro |
|---|---|
| FAB-01 | Alimentos y bebidas |
| FAB-02 | Frigorífico |
| FAB-03 | Metalúrgica |
| FAB-04 | Ferretería, herrajes y herrería |
| FAB-05 | Construcción y aberturas |
| FAB-06 | Muebles y mobiliario |
| FAB-07 | Hogar, decoración y bazar |
| FAB-08 | Cortinas y toldos |
| FAB-09 | Indumentaria, calzado y accesorios |
| FAB-10 | Cueros y marroquinería |
| FAB-11 | Plásticos, envases y bolsas |
| FAB-12 | Librería, papelería, cotillón e imprenta |
| FAB-13 | Juguetería |
| FAB-14 | Ortopedia, estética y salud |
| FAB-15 | Automotriz |
| FAB-16 | Cosmética y perfumería |
| FAB-17 | Química y productos de limpieza |
| FAB-18 | Artesanías y regalos |
| FAB-99 | Otros |

### REV · Reventa

| Código | Rubro |
|---|---|
| REV-01 | Supermercado y verdulería |
| REV-02 | Kiosco, regalería y polirrubro |
| REV-03 | Dietética |
| REV-04 | Carnicería y pollería |
| REV-05 | Indumentaria, calzado y accesorios |
| REV-06 | Hogar, decoración y bazar |
| REV-07 | Ferretería, pinturería y corralón |
| REV-08 | Librería, papelería, cotillón e imprenta |
| REV-09 | Plásticos, envases y bolsas |
| REV-10 | Seguridad y limpieza |
| REV-11 | Farmacia, droguería y salud |
| REV-12 | Tecnología, computación y electro |
| REV-13 | Automotriz |
| REV-14 | Mascotas |
| REV-15 | Agropecuario |
| REV-16 | Juguetería |
| REV-17 | Perfumería y cosmética |
| REV-18 | Óptica, joyería y relojería |
| REV-19 | Materiales eléctricos e iluminación |
| REV-20 | Deportes, camping, caza y pesca |
| REV-21 | Bebidas y vinoteca |
| REV-22 | Vivero y florería |
| REV-99 | Otros |

### SER · Servicios

| Código | Rubro |
|---|---|
| SER-01 | Financieras |
| SER-02 | Marketing digital |
| SER-03 | Gráfica e imprenta |
| SER-04 | Tecnología y electricidad |
| SER-05 | Salud y bienestar |
| SER-06 | Clínica estética |
| SER-07 | Odontología |
| SER-08 | Construcción, arquitectura y reformas |
| SER-09 | Mantenimiento y limpieza |
| SER-10 | Climatización |
| SER-11 | Transporte |
| SER-12 | Estación de servicio y taller mecánico |
| SER-13 | Agencia de viajes |
| SER-14 | Excursiones y experiencias |
| SER-15 | Agropecuario |
| SER-16 | Estudios profesionales |
| SER-17 | Educación y capacitación |
| SER-18 | Inmobiliaria |
| SER-19 | Peluquería y barbería |
| SER-20 | Gimnasio y deportes |
| SER-21 | Veterinaria |
| SER-22 | Hotelería y alojamiento |
| SER-99 | Otros |

### EVE · Eventos

| Código | Rubro |
|---|---|
| EVE-01 | Ambientación y decoración |
| EVE-02 | Producción de espectáculos |
| EVE-03 | Salón de eventos |
| EVE-04 | Organización de eventos |
| EVE-05 | Fotografía y video |
| EVE-06 | Sonido e iluminación |
| EVE-07 | Alquiler de mobiliario y vajilla |
| EVE-99 | Otros |

