export interface HealthResponse {
  status: string
  app: string
  environment: string
  version: string
  timestamp: string
}

export type ConnectionStatus = 'checking' | 'online' | 'offline'