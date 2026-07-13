import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useCreateRequest, useUpdateRequest } from '@/hooks/useRequests'
import { useBrands, useCategories } from '@/hooks/useCatalogs'
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits'
import { usePhotoUploader } from '@/hooks/usePhotoUploader'
import { requestSchema, type RequestFormValues } from '@/lib/schemas/request'
import { getErrorMessage } from '@/lib/errors'
import type { Request } from '@/lib/api/requests'
import { PhotoUploaderField } from '@/components/marketplace/PhotoUploaderField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-sm text-destructive">{message}</p>
}

export function RequestForm({
  mode,
  request,
  onDone,
}: {
  mode: 'create' | 'edit'
  request?: Request
  onDone: (id: string) => void
}) {
  const { user } = useAuth()
  const createRequest = useCreateRequest()
  const updateRequest = useUpdateRequest()
  const { data: brands } = useBrands()
  const { data: categories } = useCategories()
  const { maxPhotosPerItem } = useSubscriptionLimits()
  const uploader = usePhotoUploader({ max: maxPhotosPerItem, initialUrls: request?.photos })
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: request
      ? {
          title: request.title,
          description: request.description ?? '',
          maxPriceEuros: request.max_price_cents != null ? String(request.max_price_cents / 100) : '',
          scale: request.scale ?? '',
          categoryId: request.category_id ?? '',
          brandId: request.brand_id ?? '',
        }
      : {},
  })

  async function onSubmit(values: RequestFormValues) {
    if (!user) return
    setServerError(null)
    try {
      const payload = {
        title: values.title,
        description: values.description?.trim() || null,
        max_price_cents: values.maxPriceEuros ? Math.round(Number(values.maxPriceEuros) * 100) : null,
        scale: values.scale?.trim() || null,
        category_id: values.categoryId || null,
        brand_id: values.brandId || null,
        photos: await uploader.resolveUrls(user.id),
      }

      if (mode === 'edit' && request) {
        const updated = await updateRequest.mutateAsync({ id: request.id, updates: payload })
        onDone(updated.id)
      } else {
        const created = await createRequest.mutateAsync({ user_id: user.id, ...payload })
        onDone(created.id)
      }
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="title">¿Qué buscas?</Label>
        <Input id="title" placeholder="p. ej. Busco Tamiya Tiger I 1:35 precintado" {...register('title')} />
        <FieldError message={errors.title?.message} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="maxPriceEuros">Presupuesto máximo (€)</Label>
          <Input
            id="maxPriceEuros"
            type="number"
            step="0.01"
            min="0"
            placeholder="Opcional"
            {...register('maxPriceEuros')}
          />
          <FieldError message={errors.maxPriceEuros?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="scale">Escala</Label>
          <Input id="scale" placeholder="p. ej. 1:35" {...register('scale')} />
          <FieldError message={errors.scale?.message} />
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
            <option value="">Cualquier marca</option>
            {brands?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Detalles</Label>
        <Textarea id="description" rows={5} placeholder="Estado deseado, referencias, etc." {...register('description')} />
        <FieldError message={errors.description?.message} />
      </div>

      <PhotoUploaderField
        photos={uploader.photos}
        onAdd={uploader.addFiles}
        onRemove={uploader.removePhoto}
        max={maxPhotosPerItem}
        canAddMore={uploader.canAddMore}
        label="Fotos de referencia"
      />

      <FieldError message={serverError ?? undefined} />

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? 'Guardando…'
            : mode === 'edit'
              ? 'Guardar cambios'
              : 'Publicar petición'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link to="/peticiones">Cancelar</Link>
        </Button>
      </div>
    </form>
  )
}
