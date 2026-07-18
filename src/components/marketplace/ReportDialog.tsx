import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flag, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCreateReport } from '@/hooks/useAdmin'
import { REPORT_REASON_LABELS } from '@/lib/format'
import { getErrorMessage } from '@/lib/errors'
import type { ReportReason } from '@/integrations/supabase/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

/**
 * Denuncia de un anuncio o una petición. <dialog> nativo, igual que RequestDialog.
 * La BD impide duplicar una denuncia viva del mismo usuario sobre el mismo objeto.
 */
export function ReportDialog({
  open,
  onClose,
  listingId,
  requestId,
  targetTitle,
}: {
  open: boolean
  onClose: () => void
  listingId?: string
  requestId?: string
  targetTitle: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const { user } = useAuth()
  const createReport = useCreateReport()
  const [reason, setReason] = useState<ReportReason>('spam')
  const [details, setDetails] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
    if (open) {
      setSent(false)
      setError(null)
    }
  }, [open])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      await createReport.mutateAsync({ listingId, requestId, reason, details })
      setSent(true)
      setDetails('')
    } catch (e) {
      // El índice único devuelve un error poco claro; lo traducimos.
      const message = getErrorMessage(e)
      setError(
        message.includes('duplicate') || message.includes('unique')
          ? 'Ya has denunciado esto y tu reporte sigue en revisión.'
          : message,
      )
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border-2 border-border bg-background p-0 text-foreground shadow-lg backdrop:bg-foreground/50"
      aria-label="Denunciar contenido"
    >
      <div className="p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Flag className="size-5 text-destructive" /> Denunciar
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-2 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{targetTitle}</p>

        {!user ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Necesitas una cuenta para denunciar contenido.
            </p>
            <Button asChild className="w-full">
              <Link to="/auth">Entrar</Link>
            </Button>
          </div>
        ) : sent ? (
          <div className="space-y-3">
            <p className="rounded-md bg-sealed/10 p-3 text-sm text-sealed-ink">
              Gracias. Nuestro equipo revisará esta denuncia.
            </p>
            <Button variant="outline" className="w-full" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium leading-none">Motivo</legend>
              {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((value) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="size-4"
                  />
                  {REPORT_REASON_LABELS[value]}
                </label>
              ))}
            </fieldset>

            <div className="space-y-2">
              <Label htmlFor="report-details">Detalles (opcional)</Label>
              <Textarea
                id="report-details"
                rows={3}
                maxLength={1000}
                placeholder="Cuéntanos qué ocurre…"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              variant="destructive"
              className="w-full"
              disabled={createReport.isPending}
            >
              <Flag /> {createReport.isPending ? 'Enviando…' : 'Enviar denuncia'}
            </Button>
          </form>
        )}
      </div>
    </dialog>
  )
}
