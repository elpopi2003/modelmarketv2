# Importador masivo de maquetas (solo administradores)

Crea anuncios en bloque a partir del Excel de una colección y un ZIP con sus imágenes.
Pantalla: **Administración → Importar** (`/admin/importar`).

## 1. Preparar los ficheros

**Excel (.xlsx)** — primera hoja, primera fila = cabecera. Columnas reconocidas (en español
o inglés, con o sin tildes):

| Columna | Obligatoria | Uso |
|---|---|---|
| Marca | sí | Marca del anuncio. Si no existe se crea («Meng Model» → Meng, «Bandai Spirits» → Bandai). |
| Nombre | sí | Título (máx. 120 caracteres). |
| Precio o Precio medio | sí | Precio del anuncio. «Precio» manda sobre «Precio medio». Sin precio, la fila no se importa. |
| Referencia | recomendada | Referencia del fabricante: nombra la imagen, evita duplicados y se muestra en la ficha. |
| Escala, Categoría, Año, Estantería, Estado físico, Cantidad, Notas, Ficha | no | Ver reglas abajo. |

**ZIP de imágenes** — una imagen por maqueta (JPG, PNG, WebP o AVIF), con el nombre de su
referencia: `24229.jpg` o `Tamiya-24229.jpg` (si dos marcas comparten referencia). Las
carpetas dentro del ZIP dan igual. Las filas sin imagen no se importan.

### Desde ModelKitLibrary

```bash
python scripts/modelkitlibrary-zip.py "C:\Users\yo\Downloads\coleccion.xlsx"
```

Cruza el Excel exportado con la base de datos de ModelKitLibrary (por el enlace de
Scalemates) y crea `coleccion-imagenes.zip` junto al Excel. Solo lee; no modifica nada.

## 2. Reglas de importación

- **Estado del kit**: «Estado físico» si viene (Precintado / Abierto / Empezado); si no,
  «Por montar» = Abierto y «En construcción» = Empezado.
- **Categoría**: Aircraft → Aviación, Cars → Automóviles, Space → Ciencia ficción (y sus
  equivalentes). «Other» o desconocidas se eligen en la vista previa.
- **Cantidad > 1**: un solo anuncio con «Unidades disponibles: N» en la descripción.
- **Descripción**: notas + unidades + año + referencia + enlace a la ficha.
- **Imagen**: se marca como **«Foto de catálogo»** (es la caja oficial, no una foto real).
  Si el dueño la quita o pone delante una foto suya, la etiqueta desaparece.
- **Duplicados**: lo que ya tiene esa cuenta (misma marca + referencia) o se repite en el
  Excel se salta. Se puede reimportar un Excel ampliado sin duplicar.
- **Publicación**: inmediata y sin aplicar los límites del plan de la cuenta destinataria.
- Para todo el lote se eligen: envíos, entrega en mano, si acepta ofertas y estado de calcas.

## 3. Límites

Excel hasta 10 MB y 2.000 filas; ZIP hasta 300 MB (cada imagen hasta 20 MB). Si en el VPS
un ZIP grande da error 413, subir `client_max_body_size` en las directivas de nginx del
dominio (p. ej. `client_max_body_size 300m;`).
