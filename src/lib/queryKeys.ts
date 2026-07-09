/**
 * Factoría central de `queryKey`s para TanStack Query.
 *
 * Ventajas: invalidaciones consistentes (`queryKeys.listings.all`), sin strings sueltos
 * repartidos por los hooks. Cada dominio expone `all`, listas y detalle.
 */

export const queryKeys = {
  listings: {
    all: ['listings'] as const,
    lists: () => [...queryKeys.listings.all, 'list'] as const,
    list: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.listings.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.listings.all, 'detail', id] as const,
  },
  requests: {
    all: ['requests'] as const,
    lists: () => [...queryKeys.requests.all, 'list'] as const,
    list: (filters: Record<string, unknown> = {}) =>
      [...queryKeys.requests.lists(), filters] as const,
    detail: (id: string) => [...queryKeys.requests.all, 'detail', id] as const,
    mine: () => [...queryKeys.requests.all, 'mine'] as const,
  },
  favorites: {
    all: ['favorites'] as const,
    list: (userId: string) => [...queryKeys.favorites.all, userId] as const,
  },
  conversations: {
    all: ['conversations'] as const,
    list: () => [...queryKeys.conversations.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.conversations.all, 'detail', id] as const,
    messages: (conversationId: string) =>
      [...queryKeys.conversations.all, 'messages', conversationId] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => [...queryKeys.notifications.all, 'list'] as const,
    unreadCount: () => [...queryKeys.notifications.all, 'unread-count'] as const,
  },
  subscription: {
    all: ['subscription'] as const,
    current: () => [...queryKeys.subscription.all, 'current'] as const,
  },
  profile: {
    all: ['profile'] as const,
    detail: (userId: string) => [...queryKeys.profile.all, userId] as const,
  },
  catalog: {
    brands: ['catalog', 'brands'] as const,
    categories: ['catalog', 'categories'] as const,
    filterOptions: ['catalog', 'filter-options'] as const,
  },
} as const
