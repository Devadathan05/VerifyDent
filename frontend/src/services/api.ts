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

export interface PlannedTreatment {
  treatment: string
  quantity: number
  planned_date?: string | null
  notes?: string | null
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

export interface MappingTraceItem {
  provider: string | null
  schema_version: string | null
  source: string
  target: string
  mapping_type: string
}

export interface NormalizedBenefits {
  // Provider metadata
  provider_source: string | null
  provider_environment: string | null
  provider_schema_version: string | null
  
  // Payer/carrier
  payer_id: string | null
  payer_name: string | null
  
  // Group
  group_number: string | null
  group_name: string | null
  employer_name: string | null
  
  // Plan
  plan_id: string | null
  plan_name: string | null
  plan_type: string | null
  effective_date: string | null
  termination_date: string | null
  
  // Subscriber
  subscriber_id: string | null
  subscriber_name: string | null
  subscriber_relationship: string | null
  
  // Member
  member_id: string | null
  member_name: string | null
  date_of_birth: string | null
  relationship_to_subscriber: string | null
  
  // Eligibility & Benefits
  eligibility_status: string | null
  annual_maximum: number | null
  annual_maximum_remaining: number | null
  deductible: number | null
  deductible_remaining: number | null
  preventive_coverage: number | null
  basic_coverage: number | null
  major_coverage: number | null
  treatment_benefits: Array<{
    treatment: string
    covered: boolean
    coverage_percentage: number | null
    waiting_period: string | null
    frequency: string | null
  }>
}

export interface NormalizationDemoResponse {
  provider: string
  raw_response: Record<string, unknown>
  normalized: NormalizedBenefits
  mapping_trace: MappingTraceItem[]
}

export async function fetchNormalizationDemo(
  providerName: string,
  subscriberId?: string
): Promise<NormalizationDemoResponse> {
  const body: Record<string, string> = { provider_name: providerName }
  if (subscriberId) {
    body.subscriber_id = subscriberId
  }
  
  const res = await fetch(`${BACKEND_URL}/api/normalization/demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as
      | { detail?: string }
      | null
    throw new Error(errorBody?.detail ?? `Normalization demo failed with status ${res.status}`)
  }

  return (await res.json()) as NormalizationDemoResponse
}

export interface TreatmentAnalysis {
  treatment: string
  estimated_cost: string | null
  estimated_insurance: string | null
  patient_responsibility: string | null
  missing_information_message: string | null
}

export async function fetchTreatmentAnalysis(
  verificationId: string,
  treatmentName: string,
): Promise<TreatmentAnalysis> {
  const res = await fetch(
    `${BACKEND_URL}/api/verifications/${verificationId}/treatments/${encodeURIComponent(treatmentName)}/analysis`,
  )

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as
      | { detail?: string }
      | null
    throw new Error(errorBody?.detail ?? `Treatment analysis failed with status ${res.status}`)
  }

  return (await res.json()) as TreatmentAnalysis
}

export interface PlannedTreatment {
  treatment: string
  quantity: number
  planned_date?: string | null
  notes?: string | null
}

export interface TreatmentPlanRequest {
  treatments: PlannedTreatment[]
}

export interface PlannedTreatmentAnalysis {
  treatment: string
  quantity: number
  requested_cost: number | null
  coverage_percentage: number | null
  estimated_insurance: number | null
  patient_responsibility: number | null
  status: string
  limitations: string | null
  missing_information_message: string | null
}

export interface TreatmentPlanAnalysis {
  total_cost: number | null
  estimated_insurance: number | null
  patient_responsibility: number | null
  annual_maximum_remaining: number | null
  capped_by_maximum: boolean
  exact_estimate_unavailable: boolean
  unavailable_reason: string | null
  treatments: PlannedTreatmentAnalysis[]
}

export async function fetchTreatmentPlanAnalysis(
  verificationId: string,
  request: TreatmentPlanRequest,
): Promise<TreatmentPlanAnalysis> {
  const res = await fetch(`${BACKEND_URL}/api/verifications/${verificationId}/treatment-plan/analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as
      | { detail?: string }
      | null
    throw new Error(errorBody?.detail ?? `Failed to analyze treatment plan (status ${res.status})`)
  }

  return (await res.json()) as TreatmentPlanAnalysis
}

export interface AppointmentPatientPayload {
  first_name: string
  last_name: string
  date_of_birth: string
}

export interface AppointmentCreatePayload {
  patient: AppointmentPatientPayload
  appointment_date: string
  appointment_time: string
  appointment_type: string
  status: string
}

export interface AppointmentSummary {
  id: string
  patient_name: string
  appointment_date: string
  appointment_time: string
  appointment_type: string
  status: string
  insurance_status: string
}

export interface AppointmentDetail {
  appointment: {
    id: string
    appointment_date: string
    appointment_time: string
    appointment_type: string
    status: string
    insurance_verification_id: string | null
  }
  patient: {
    id: string
    first_name: string
    last_name: string
    date_of_birth: string
  }
  verification: InsuranceVerification | null
}

export async function createAppointment(payload: AppointmentCreatePayload) {
  const res = await fetch(`${BACKEND_URL}/api/appointments/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('Failed to create appointment')
  return await res.json()
}

export async function fetchAppointments(): Promise<AppointmentSummary[]> {
  const res = await fetch(`${BACKEND_URL}/api/appointments/`)
  if (!res.ok) throw new Error('Failed to fetch appointments')
  return (await res.json()) as AppointmentSummary[]
}

export async function fetchAppointment(id: string): Promise<AppointmentDetail> {
  const res = await fetch(`${BACKEND_URL}/api/appointments/${id}`)
  if (!res.ok) throw new Error('Failed to fetch appointment')
  return (await res.json()) as AppointmentDetail
}

export async function updateAppointment(id: string, updates: Record<string, any>) {
  const res = await fetch(`${BACKEND_URL}/api/appointments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update appointment')
  return await res.json()
}