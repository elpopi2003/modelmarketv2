import { api } from './http'

/** Usuario con sesión iniciada, tal como lo devuelve GET /api/auth/me. */
export interface AuthUser {
  id: string
  email: string
  emailVerified: boolean
  createdAt: string
  roles: ('admin' | 'user')[]
  isAdmin: boolean
}

export const fetchMe = () => api<AuthUser | null>('/auth/me')

export const login = (email: string, password: string) =>
  api<AuthUser>('/auth/login', { body: { email, password } })

export const register = (email: string, password: string) =>
  api<{ needsConfirmation: true }>('/auth/register', { body: { email, password } })

export const logout = () => api<{ loggedOut: true }>('/auth/logout', { method: 'POST', body: {} })

export const verifyEmail = (token: string) =>
  api<{ verified: true }>('/auth/verify-email', { body: { token } })

export const resendVerification = (email: string) =>
  api<{ sent: true }>('/auth/resend-verification', { body: { email } })

export const requestPasswordReset = (email: string) =>
  api<{ sent: true }>('/auth/forgot-password', { body: { email } })

export const resetPassword = (token: string, password: string) =>
  api<{ loggedIn: boolean }>('/auth/reset-password', { body: { token, password } })

export const changePassword = (password: string) =>
  api<{ changed: true }>('/auth/change-password', { body: { password } })
