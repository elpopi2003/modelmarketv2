import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useCreateListing, useMyListings } from '@/hooks/useListings'
import { useBrands, useCategories } from '@/hooks/useCatalogs'
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits'
import { uploadListingPhoto } from '@/lib/api/storage'
import { listingSchema, type ListingFormValues } from '@/lib/schemas/listing'
import { CONDITION_LABELS } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-sm text-destructive">{message}</p>
}

export default function PublicarAnuncio() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const createListing = useCreateListing()
  const { data: myListings, isLoading: loadingMine } = useMyListings()
  const { data: brands } = useBrands()
  const { data: categories } = useCategories()
  const { canPublishListing, maxPhotosPerItem, capabilities } = useSubscriptionLimits()

  const [files, setFiles] = useState<File[]>([])
  const [serverError, setServerError] = useState<string | null>(null)

  const previews = useMemo(
    () => files.map((file) => ({ key: `${file.name}-${file.lastModified}`, url: URL.createObjectURL(file) })),
    [files],
  )
  useEffect(() => () => previews.forEach((p) => URL.revokeObjectURL(p.url)), [previews])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: { condition: 'used' },
  })

  function addFiles(list: FileList | null) {
    if (!list) return
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, maxPhotosPerItem))
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function onSubmit(values: ListingFormValues) {
    if (!user) return
    setServerError(null)
    try {
      const photos: string[] = []
      for (const file of files) {
        photos.push(await uploadListingPhoto(user.id, file))
      }
      await createListing.mutateAsync({
        user_id: user.id,
        title: values.title,
        description: values.description?.trim() || null,
        price_cents: Math.round(values.priceEuros * 100),
        condition: values.condition,
        scale: values.scale?.trim() || null,
        category_id: values.categoryId || null,
        brand_id: values.brandId || null,
        photos,
      })
      navigate('/dashboard')
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }

  if (loadingMine) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-16">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </section>
    )
  }

  const count = myListings?.length ?? 0
  if (!canPublishListing(count)) {
    return (
      <section className="mx-auto max-w-2xl px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Has alcanzado el límite de tu plan</CardTitle>
            <CardDescription>
              El plan {capabilities.label} permite {capabilities.maxListings} anuncio activo y ya
              tienes {count}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Mejora a PRO o Retail para publicar sin límites.
            </p>
            <Button asChild>
              <Link to="/precios">Ver planes</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Publicar anuncio</h1>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input id="title" placeholder="p. ej. Tanque Tiger I 1:35" {...register('title')} />
              <FieldError message={errors.title?.message} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priceEuros">Precio (€)</Label>
                <Input
                  id="priceEuros"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...register('priceEuros')}
                />
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

            <div className="grid grid-cols-2 gap-4">
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
                  ({files.length}/{maxPhotosPerItem})
                </span>
              </Label>
              <input
                id="photos"
                type="file"
                accept="image/*"
                multiple
                disabled={files.length >= maxPhotosPerItem}
                onChange={(e) => {
                  addFiles(e.target.files)
                  e.target.value = ''
                }}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
              />
              {previews.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-3">
                  {previews.map((preview, index) => (
                    <div key={preview.key} className="relative">
                      <img
                        src={preview.url}
                        alt=""
                        className="h-20 w-20 rounded-md border border-border object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
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
                {isSubmitting ? 'Publicando…' : 'Publicar anuncio'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link to="/dashboard">Cancelar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
