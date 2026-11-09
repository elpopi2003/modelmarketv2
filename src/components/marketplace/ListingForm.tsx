import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useCreateListing, useUpdateListing } from '@/hooks/useListings'
import { useBrands, useCategories } from '@/hooks/useCatalogs'
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits'
import { usePhotoUploader } from '@/hooks/usePhotoUploader'
import { listingSchema, type ListingFormValues } from '@/lib/schemas/listing'
import { getOrCreateBrand } from '@/lib/api/catalogs'
import { queryKeys } from '@/lib/queryKeys'
import { CONDITION_LABELS, DECALS_LABELS } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import type { Listing } from '@/lib/api/listings'
import { PhotoUploaderField } from '@/components/marketplace/PhotoUploaderField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

/** Escalas ofrecidas en el desplegable. "Otra" abre un campo para escribir una a mano. */
const SCALE_OPTIONS = [
  '1:144', '1:72', '1:48', '1:35', '1:32', '1:12', '1:24', '1:25',
  '1:350', '1:700', '1:200', '1:87', '1:160', '1:220',
] as const

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-sm text-destructive">{message}</p>
}

/** ¿La escala coincide con una opción del desplegable? Decide si se edita como "Otra". */
function isPresetScale(scale: string | null | undefined): boolean {
  return !!scale && (SCALE_OPTIONS as readonly string[]).includes(scale)
}

export function ListingForm({
  mode,
  listing,
  onDone,
}: {
  mode: 'create' | 'edit'
  listing?: Listing
  onDone: (id: string) => void
}) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const createListing = useCreateListing()
  const updateListing = useUpdateListing()
  const { data: brands } = useBrands()
  const { data: categories } = useCategories()
  const { maxPhotosPerItem } = useSubscriptionLimits()
  const uploader = usePhotoUploader({ max: maxPhotosPerItem, initialUrls: listing?.photos })
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: listing
      ? {
          title: listing.title,
          description: listing.description ?? '',
          priceEuros: listing.price_cents / 100,
          condition: listing.condition,
          decals: listing.decals,
          shippingInpost: listing.shipping_inpost,
          handDelivery: listing.hand_delivery,
          acceptsOffers: listing.accepts_offers,
          // Si la escala guardada no está entre las del desplegable, se edita como "Otra".
          scale: isPresetScale(listing.scale) ? listing.scale! : 'other',
          customScale: isPresetScale(listing.scale) ? '' : (listing.scale ?? ''),
          categoryId: listing.category_id ?? '',
          brandId: listing.brand_id ?? '',
          newBrand: '',
        }
      : {
          condition: 'sealed',
          decals: 'perfect',
          shippingInpost: true,
          handDelivery: false,
          acceptsOffers: true,
          title: '',
          description: '',
          scale: '',
          customScale: '',
          categoryId: '',
          brandId: '',
          newBrand: '',
        },
  })

  async function onSubmit(values: ListingFormValues) {
    if (!user) return
    setServerError(null)
    if (uploader.photos.length === 0) {
      setServerError('Añade al menos una foto.')
      return
    }
    try {
      // "Otra": crea (o reutiliza) la marca y usa su id; refresca el listado.
      let brandId = values.brandId
      if (brandId === 'other') {
        brandId = await getOrCreateBrand(values.newBrand!.trim())
        await queryClient.invalidateQueries({ queryKey: queryKeys.catalog.brands })
      }

      const payload = {
        title: values.title,
        description: values.description?.trim() || null,
        price_cents: Math.round(values.priceEuros * 100),
        condition: values.condition,
        decals: values.decals,
        shipping_inpost: values.shippingInpost,
        hand_delivery: values.handDelivery,
        accepts_offers: values.acceptsOffers,
        // "Otra" guarda lo escrito a mano; cualquier otra opción, el valor del desplegable.
        scale: (values.scale === 'other' ? values.customScale?.trim() : values.scale) || null,
        category_id: values.categoryId || null,
        brand_id: brandId || null,
        photos: await uploader.resolveUrls(user.id),
      }

      if (mode === 'edit' && listing) {
        const updated = await updateListing.mutateAsync({ id: listing.id, updates: payload })
        onDone(updated.id)
      } else {
        const created = await createListing.mutateAsync({ user_id: user.id, ...payload })
        onDone(created.id)
      }
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }

  // Un <select> nativo no puede mostrar un valor cuyo <option> aún no existe: si el
  // formulario monta antes que los catálogos, la marca/categoría del modo edición se
  // pintaría como la primera opción. Se espera a tenerlos antes de montar los selects.
  if (!brands || !categories) {
    return <div className="h-96 animate-pulse rounded-lg bg-muted" aria-busy="true" />
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" placeholder="p. ej. Tanque Tiger I 1:35" {...register('title')} />
        <FieldError message={errors.title?.message} />
      </div>

      {/* Precio + acepta ofertas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="priceEuros">Precio (€)</Label>
          <Input id="priceEuros" type="number" step="0.01" min="0" placeholder="0.00" {...register('priceEuros')} />
          <FieldError message={errors.priceEuros?.message} />
        </div>
        <label className="flex items-start gap-2.5 self-end rounded-lg border border-border bg-muted/40 p-3">
          <input
            type="checkbox"
            className="mt-0.5 size-4 rounded border-input"
            {...register('acceptsOffers')}
          />
          <span>
            <span className="text-sm font-medium">Acepto ofertas por debajo del precio</span>
            <span className="block text-xs text-muted-foreground">
              Si lo desmarcas, solo podrán ofrecerte el precio publicado: nadie podrá regatear.
            </span>
          </span>
        </label>
      </div>

      {/* Estado + calcas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="condition">Estado</Label>
          <select id="condition" className={selectClass} {...register('condition')}>
            {Object.entries(CONDITION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <FieldError message={errors.condition?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="decals">Calcas</Label>
          <select id="decals" className={selectClass} {...register('decals')}>
            {Object.entries(DECALS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <FieldError message={errors.decals?.message} />
        </div>
      </div>

      {/* Categoría + marca + escala. Los campos condicionales (marca/escala nuevas) caen
          bajo su propia columna. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="categoryId">Categoría</Label>
          <select id="categoryId" className={selectClass} {...register('categoryId')}>
            <option value="" disabled>
              Selecciona categoría
            </option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <FieldError message={errors.categoryId?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brandId">Marca</Label>
          <select id="brandId" className={selectClass} {...register('brandId')}>
            <option value="" disabled>
              Selecciona marca
            </option>
            {brands?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
            <option value="other">Otra marca…</option>
          </select>
          <FieldError message={errors.brandId?.message} />
          {watch('brandId') === 'other' && (
            <div className="space-y-2 pt-1">
              <Input
                aria-label="Nueva marca"
                placeholder="Escribe la marca nueva"
                {...register('newBrand')}
              />
              <FieldError message={errors.newBrand?.message} />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="scale">Escala</Label>
          <select id="scale" className={selectClass} {...register('scale')}>
            <option value="" disabled>
              Selecciona escala
            </option>
            {SCALE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
            <option value="other">Otra…</option>
          </select>
          <FieldError message={errors.scale?.message} />
          {watch('scale') === 'other' && (
            <div className="space-y-2 pt-1">
              <Input
                aria-label="Otra escala"
                placeholder="Escribe la escala (p. ej. 1:9)"
                {...register('customScale')}
              />
              <FieldError message={errors.customScale?.message} />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" rows={5} {...register('description')} />
        <FieldError message={errors.description?.message} />
      </div>

      <PhotoUploaderField
        photos={uploader.photos}
        onAdd={uploader.addFiles}
        onRemove={uploader.removePhoto}
        max={maxPhotosPerItem}
        canAddMore={uploader.canAddMore}
      />

      {/* Método de entrega, a ancho completo al final. */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium leading-none">Método de entrega</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 rounded border-input" {...register('shippingInpost')} />
          Envíos disponibles
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 rounded border-input" {...register('handDelivery')} />
          Entrega en mano
        </label>
        <FieldError message={errors.shippingInpost?.message} />
      </fieldset>

      {/* Aviso legal: al ofrecer envíos, ModelMarket no interviene ni en la logística ni en
          el pago, y conviene dejarlo por escrito. */}
      {watch('shippingInpost') && (
        <div
          role="note"
          className="space-y-2 rounded-md border border-accent/40 bg-accent/5 p-4 text-xs leading-relaxed text-muted-foreground sm:text-sm"
        >
          <p className="font-semibold uppercase tracking-wide text-accent">
            Aviso sobre los envíos
          </p>
          <p>
            ModelMarket actúa exclusivamente como plataforma de contacto entre usuarios y no
            interviene en la entrega de los artículos. La logística del envío —incluida la
            elección del proveedor o empresa de transporte, la generación y contratación de
            etiquetas, el embalaje, los plazos, el coste del porte y su abono— es
            responsabilidad única del vendedor y del comprador, quienes deberán acordar sus
            condiciones de mutuo acuerdo.
          </p>
          <p>
            Asimismo, ModelMarket no recauda, custodia ni entrega cantidad económica alguna
            derivada de las operaciones entre sus usuarios y, en particular, no percibe comisión
            sobre las ventas. Cualquier pago se efectúa de forma directa y exclusiva entre
            comprador y vendedor, quedando ModelMarket ajena y exenta de toda responsabilidad
            respecto de dichas transacciones.
          </p>
        </div>
      )}

      <FieldError message={serverError ?? undefined} />

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? mode === 'edit'
              ? 'Guardando…'
              : 'Publicando…'
            : mode === 'edit'
              ? 'Guardar cambios'
              : 'Publicar anuncio'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link to="/dashboard">Cancelar</Link>
        </Button>
      </div>
    </form>
  )
}
