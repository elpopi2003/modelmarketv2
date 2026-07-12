import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Heart, MessageSquare } from 'lucide-react'
import { useMarkNotificationsRead, useNotifications } from '@/hooks/useNotifications'
import { formatRelativeTime } from '@/lib/format'
import type { Notification } from '@/lib/api/notifications'
import { cn } from '@/lib/utils'

function NotificationIcon({ type }: { type: string }) {
  const Icon = type === 'message' ? MessageSquare : type === 'favorite' ? Heart : Bell
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
      <Icon className="size-4" />
    </span>
  )
}

function NotificationRow({ notification }: { notification: Notification }) {
  const unread = !notification.read_at
  const content = (
    <div className={cn('flex items-start gap-3 p-4', unread && 'bg-accent/5')}>
      <NotificationIcon type={notification.type} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{notification.title}</p>
        {notification.body && (
          <p className="truncate text-sm text-muted-foreground">{notification.body}</p>
        )}
        <p className="mm-mono mt-1 text-xs text-muted-foreground">
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>
      {unread && <span className="mt-1 size-2 shrink-0 rounded-full bg-accent" aria-label="No leída" />}
    </div>
  )

  return notification.link ? (
    <Link to={notification.link} className="block transition-colors hover:bg-muted">
      {content}
    </Link>
  ) : (
    content
  )
}

export default function Notificaciones() {
  const { data: notifications, isLoading } = useNotifications()
  const markRead = useMarkNotificationsRead()

  // Marca todas como leídas al abrir la página.
  useEffect(() => {
    markRead.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Notificaciones</h1>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : !notifications || notifications.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-muted-foreground">No tienes notificaciones.</p>
        </div>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {notifications.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </section>
  )
}
