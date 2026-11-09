import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as authApi from '@/lib/api/auth'
import type { AuthUser } from '@/lib/api/auth'
import { AppError, getErrorMessage } from '@/lib/errors'
import { queryKeys } from '@/lib/queryKeys'

export type { AuthUser }

interface AuthResult {
  error: string | null
  /** Código del servidor (`email_not_confirmed`, `suspended`, ...) para reaccionar en la UI. */
  code?: string
  /** true si el alta requiere confirmar el email antes de tener sesión. */
  needsConfirmation?: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  /** true mientras se resuelve la sesión inicial. */
  loading: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<void>
  /** Vuelve a leer el usuario del servidor (tras restablecer la contraseña, por ejemplo). */
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const failure = (error: unknown): AuthResult => ({
  error: getErrorMessage(error),
  code: error instanceof AppError ? error.code : undefined,
})

/**
 * Sesión del usuario. La fuente de verdad es la cookie httpOnly que gestiona el servidor;
 * aquí solo se cachea `GET /api/auth/me` con TanStack Query.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const me = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: authApi.fetchMe,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const value = useMemo<AuthContextValue>(
    () => ({
      user: me.data ?? null,
      loading: me.isPending,
      async signIn(email, password) {
        try {
          const user = await authApi.login(email, password)
          // Datos de otra sesión (o de visitante) no deben sobrevivir al cambio de usuario.
          queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' })
          queryClient.setQueryData(queryKeys.auth.me, user)
          return { error: null }
        } catch (error) {
          return failure(error)
        }
      },
      async signUp(email, password) {
        try {
          await authApi.register(email, password)
          return { error: null, needsConfirmation: true }
        } catch (error) {
          return failure(error)
        }
      },
      async signOut() {
        try {
          await authApi.logout()
        } finally {
          queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' })
          queryClient.setQueryData(queryKeys.auth.me, null)
        }
      },
      async refresh() {
        await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me })
      },
    }),
    [me.data, me.isPending, queryClient],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
