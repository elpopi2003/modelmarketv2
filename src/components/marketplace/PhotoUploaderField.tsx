import type { Photo } from '@/hooks/usePhotoUploader'
import { Label } from '@/components/ui/label'

/** Campo de subida de fotos con previews y botón de quitar. Reutilizable por los formularios. */
export function PhotoUploaderField({
  photos,
  onAdd,
  onRemove,
  max,
  canAddMore,
  id = 'photos',
  label = 'Fotos',
}: {
  photos: Photo[]
  onAdd: (files: FileList | null) => void
  onRemove: (index: number) => void
  max: number
  canAddMore: boolean
  id?: string
  label?: string
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}{' '}
        <span className="font-normal text-muted-foreground">
          ({photos.length}/{max})
        </span>
      </Label>
      <input
        id={id}
        type="file"
        accept="image/*"
        multiple
        disabled={!canAddMore}
        onChange={(e) => {
          onAdd(e.target.files)
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
                onClick={() => onRemove(index)}
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
  )
}
