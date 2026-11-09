import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import {
  useConversations,
  useMarkConversationRead,
  useMessages,
  useSendMessage,
} from '@/hooks/useMessages'
import type { ConversationListItem } from '@/lib/api/messages'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { MaybeLink } from '@/components/ui/maybe-link'

function ConversationRow({ item, active }: { item: ConversationListItem; active: boolean }) {
  return (
    <Link
      to={`/mensajes/${item.conversation.id}`}
      className={cn(
        'flex items-center gap-3 border-b border-border p-3 transition-colors hover:bg-muted',
        active && 'bg-muted',
      )}
    >
      {item.subjectCover ? (
        <img
          src={item.subjectCover}
          alt=""
          loading="lazy"
          className="h-10 w-10 shrink-0 rounded-md border border-border object-cover"
        />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 font-mono text-xs text-primary">
          {item.otherName.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{item.otherName}</p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="mm-mono uppercase">
            {item.subjectKind === 'listing' ? 'Anuncio' : 'Petición'}
          </span>{' '}
          ·{' '}
          <span className={item.subjectAvailable ? undefined : 'italic'}>{item.subjectTitle}</span>
        </p>
      </div>
    </Link>
  )
}

function Thread({ conversationId, item }: { conversationId: string; item?: ConversationListItem }) {
  const { user } = useAuth()
  const { data: messages, isLoading } = useMessages(conversationId)
  const sendMessage = useSendMessage()
  const markRead = useMarkConversationRead()
  const [body, setBody] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Marca como leídos al abrir y cuando cambian los mensajes.
  useEffect(() => {
    markRead.mutate(conversationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, messages?.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages?.length])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!text) return
    setBody('')
    await sendMessage.mutateAsync({ conversationId, body: text })
  }

  return (
    <div className="flex h-[70vh] flex-col rounded-md border border-border">
      <div className="flex items-center gap-3 border-b border-border p-3">
        <Link
          to="/mensajes"
          className="text-sm text-muted-foreground hover:text-foreground lg:hidden"
        >
          ←
        </Link>
        <div className="min-w-0">
          <p className="truncate font-semibold">{item?.otherName ?? 'Conversación'}</p>
          {item && (
            <MaybeLink
              to={item.subjectLink}
              className={cn(
                'truncate text-xs text-muted-foreground',
                item.subjectAvailable && 'hover:text-primary',
              )}
            >
              <span className="mm-mono uppercase">
                {item.subjectKind === 'listing' ? 'Anuncio' : 'Petición'}
              </span>{' '}
              ·{' '}
              <span className={item.subjectAvailable ? undefined : 'italic'}>
                {item.subjectTitle}
              </span>
            </MaybeLink>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : messages && messages.length > 0 ? (
          messages.map((m) => {
            const mine = m.sender_id === user?.id
            return (
              <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <p
                  className={cn(
                    'max-w-[75%] whitespace-pre-line rounded-md px-3 py-2 text-sm',
                    mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                  )}
                >
                  {m.body}
                </p>
              </div>
            )
          })
        ) : (
          <p className="text-sm text-muted-foreground">Aún no hay mensajes. Escribe el primero.</p>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-3">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe un mensaje…"
          aria-label="Mensaje"
        />
        <Button type="submit" disabled={sendMessage.isPending || !body.trim()}>
          Enviar
        </Button>
      </form>
    </div>
  )
}

export default function Mensajes() {
  const { id: selectedId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: conversations, isLoading } = useConversations()

  const selectedItem = conversations?.find((c) => c.conversation.id === selectedId)

  // Si el id de la URL no está en la lista, vuelve al índice.
  useEffect(() => {
    if (selectedId && conversations && !selectedItem) {
      navigate('/mensajes', { replace: true })
    }
  }, [selectedId, conversations, selectedItem, navigate])

  return (
    <section className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Mensajes</h1>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside
          className={cn(
            'overflow-hidden rounded-md border border-border',
            selectedId && 'hidden lg:block',
          )}
        >
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Cargando…</p>
          ) : !conversations || conversations.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No tienes conversaciones. Contacta a un vendedor desde un anuncio.
            </p>
          ) : (
            conversations.map((item) => (
              <ConversationRow
                key={item.conversation.id}
                item={item}
                active={item.conversation.id === selectedId}
              />
            ))
          )}
        </aside>

        <div className={cn(!selectedId && 'hidden lg:block')}>
          {selectedId ? (
            <Thread conversationId={selectedId} item={selectedItem} />
          ) : (
            <div className="grid h-[70vh] place-items-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
              Elige una conversación
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
