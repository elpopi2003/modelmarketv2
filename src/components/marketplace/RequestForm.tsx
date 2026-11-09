import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useCreateRequest, useUpdateRequest } from '@/hooks/useRequests'
import { useBrands, useCategories } from '@/hooks/useCatalogs'
import { useSubscriptionLimits } from '@/hooks/useSubscriptionLimits'
import { usePhotoUploader } from '@/hooks/usePhotoUploader'
import { requestSchema, type RequestFormValues } from '@/lib/schemas/request'
import { CONDITION_LABELS, DECALS_REQUIREMENT_LABELS, URGENCY_LABELS } from '@/lib/format'
import { getOrCreateBrand } from '@/lib/api/catalogs'
import { queryKeys } from '@/lib/queryKeys'
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
  const queryClient = useQueryClient()
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
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: request
      ? {
          title: request.title,
          description: request.description ?? '',
          maxPriceEuros:
            request.max_price_cents != null ? request.max_price_cents / 100 : undefined,
          scale: request.scale ?? '',
          categoryId: request.category_id ?? '',
          brandId: request.brand_id ?? '',
          newBrand: '',
          acceptedConditions: request.accepted_conditions,
          decalsRequirement: request.decals_requirement,
          urgency: request.urgency,
        }
      : {
          title: '',
          description: '',
          scale: '',
          categoryId: '',
          brandId: '',
          newBrand: '',
          // Lo menos restrictivo por defecto: cualquier estado, calcas no importantes.
          acceptedConditions: ['sealed', 'opened', 'started'],
          decalsRequirement: 'any',
          urgency: 'normal',
        },
  })

  async function onSubmit(values: RequestFormValues) {
    if (!user) return
    setServerError(null)
    if (uploader.photos.length === 0) {
      setServerError('Añade al menos una foto de referencia.')
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
        description: values.description.trim(),
        max_price_cents: Math.round(values.maxPriceEuros * 100),
        scale: values.scale.trim(),
        category_id: values.categoryId,
        brand_id: brandId,
        accepted_conditions: values.acceptedConditions,
        decals_requirement: values.decalsRequirement,
        urgency: values.urgency,
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

  // Un <select> nativo no puede mostrar un valor cuyo <option> aún no existe: si el
  // formulario monta antes que los catálogos, la marca/categoría del modo edición se
  // pintaría como la primera opción. Se espera a tenerlos antes de montar los selects.
  if (!brands || !categories) {
    return <div className="h-96 animate-pulse rounded-lg bg-muted" aria-busy="true" />
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="space-y-2">
        <Label htmlFor="title">¿Qué buscas?</Label>
        <Input
          id="title"
          placeholder="p. ej. Busco Tamiya Tiger I 1:35 precintado"
          {...register('title')}
        />
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
            placeholder="p. ej. 30"
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
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium leading-none">Estados que aceptas</legend>
        <div className="flex flex-wrap gap-4 pt-1">
          {Object.entries(CONDITION_LABELS).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                value={value}
                className="size-4 rounded border-input"
                {...register('acceptedConditions')}
              />
              {label}
            </label>
          ))}
        </div>
        <FieldError message={errors.acceptedConditions?.message} />
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="decalsRequirement">Calcas</Label>
          <select id="decalsRequirement" className={selectClass} {...register('decalsRequirement')}>
            {Object.entries(DECALS_REQUIREMENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <FieldError message={errors.decalsRequirement?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="urgency">Urgencia</Label>
          <select id="urgency" className={selectClass} {...register('urgency')}>
            {Object.entries(URGENCY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <FieldError message={errors.urgency?.message} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Detalles</Label>
        <Textarea
          id="description"
          rows={5}
          placeholder="Estado deseado, referencias, etc."
          {...register('description')}
        />
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
          {isSubmitting ? 'Guardando…' : mode === 'edit' ? 'Guardar cambios' : 'Publicar petición'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link to="/peticiones">Cancelar</Link>
        </Button>
      </div>
    </form>
  )
}
