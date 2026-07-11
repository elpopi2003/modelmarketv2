import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useCreateListing, useUpdateListing } from '@/hooks/useListings'
import { useBrands, useCategories } from '@/hooks/useCatalogs'
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits'
import { uploadListingPhoto } from '@/lib/api/storage'
import { listingSchema, type ListingFormValues } from '@/lib/schemas/listing'
import { CONDITION_LABELS } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import type { Listing } from '@/lib/api/listings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-sm text-destructive">{message}</p>
}

/** Foto ya guardada (URL) o nueva por subir (File). */
type Photo = { kind: 'existing'; url: string } | { kind: 'new'; file: File; url: string }

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
  const createListing = useCreateListing()
  const updateListing = useUpdateListing()
  const { data: brands } = useBrands()
  const { data: categories } = useCategories()
  const { maxPhotosPerItem } = useSubscriptionLimits()

  const [photos, setPhotos] = useState<Photo[]>(
    () => listing?.photos.map((url) => ({ kind: 'existing', url }) as Photo) ?? [],
  )
  const [serverError, setServerError] = useState<string | null>(null)

  // Libera las object URLs de las fotos nuevas al desmontar/cambiar.
  useEffect(() => {
    return () => {
      photos.forEach((p) => p.kind === 'new' && URL.revokeObjectURL(p.url))
    }
  }, [photos])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: listing
      ? {
          title: listing.title,
          description: listing.description ?? '',
          priceEuros: listing.price_cents / 100,
          condition: listing.condition,
          scale: listing.scale ?? '',
          categoryId: listing.category_id ?? '',
          brandId: listing.brand_id ?? '',
        }
      : { condition: 'used' },
  })

  function addFiles(list: FileList | null) {
    if (!list) return
    const room = maxPhotosPerItem - photos.length
    const incoming: Photo[] = Array.from(list)
      .slice(0, Math.max(0, room))
      .map((file) => ({ kind: 'new', file, url: URL.createObjectURL(file) }))
    setPhotos((prev) => [...prev, ...incoming])
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const target = prev[index]
      if (target?.kind === 'new') URL.revokeObjectURL(target.url)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function onSubmit(values: ListingFormValues) {
    if (!user) return
    setServerError(null)
    try {
      // Sube solo las fotos nuevas; conserva las existentes.
      const urls: string[] = []
      for (const photo of photos) {
        urls.push(photo.kind === 'existing' ? photo.url : await uploadListingPhoto(user.id, photo.file))
      }

      const payload = {
        title: values.title,
        description: values.description?.trim() || null,
        price_cents: Math.round(values.priceEuros * 100),
        condition: values.condition,
        scale: values.scale?.trim() || null,
        category_id: values.categoryId || null,
        brand_id: values.brandId || null,
        photos: urls,
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

  const canAddMore = photos.length < maxPhotosPerItem

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" placeholder="p. ej. Tanque Tiger I 1:35" {...register('title')} />
        <FieldError message={errors.title?.message} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="priceEuros">Precio (€)</Label>
          <Input id="priceEuros" type="number" step="0.01" min="0" placeholder="0.00" {...register('priceEuros')} />
          <FieldError message={errors.priceEuros?.message} />
        </div>
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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="categoryId">Categoría</Label>
          <select id="categoryId" className={selectClass} {...register('categoryId')}>
            <option value="">Sin categoría</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="brandId">Marca</Label>
          <select id="brandId" className={selectClass} {...register('brandId')}>
            <option value="">Sin marca</option>
            {brands?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scale">Escala</Label>
        <Input id="scale" placeholder="p. ej. 1:72" {...register('scale')} />
        <FieldError message={errors.scale?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción</Label>
        <Textarea id="description" rows={5} {...register('description')} />
        <FieldError message={errors.description?.message} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="photos">
          Fotos{' '}
          <span className="font-normal text-muted-foreground">
            ({photos.length}/{maxPhotosPerItem})
          </span>
        </Label>
        <input
          id="photos"
          type="file"
          accept="image/*"
          multiple
          disabled={!canAddMore}
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
          className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
        />
        {photos.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-3">
            {photos.map((photo, index) => (
              <div key={photo.url} className="relative">
                <img
                  src={photo.url}
                  alt=""
                  className="h-20 w-20 rounded-md border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-destructive text-xs text-destructive-foreground"
                  aria-label="Quitar foto"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
