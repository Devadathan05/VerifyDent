import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

import { useHealth } from './hooks/useHealth'
import { Layout } from './components/Layout'
import {
  type InsuranceExtractionResponse,
  type InsuranceVerification,
  uploadInsuranceDocument,
  verifyInsurance
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

type AppStage = 'upload' | 'processing' | 'review' | 'verifying' | 'confirmed'

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<AppStage>('upload')
  const [extraction, setExtraction] = useState<InsuranceExtractionResponse | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [verificationResult, setVerificationResult] = useState<InsuranceVerification | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedTreatment, setSelectedTreatment] = useState<string>('')
  const { status: healthStatus } = useHealth()

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

  async function handleConfirm() {
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
      setStage('confirmed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.')
      setStage('review')
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
    setSelectedTreatment('')
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

        {(stage === 'review' || stage === 'confirmed') && extraction && (
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
                {Object.entries(extraction.fields).map(([key, field]) => (
                  <label key={key} className="block">
                    <span className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {fieldLabels[key] ?? key.replaceAll('_', ' ')}
                      {field.confidence !== null && <span className={field.confidence < 0.8 ? 'text-amber-600' : 'text-emerald-600'}>{Math.round(field.confidence * 100)}%</span>}
                    </span>
                    <input
                      type={key === 'date_of_birth' ? 'date' : 'text'}
                      value={fieldValues[key] ?? ''}
                      onChange={(event) => updateField(key, event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                    />
                  </label>
                ))}
              </div>
              {stage === 'review' && <div className="mt-7 flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-5 sm:flex-row"><button type="button" onClick={resetUpload} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Start over</button><button type="button" onClick={handleConfirm} className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">Confirm details</button></div>}
              {stage === 'confirmed' && verificationResult && (
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Insurance Status</p>
                  <div className="mt-4 flex items-center gap-3">
                    {verificationResult.status === 'VERIFIED' ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">✓ ACTIVE</span>
                    ) : verificationResult.status === 'NEEDS_REVIEW' ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">! NEEDS REVIEW</span>
                    ) : (
                      <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700">✗ FAILED</span>
                    )}
                    <span className="text-sm font-medium text-slate-700">{fieldValues.payer_name}</span>
                  </div>
                  
                  {verificationResult.benefits && (
                    <div className="mt-6 grid gap-6 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                        <p className="text-xs font-medium text-slate-500">Deductible</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">${verificationResult.benefits.deductible}</p>
                        <p className="mt-1 text-sm text-slate-500">${verificationResult.benefits.deductible_remaining} remaining</p>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                        <p className="text-xs font-medium text-slate-500">Annual Maximum</p>
                        <p className="mt-1 text-2xl font-semibold text-slate-900">${verificationResult.benefits.annual_maximum}</p>
                        <p className="mt-1 text-sm text-slate-500">${verificationResult.benefits.annual_maximum_remaining} remaining</p>
                      </div>
                      <div className="sm:col-span-2 rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                        <p className="mb-3 text-xs font-medium text-slate-500">Coverage</p>
                        <div className="flex justify-between border-b border-slate-200/60 pb-2 text-sm">
                          <span className="text-slate-600">Preventive</span><span className="font-semibold text-slate-900">{verificationResult.benefits.preventive_coverage}%</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-200/60 py-2 text-sm">
                          <span className="text-slate-600">Basic</span><span className="font-semibold text-slate-900">{verificationResult.benefits.basic_coverage}%</span>
                        </div>
                        <div className="flex justify-between pt-2 text-sm">
                          <span className="text-slate-600">Major</span><span className="font-semibold text-slate-900">{verificationResult.benefits.major_coverage}%</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Treatment Benefits Section */}
                  <div className="mt-8 border-t border-slate-100 pt-6">
                    <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Treatment Benefits</p>
                    
                    {verificationResult.status === 'NEEDS_REVIEW' || verificationResult.status === 'UNKNOWN' ? (
                      <div className="rounded-xl border border-amber-100 bg-amber-50 p-6 text-center">
                        <p className="font-semibold text-amber-800">Treatment benefits unavailable</p>
                        <p className="mt-1 text-sm text-amber-700">Payer must be confirmed before verification.</p>
                      </div>
                    ) : verificationResult.treatment_benefits && verificationResult.treatment_benefits.length > 0 ? (
                      <div className="space-y-6">
                        {/* Table View */}
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                          <table className="w-full text-left text-sm text-slate-600">
                            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                              <tr>
                                <th className="px-4 py-3 font-medium">Treatment</th>
                                <th className="px-4 py-3 font-medium">Covered</th>
                                <th className="px-4 py-3 font-medium">Coverage</th>
                                <th className="px-4 py-3 font-medium">Waiting Period</th>
                                <th className="px-4 py-3 font-medium">Frequency</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {verificationResult.treatment_benefits.map((tb) => (
                                <tr key={tb.treatment}>
                                  <td className="px-4 py-3 font-medium text-slate-900">{tb.treatment}</td>
                                  <td className="px-4 py-3">
                                    {tb.covered ? (
                                      <span className="text-emerald-600">✓ Covered</span>
                                    ) : (
                                      <span className="text-red-600">✗ Not Covered</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">{tb.coverage_percentage !== null ? `${tb.coverage_percentage}%` : '-'}</td>
                                  <td className="px-4 py-3">{tb.waiting_period || 'None'}</td>
                                  <td className="px-4 py-3 text-xs">{tb.frequency || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Dropdown Selector */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                          <label className="block text-sm font-medium text-slate-700">Check a treatment</label>
                          <select 
                            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 sm:w-64"
                            value={selectedTreatment}
                            onChange={(e) => setSelectedTreatment(e.target.value)}
                          >
                            <option value="" disabled>Select a treatment...</option>
                            {verificationResult.treatment_benefits.map((tb) => (
                              <option key={tb.treatment} value={tb.treatment}>{tb.treatment}</option>
                            ))}
                          </select>

                          {selectedTreatment && verificationResult.treatment_benefits.find(t => t.treatment === selectedTreatment) && (
                            <div className="mt-4 rounded-lg bg-white p-4 shadow-sm border border-slate-200">
                              {(() => {
                                const tb = verificationResult.treatment_benefits.find(t => t.treatment === selectedTreatment)!
                                return (
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                      <h4 className="font-semibold text-slate-900">{tb.treatment}</h4>
                                      {tb.covered ? (
                                        <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">✓ Covered</span>
                                      ) : (
                                        <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">✗ Not Covered</span>
                                      )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                      <div>
                                        <p className="text-slate-500">Estimated plan coverage</p>
                                        <p className="font-medium text-slate-900">{tb.coverage_percentage !== null ? `${tb.coverage_percentage}%` : 'N/A'}</p>
                                      </div>
                                      <div>
                                        <p className="text-slate-500">Waiting period</p>
                                        <p className="font-medium text-slate-900">{tb.waiting_period || 'None'}</p>
                                      </div>
                                      <div className="col-span-2">
                                        <p className="text-slate-500">Frequency</p>
                                        <p className="font-medium text-slate-900">{tb.frequency || 'N/A'}</p>
                                      </div>
                                      {verificationResult.benefits?.annual_maximum_remaining !== null && (
                                        <div className="col-span-2 border-t border-slate-100 pt-2">
                                          <p className="text-slate-500">Annual maximum remaining</p>
                                          <p className="font-medium text-slate-900">${verificationResult.benefits?.annual_maximum_remaining}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {verificationResult.error_message && (
                     <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800 border border-amber-200">
                       {verificationResult.error_message}
                     </div>
                  )}
                  
                  <p className="mt-6 text-center text-xs text-slate-400">Demo verification — Mock Provider</p>
                  
                  <div className="mt-6 text-center">
                     <button type="button" onClick={resetUpload} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition">Start a new verification</button>
                  </div>
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
      </div>
    </Layout>
  )
}

export default App
