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

export interface VerificationRequestPayload {
  patient: {
    first_name: string
    last_name: string
    date_of_birth: string // YYYY-MM-DD
  }
  policy: {
    payer_name: string
    member_id: string
    group_number?: string
    policy_number?: string
    subscriber_name?: string
    relationship_to_subscriber?: string
  }
}

export interface InsuranceVerification {
  id: string
  status: string
  verified_at: string | null
  error_message: string | null
  benefits: {
    annual_maximum: number | null
    annual_maximum_remaining: number | null
    deductible: number | null
    deductible_remaining: number | null
    preventive_coverage: number | null
    basic_coverage: number | null
    major_coverage: number | null
  } | null
  treatment_benefits: Array<{
    treatment: string
    covered: boolean
    coverage_percentage: number | null
    waiting_period: string | null
    frequency: string | null
  }>
}

export async function verifyInsurance(
  payload: VerificationRequestPayload,
): Promise<InsuranceVerification> {
  const res = await fetch(`${BACKEND_URL}/api/verifications/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as
      | { detail?: string }
      | null
    throw new Error(errorBody?.detail ?? `Verification failed with status ${res.status}`)
  }

  return (await res.json()) as InsuranceVerification
}