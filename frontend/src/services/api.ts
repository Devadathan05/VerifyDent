import type { HealthResponse } from '../types/health'

export interface ExtractedField {
  value: string | null
  confidence: number | null
}

export interface InsuranceExtractionResponse {
  status: string
  extracted_at: string
  file_name: string
  file_type: string
  provider: string
  requires_confirmation: boolean
  required_fields: string[]
  raw_text: string
  fields: Record<string, ExtractedField>
}

const BACKEND_URL: string =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ??
  'http://localhost:8000'

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BACKEND_URL}/api/health`)
  if (!res.ok) {
    throw new Error(`Health check failed with status ${res.status}`)
  }
  return (await res.json()) as HealthResponse
}

export async function uploadInsuranceDocument(
  file: File,
): Promise<InsuranceExtractionResponse> {
  const body = new FormData()
  body.append('file', file)

  const res = await fetch(`${BACKEND_URL}/api/insurance/upload`, {
    method: 'POST',
    body,
  })

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as
      | { detail?: string }
      | null
    throw new Error(errorBody?.detail ?? `Upload failed with status ${res.status}`)
  }

  return (await res.json()) as InsuranceExtractionResponse
}