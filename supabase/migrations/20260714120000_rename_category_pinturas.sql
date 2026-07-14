-- ModelMarket — Renombra la categoría "Dioramas y accesorios" -> "Pinturas y Accesorios".
-- Actualiza in situ (conserva el id, así que anuncios/peticiones que la referencian siguen OK).
-- Idempotente: no hace nada si ya está renombrada.

update public.categories
set name = 'Pinturas y Accesorios',
    slug = 'pinturas-accesorios'
where slug = 'dioramas-accesorios';
