import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { Send } from 'lucide-react'
import { useCreateOffer } from '@/hooks/useOffers'
import { offerSchema, type OfferFormValues } from '@/lib/schemas/offer'
import { getErrorMessage } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

/**
 * Envío de oferta sobre un anuncio o una petición. Al enviar, la RPC abre el chat
 * con la oferta dentro y navegamos al hilo.
 */
export function OfferForm({
  listingId,
  requestId,
  suggestedAmountEuros,
  onSent,
}: {
  listingId?: string
  requestId?: string
  suggestedAmountEuros?: number
  onSent?: () => void
}) {
  const createOffer = useCreateOffer()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OfferFormValues>({
    resolver: zodResolver(offerSchema),
    defaultValues: { amountEuros: suggestedAmountEuros, message: '' },
  })

  async function onSubmit(values: OfferFormValues) {
    setServerError(null)
    try {
      const conversationId = await createOffer.mutateAsync({
        listingId,
        requestId,
        amountCents: Math.round(values.amountEuros * 100),
        message: values.message?.trim() || undefined,
      })
      onSent?.()
      navigate(`/mensajes/${conversationId}`)
    } catch (error) {
      setServerError(getErrorMessage(error))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="amountEuros">Tu oferta (€)</Label>
        <Input
          id="amountEuros"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          {...register('amountEuros')}
        />
        {errors.amountEuros?.message && (
          <p className="text-sm text-destructive">{errors.amountEuros.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">Mensaje (opcional)</Label>
        <Textarea
          id="message"
          rows={3}
          placeholder="Cuéntale al vendedor por qué te interesa, estado, envío…"
          {...register('message')}
        />
        {errors.message?.message && (
          <p className="text-sm text-destructive">{errors.message.message}</p>
        )}
      </div>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}

      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={isSubmitting}>
        <Send />
        {isSubmitting ? 'Enviando…' : 'Enviar oferta'}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Al enviarla se abre un chat con la otra persona.
      </p>
    </form>
  )
}
