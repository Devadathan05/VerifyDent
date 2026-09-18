import { useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

import { useHealth } from './hooks/useHealth'
import { Layout } from './components/Layout'
import {
  type InsuranceExtractionResponse,
  uploadInsuranceDocument,
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

type AppStage = 'upload' | 'processing' | 'review' | 'confirmed'

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<AppStage>('upload')
  const [extraction, setExtraction] = useState<InsuranceExtractionResponse | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const { status: healthStatus } = useHealth()

  async function processFile(file: File) {
    setError(null)
    setStage('processing')

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
              {stage === 'review' && <div className="mt-7 flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-5 sm:flex-row"><button type="button" onClick={resetUpload} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Start over</button><button type="button" onClick={() => setStage('confirmed')} className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700">Confirm details</button></div>}
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
