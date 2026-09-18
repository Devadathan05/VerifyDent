import { useRef, useState, useEffect } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

import { useHealth } from './hooks/useHealth'
import { Layout } from './components/Layout'
import {
  type InsuranceExtractionResponse,
  type InsuranceVerification,
  type NormalizationDemoResponse,
  uploadInsuranceDocument,
  verifyInsurance,
  fetchNormalizationDemo
} from './services/api'

const fieldLabels: Record<string, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  date_of_birth: 'Date of birth',
  member_id: 'Member ID',
  group_number: 'Group number',
  policy_number: 'Policy number',
  payer_name: 'Payer name',
  subscriber_name: 'Subscriber name',
  relationship_to_subscriber: 'Relationship to subscriber',
}

type AppStage = 'upload' | 'processing' | 'review' | 'confirmed' | 'verifying' | 'verified'

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<AppStage>('upload')
  const [extraction, setExtraction] = useState<InsuranceExtractionResponse | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [verificationResult, setVerificationResult] = useState<InsuranceVerification | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { status: healthStatus } = useHealth()

  const [demoProviderA, setDemoProviderA] = useState<string>('provider_c_v1')
  const [demoResponseA, setDemoResponseA] = useState<NormalizationDemoResponse | null>(null)
  const [demoLoadingA, setDemoLoadingA] = useState(false)

  const [demoPlanSubscriber, setDemoPlanSubscriber] = useState<string>('BASIC')
  const [demoResponseB, setDemoResponseB] = useState<NormalizationDemoResponse | null>(null)
  const [demoLoadingB, setDemoLoadingB] = useState(false)

  useEffect(() => {
    void loadDemoA('provider_c_v1')
    void loadDemoB('BASIC')
  }, [])


  async function loadDemoA(provider: string) {
    setDemoProviderA(provider)
    setDemoLoadingA(true)
    try {
      const result = await fetchNormalizationDemo(provider)
      setDemoResponseA(result)
    } catch (err) {
      console.error(err)
    } finally {
      setDemoLoadingA(false)
    }
  }

  async function loadDemoB(subscriberId: string) {
    setDemoPlanSubscriber(subscriberId)
    setDemoLoadingB(true)
    try {
      const result = await fetchNormalizationDemo('provider_a', subscriberId)
      setDemoResponseB(result)
    } catch (err) {
      console.error(err)
    } finally {
      setDemoLoadingB(false)
    }
  }

  async function processFile(file: File) {
    setError(null)
    setStage('processing')
    setVerificationResult(null)

    try {
      const result = await uploadInsuranceDocument(file)
      setExtraction(result)
      setFieldValues(
        Object.fromEntries(
          Object.entries(result.fields).map(([key, field]) => [key, field.value ?? '']),
        ),
      )
      setStage('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The document could not be processed.')
      setStage('upload')
    }
  }

  function handleConfirm() {
    setStage('confirmed')
  }

  async function handleVerify() {
    setStage('verifying')
    setError(null)
    try {
      const result = await verifyInsurance({
        patient: {
          first_name: fieldValues.first_name || '',
          last_name: fieldValues.last_name || '',
          date_of_birth: fieldValues.date_of_birth || '1970-01-01',
        },
        policy: {
          payer_name: fieldValues.payer_name || '',
          member_id: fieldValues.member_id || '',
          group_number: fieldValues.group_number || undefined,
          policy_number: fieldValues.policy_number || undefined,
          subscriber_name: fieldValues.subscriber_name || undefined,
          relationship_to_subscriber: fieldValues.relationship_to_subscriber || undefined,
        },
      })
      setVerificationResult(result)
      setStage('verified')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.')
      setStage('confirmed')
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void processFile(file)
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file) void processFile(file)
  }

  function updateField(key: string, value: string) {
    setFieldValues((current) => ({ ...current, [key]: value }))
  }

  function resetUpload() {
    setExtraction(null)
    setFieldValues({})
    setVerificationResult(null)
    setError(null)
    setStage('upload')
  }

  const stageIndex = stage === 'upload' ? 0 : stage === 'processing' ? 1 : 2

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">
              New verification
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
              Upload an insurance card
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Extract the member details in seconds, then review every value before it reaches the patient record.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className={`h-2 w-2 rounded-full ${healthStatus === 'online' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            {healthStatus === 'online' ? 'Extraction service online' : 'Connecting to extraction service'}
          </div>
        </div>

        <div className="grid grid-cols-3 border-y border-slate-200 py-4 sm:max-w-2xl">
          {['Upload card', 'Extract details', 'Confirm information'].map((label, index) => (
            <div key={label} className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full ${index <= stageIndex ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                {index < stageIndex ? '✓' : index + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </div>
          ))}
        </div>

        {stage === 'upload' && (
          <div className="max-w-3xl space-y-4">
            <div
              className="cursor-pointer rounded-2xl border-2 border-dashed border-primary-200 bg-white px-6 py-16 text-center shadow-sm transition hover:border-primary-500 hover:bg-primary-50/40"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click()
              }}
            >
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-2xl text-primary-700">↑</div>
              <h3 className="text-lg font-semibold text-slate-900">Drop an insurance card here</h3>
              <p className="mt-2 text-sm text-slate-500">or choose a PDF, PNG, JPG, or JPEG from your computer</p>
              <button type="button" className="mt-6 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700">
                Choose file
              </button>
              <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFileChange} />
            </div>
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <p className="text-xs text-slate-400">Files are processed temporarily and removed after extraction.</p>
          </div>
        )}

        {stage === 'processing' && (
          <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center shadow-sm">
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" />
            <h3 className="text-lg font-semibold text-slate-900">Reading your insurance card</h3>
            <p className="mt-2 text-sm text-slate-500">We’re extracting the details now. This usually takes a few seconds.</p>
          </div>
        )}

        {stage === 'verifying' && (
          <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center shadow-sm">
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" />
            <h3 className="text-lg font-semibold text-slate-900">Verifying insurance...</h3>
            <div className="mt-4 flex flex-col items-center gap-2 text-sm text-slate-500">
              <p>Identifying payer...</p>
              <p>Connecting to verification provider...</p>
              <p>Processing eligibility response...</p>
            </div>
          </div>
        )}

        {(stage === 'review' || stage === 'confirmed' || stage === 'verified') && extraction && (
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">Review extracted information</h3>
                    {stage === 'confirmed' && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Confirmed</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">Check the fields below and make any corrections before confirming.</p>
                </div>
                <span className="max-w-48 truncate rounded bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500">{extraction.file_name}</span>
              </div>
              <div className="grid gap-x-5 gap-y-5 pt-6 sm:grid-cols-2">
                {Object.entries(extraction.fields).map(([key, field]) => {
                  const isLowConfidence = field.confidence !== null && field.confidence < 0.8 && field.confidence >= 0.6
                  const isVeryLowConfidence = field.confidence !== null && field.confidence < 0.6
                  const needsReview = isLowConfidence || isVeryLowConfidence
                  return (
                    <label key={key} className="block">
                      <span className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {fieldLabels[key] ?? key.replaceAll('_', ' ')}
                        {field.confidence !== null && (
                          <span className={
                            isVeryLowConfidence ? 'text-red-600 font-bold' :
                            isLowConfidence ? 'text-amber-600 font-bold' : 
                            'text-emerald-600'
                          }>
                            {Math.round(field.confidence * 100)}%
                          </span>
                        )}
                      </span>
                      <input
                        type={key === 'date_of_birth' ? 'date' : 'text'}
                        value={fieldValues[key] ?? ''}
                        onChange={(event) => updateField(key, event.target.value)}
                        disabled={stage === 'verified'}
                        className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-300 focus:ring-2 focus:ring-primary-100 ${
                          needsReview && stage === 'review'
                            ? (isVeryLowConfidence ? 'border-red-300 bg-red-50 focus:border-red-500' : 'border-amber-300 bg-amber-50 focus:border-amber-500')
                            : 'border-slate-200 focus:border-primary-500'
                        }`}
                      />
                      {needsReview && stage === 'review' && (
                        <p className={`mt-1 text-xs font-semibold ${isVeryLowConfidence ? 'text-red-600' : 'text-amber-600'}`}>
                          {isVeryLowConfidence ? 'Needs confirmation' : 'Please review this field.'}
                        </p>
                      )}
                    </label>
                  )
                })}
              </div>
              
              {stage === 'review' && (
                <div className="mt-7 flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-5 sm:flex-row">
                  <button type="button" onClick={resetUpload} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Start over</button>
                  <button type="button" onClick={handleConfirm} className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">Confirm details</button>
                </div>
              )}

              {stage === 'confirmed' && (
                <div className="mt-7 flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-5 sm:flex-row">
                  <button type="button" onClick={() => setStage('review')} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Edit details</button>
                  <button type="button" onClick={handleVerify} className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">Verify Insurance</button>
                </div>
              )}

              {stage === 'verified' && verificationResult && (
                <div className="mt-8 border-t border-slate-100 pt-8">
                  {verificationResult.status === 'FAILED' ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </div>
                      <h3 className="text-lg font-semibold text-red-800">Verification Failed</h3>
                      <p className="mt-2 text-sm text-red-700">The provider did not return a successful verification response.</p>
                      {verificationResult.error_message && (
                        <p className="mt-2 text-sm font-semibold text-red-800">{verificationResult.error_message}</p>
                      )}
                      <button onClick={() => setStage('confirmed')} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition">Try again</button>
                    </div>
                  ) : (
                    <div className="space-y-12">
                      {/* 1. VERIFICATION SUMMARY */}
                      <section>
                        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                          <h3 className="text-lg font-semibold text-slate-900">Insurance Verification</h3>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Demo verification — Mock Provider</span>
                        </div>
                        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</p>
                            <div className="mt-2 flex items-center gap-2">
                              {verificationResult.status === 'VERIFIED' ? (
                                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-700">
                                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span> ACTIVE
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-sm font-semibold text-red-700">
                                  <span className="h-2 w-2 rounded-full bg-red-500"></span> INACTIVE
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2">
                            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                              <div><span className="block text-xs text-slate-500">Payer Name</span><span className="font-medium text-slate-900">{fieldValues.payer_name || 'Unknown'}</span></div>
                              <div><span className="block text-xs text-slate-500">Member ID</span><span className="font-medium text-slate-900">{fieldValues.member_id || 'Unknown'}</span></div>
                              <div><span className="block text-xs text-slate-500">Subscriber</span><span className="font-medium text-slate-900">{fieldValues.subscriber_name || 'Unknown'}</span></div>
                              <div><span className="block text-xs text-slate-500">Relationship</span><span className="font-medium text-slate-900">{fieldValues.relationship_to_subscriber || 'Self'}</span></div>
                            </div>
                            <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
                              Verified via Mock Verification Provider
                            </div>
                          </div>
                        </div>
                      </section>

                      {verificationResult.benefits && (
                        <>
                          {/* 2. FINANCIAL SUMMARY */}
                          <section>
                            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-900">Financial Summary</h4>
                            <div className="grid gap-4 sm:grid-cols-3">
                              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <p className="text-xs font-medium text-slate-500">Individual Deductible</p>
                                <p className="mt-1 text-2xl font-bold text-slate-900">${verificationResult.benefits.deductible ?? '—'}</p>
                                <p className="mt-1 text-sm text-emerald-600 font-medium">${verificationResult.benefits.deductible_remaining ?? '—'} remaining</p>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                <p className="text-xs font-medium text-slate-500">Annual Maximum</p>
                                <p className="mt-1 text-2xl font-bold text-slate-900">${verificationResult.benefits.annual_maximum ?? '—'}</p>
                                <p className="mt-1 text-sm text-emerald-600 font-medium">${verificationResult.benefits.annual_maximum_remaining ?? '—'} remaining</p>
                              </div>
                              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm flex flex-col justify-center">
                                <p className="text-xs font-medium text-emerald-800 uppercase tracking-wider">Overall Status</p>
                                <p className="mt-1 text-lg font-bold text-emerald-700">Coverage is active and verifiable.</p>
                              </div>
                            </div>
                          </section>

                          {/* 3. DENTAL COVERAGE */}
                          <section>
                            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-900">Dental Coverage</h4>
                            <div className="grid gap-4 sm:grid-cols-3">
                              <div className="rounded-xl border-l-4 border-l-sky-500 bg-white p-4 shadow-sm border-y border-r border-slate-200">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Preventive</p>
                                <p className="mt-2 text-2xl font-bold text-slate-900">{verificationResult.benefits.preventive_coverage ?? 0}%</p>
                              </div>
                              <div className="rounded-xl border-l-4 border-l-indigo-500 bg-white p-4 shadow-sm border-y border-r border-slate-200">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Basic</p>
                                <p className="mt-2 text-2xl font-bold text-slate-900">{verificationResult.benefits.basic_coverage ?? 0}%</p>
                              </div>
                              <div className="rounded-xl border-l-4 border-l-amber-500 bg-white p-4 shadow-sm border-y border-r border-slate-200">
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Major</p>
                                <p className="mt-2 text-2xl font-bold text-slate-900">{verificationResult.benefits.major_coverage ?? 0}%</p>
                              </div>
                            </div>
                          </section>
                          
                          {/* 5. AT A GLANCE */}
                          <section>
                            <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-900">At a Glance</h4>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm space-y-2">
                              <p className="text-sm text-slate-700">• Preventive care is covered at <strong className="font-semibold text-slate-900">{verificationResult.benefits.preventive_coverage}%</strong>.</p>
                              <p className="text-sm text-slate-700">• Basic procedures are covered at <strong className="font-semibold text-slate-900">{verificationResult.benefits.basic_coverage}%</strong>.</p>
                              <p className="text-sm text-slate-700">• Major procedures are covered at <strong className="font-semibold text-slate-900">{verificationResult.benefits.major_coverage}%</strong>.</p>
                              <p className="text-sm text-slate-700">• <strong className="font-semibold text-slate-900">${verificationResult.benefits.deductible_remaining}</strong> of the ${verificationResult.benefits.deductible} deductible remains.</p>
                              <p className="text-sm text-slate-700">• <strong className="font-semibold text-slate-900">${verificationResult.benefits.annual_maximum_remaining}</strong> of the ${verificationResult.benefits.annual_maximum} annual maximum remains.</p>
                            </div>
                          </section>
                        </>
                      )}

                      {/* 4. TREATMENT BENEFITS TABLE */}
                      {verificationResult.treatment_benefits && verificationResult.treatment_benefits.length > 0 && (
                        <section>
                          <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-900">Treatment Benefits</h4>
                          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                            <table className="w-full text-left text-sm text-slate-600">
                              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                                <tr>
                                  <th className="px-5 py-4 font-semibold">Treatment</th>
                                  <th className="px-5 py-4 font-semibold">Coverage</th>
                                  <th className="px-5 py-4 font-semibold">Deductible Applies</th>
                                  <th className="px-5 py-4 font-semibold">Limitations</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 bg-white">
                                {verificationResult.treatment_benefits.map((tb) => (
                                  <tr key={tb.treatment}>
                                    <td className="px-5 py-4 font-medium text-slate-900">{tb.treatment}</td>
                                    <td className="px-5 py-4">
                                      {tb.covered ? (tb.coverage_percentage !== null ? `${tb.coverage_percentage}%` : 'Covered') : 'Not Covered'}
                                    </td>
                                    <td className="px-5 py-4 text-slate-500">
                                      {tb.treatment.toLowerCase().includes('clean') || tb.treatment.toLowerCase().includes('x-ray') ? 'No' : 'Yes'}
                                    </td>
                                    <td className="px-5 py-4 text-slate-500">
                                      {[tb.frequency, tb.waiting_period].filter(Boolean).join('; ') || '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )}

                      {/* 6. LIMITATIONS / IMPORTANT NOTES */}
                      <section>
                        <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-900">Limitations & Important Notes</h4>
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                          {verificationResult.treatment_benefits && verificationResult.treatment_benefits.some(tb => tb.frequency || tb.waiting_period) ? (
                            <ul className="space-y-3">
                              {verificationResult.treatment_benefits
                                .filter(tb => tb.frequency || tb.waiting_period)
                                .map(tb => (
                                  <li key={tb.treatment} className="text-sm text-slate-700">
                                    <strong className="font-semibold text-slate-900">{tb.treatment}:</strong> {[tb.frequency, tb.waiting_period].filter(Boolean).join(', ')}
                                  </li>
                                ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-slate-500">No limitations reported.</p>
                          )}
                        </div>
                      </section>
                      
                      <div className="mt-8 pt-6 border-t border-slate-200 text-center">
                         <button type="button" onClick={resetUpload} className="rounded-lg bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition">Start a new verification</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
            <aside className="h-fit rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Extraction summary</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">{Object.values(fieldValues).filter(Boolean).length}<span className="text-base font-normal text-slate-400"> / {Object.keys(extraction.fields).length}</span></p>
              <p className="mt-1 text-sm text-slate-500">fields ready to verify</p>
              <div className="mt-5 border-t border-slate-200 pt-4 text-xs text-slate-500"><div className="flex justify-between gap-4"><span>Extraction provider</span><span className="text-right font-medium text-slate-700">{extraction.provider === 'tesseract-ocr' ? 'Tesseract OCR' : extraction.provider}</span></div><div className="mt-3 flex justify-between"><span>File type</span><span className="font-medium uppercase text-slate-700">{extraction.file_type}</span></div></div>
              <details className="mt-5 border-t border-slate-200 pt-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">Raw OCR text</summary>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs leading-5 text-slate-600">{extraction.raw_text || 'No text returned by OCR.'}</pre>
              </details>
            </aside>
          </div>
        )}

        {/* Normalization Demo Section */}
        {false && (
        <div className="mt-16 border-t border-slate-200 pt-16">
          <details className="group">
            <summary className="cursor-pointer list-none">
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700 flex items-center gap-2">
                    <span className="inline-block transition-transform group-open:rotate-90">▶</span>
                    Developer Demo
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Architecture: Provider Normalization vs. Plan Data</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Provider mappings describe the external API structure. Plan and employer differences are represented as insurance data, not separate integrations.
                  </p>
                </div>
              </div>
            </summary>

            <div className="space-y-16 mt-6">
            {/* SECTION A */}
            <section>
              <h3 className="text-lg font-semibold text-slate-900 mb-4">SECTION A: Provider Schema Normalization</h3>
              <p className="text-sm text-slate-500 mb-6">
                See how different APIs—or versions of the same API—map to a canonical model.
              </p>
              
              <div className="mb-6 flex flex-wrap gap-2">
                {[
                  { id: 'provider_b', label: 'Provider B' },
                  { id: 'provider_c_v1', label: 'Provider C v1' },
                  { id: 'provider_c_v2', label: 'Provider C v2' },
                  { id: 'provider_d', label: 'Provider D' }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => loadDemoA(p.id)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      demoProviderA === p.id 
                        ? 'bg-primary-600 text-white shadow-sm' 
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-2">
                {demoLoadingA && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/50 backdrop-blur-sm">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" />
                  </div>
                )}
                
                {demoResponseA && (
                  <>
                    {/* Raw Response A */}
                    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                        <h3 className="text-sm font-semibold text-slate-900">Synthetic External Schema (Raw)</h3>
                      </div>
                      <div className="flex-1 overflow-auto bg-slate-900 p-5 text-emerald-400">
                        <pre className="text-xs font-mono">
                          {JSON.stringify(demoResponseA?.raw_response, null, 2)}
                        </pre>
                      </div>
                    </div>

                    {/* Normalized Response A */}
                    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                        <h3 className="text-sm font-semibold text-slate-900">Canonical VerifyDent Schema</h3>
                      </div>
                      <div className="border-b border-slate-100 bg-white p-5">
                        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Explicit Mapping Trace</h4>
                        <ul className="space-y-2">
                          {demoResponseA?.mapping_trace.map((trace, i) => (
                            <li key={i} className="flex items-center text-xs">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">{trace.source}</span>
                              <span className="mx-2 text-slate-300">→</span>
                              <span className="rounded bg-primary-50 px-1.5 py-0.5 font-mono text-primary-700">{trace.target}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="flex-1 overflow-auto bg-slate-900 p-5 text-sky-400">
                        <pre className="text-xs font-mono">
                          {JSON.stringify(demoResponseA?.normalized, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* SECTION B */}
            <section className="border-t border-slate-200 pt-16">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">SECTION B: Plan / Group Variation</h3>
              <p className="text-sm text-slate-500 mb-6 max-w-3xl">
                Notice how the <strong>exact same adapter</strong> mapping the <strong>exact same provider</strong> can yield entirely different member benefits, simply by loading different plan data.
              </p>
              
              <div className="mb-6 flex flex-wrap gap-2">
                {[
                  { id: 'BASIC', label: 'Group 10001 / PPO Basic' },
                  { id: 'PREMIUM', label: 'Group 20002 / PPO Premium' }
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => loadDemoB(p.id)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      demoPlanSubscriber === p.id 
                        ? 'bg-primary-600 text-white shadow-sm' 
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="relative grid grid-cols-1 gap-6 lg:grid-cols-2">
                {demoLoadingB && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/50 backdrop-blur-sm">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" />
                  </div>
                )}
                
                {demoResponseB && (
                  <>
                    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                        <h3 className="text-sm font-semibold text-slate-900">Provider A API Payload</h3>
                      </div>
                      <div className="flex-1 overflow-auto bg-slate-900 p-5 text-emerald-400">
                        <pre className="text-xs font-mono">
                          {JSON.stringify(demoResponseB?.raw_response, null, 2)}
                        </pre>
                      </div>
                    </div>

                    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 flex justify-between items-center">
                        <h3 className="text-sm font-semibold text-slate-900">Canonical VerifyDent Schema</h3>
                        <span className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-semibold text-primary-700">Same Adapter</span>
                      </div>
                      <div className="flex-1 overflow-auto bg-slate-900 p-5 text-sky-400">
                        <pre className="text-xs font-mono">
                          {JSON.stringify(demoResponseB?.normalized, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
          </details>
        </div>
        )}
      </div>
    </Layout>
  )
}

export default App
