import { api } from './http'

/** Datos públicos de la plataforma. */
export interface PlatformInfo {
  /** Beta sin pagos: todas las cuentas tienen PRO gratis y no se ofrece pagar. */
  betaAllPro: boolean
}

export const fetchPlatform = () => api<PlatformInfo>('/platform')
