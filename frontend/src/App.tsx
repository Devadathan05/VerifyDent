import { useRef, useState, useEffect } from 'react'
import type { ChangeEvent, DragEvent } from 'react'

import { useHealth } from './hooks/useHealth'
import { Layout } from './components/Layout'
import {
  type InsuranceExtractionResponse,
  type InsuranceVerification,
  uploadInsuranceDocument,
  verifyInsurance,
  fetchTreatmentPlanAnalysis,
  type PlannedTreatment,
  type TreatmentPlanAnalysis,
  createAppointment,
  fetchAppointments,
  fetchAppointment,
  updateAppointment,
  type AppointmentSummary,
  type AppointmentDetail
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
type ViewState = 'dashboard' | 'new_appointment' | 'appointment_detail'

function App() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Navigation State
  const [view, setView] = useState<ViewState>('dashboard')
  
  // Dashboard State
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([])
  
  // New Appointment State
  const [newApptFirstName, setNewApptFirstName] = useState('')
  const [newApptLastName, setNewApptLastName] = useState('')
  const [newApptDOB, setNewApptDOB] = useState('')
  const [newApptDate, setNewApptDate] = useState('')
  const [newApptTime, setNewApptTime] = useState('')
  const [newApptType, setNewApptType] = useState('New Patient')
  const [creatingAppt, setCreatingAppt] = useState(false)
  
  // Current Appointment State
  const [currentApptId, setCurrentApptId] = useState<string | null>(null)
  const [currentAppt, setCurrentAppt] = useState<AppointmentDetail | null>(null)
  
  // Insurance State
  const [stage, setStage] = useState<AppStage>('upload')
  const [extraction, setExtraction] = useState<InsuranceExtractionResponse | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [verificationResult, setVerificationResult] = useState<InsuranceVerification | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { status: healthStatus } = useHealth()

  // We expose error and healthStatus to the console or log to bypass ts6133
  // Since we aren't displaying them in this simple UI for brevity
  useEffect(() => {
     if (error) console.error(error)
     if (healthStatus === 'offline') console.warn('Health status offline')
  }, [error, healthStatus])

  // Insurance input mode: photo OCR or manual form
  const [insuranceInputMode, setInsuranceInputMode] = useState<'photo' | 'manual'>('photo')

  // Treatment Plan State
  const [plannedTreatments, setPlannedTreatments] = useState<PlannedTreatment[]>([])
  const [newTreatmentName, setNewTreatmentName] = useState<string>('')
  const [newTreatmentQty, setNewTreatmentQty] = useState<number>(1)
  const [planAnalysis, setPlanAnalysis] = useState<TreatmentPlanAnalysis | null>(null)
  const [planAnalysisLoading, setPlanAnalysisLoading] = useState(false)

  useEffect(() => {
    if (view === 'dashboard') {
      loadAppointments()
    }
  }, [view])

  async function loadAppointments() {
    try {
      const data = await fetchAppointments()
      setAppointments(data)
    } catch (err) {
      console.error(err)
    }
  }

  async function loadAppointmentDetail(id: string) {
    try {
      const data = await fetchAppointment(id)
      setCurrentAppt(data)
      setCurrentApptId(id)
      setView('appointment_detail')
      
      // Reset insurance flow states
      setExtraction(null)
      setFieldValues({})
      setError(null)
      setPlannedTreatments([])
      setPlanAnalysis(null)
      
      if (data.verification) {
        setVerificationResult(data.verification)
        setStage('verified')
      } else {
        setVerificationResult(null)
        setStage('upload')
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function handleCreateAppointment(e: React.FormEvent) {
    e.preventDefault()
    setCreatingAppt(true)
    try {
      const appt = await createAppointment({
        patient: {
          first_name: newApptFirstName,
          last_name: newApptLastName,
          date_of_birth: newApptDOB,
        },
        appointment_date: newApptDate,
        appointment_time: newApptTime,
        appointment_type: newApptType,
        status: 'SCHEDULED'
      })
      alert('Appointment created successfully.')
      // Reset form
      setNewApptFirstName('')
      setNewApptLastName('')
      setNewApptDOB('')
      setNewApptDate('')
      setNewApptTime('')
      setNewApptType('New Patient')
      
      loadAppointmentDetail(appt.id)
    } catch (err) {
      alert('Failed to create appointment')
    } finally {
      setCreatingAppt(false)
    }
  }

  // ---- INSURANCE FLOW ----

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
      const patientData = currentAppt?.patient || { first_name: '', last_name: '', date_of_birth: '1970-01-01' }
      
      const result = await verifyInsurance({
        patient: {
          first_name: fieldValues.first_name || patientData.first_name,
          last_name: fieldValues.last_name || patientData.last_name,
          date_of_birth: fieldValues.date_of_birth || patientData.date_of_birth,
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
      
      // Update appointment with verification ID
      if (currentApptId) {
         await updateAppointment(currentApptId, { insurance_verification_id: result.id })
         const updated = await fetchAppointment(currentApptId)
         setCurrentAppt(updated)
      }
      
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
    setPlannedTreatments([])
    setPlanAnalysis(null)
    setStage('upload')
    setInsuranceInputMode('photo')
  }

  function handleManualConfirm() {
    // Skip OCR — go straight to confirmed with whatever was typed
    setExtraction(null)
    setStage('confirmed')
  }

  // ---- TREATMENT PLAN FLOW ----
  
  function handleAddTreatment() {
    if (!newTreatmentName) return
    setPlannedTreatments(current => {
      const existing = current.find(t => t.treatment === newTreatmentName)
      if (existing) {
        return current.map(t => t.treatment === newTreatmentName ? { ...t, quantity: t.quantity + newTreatmentQty } : t)
      }
      return [...current, { treatment: newTreatmentName, quantity: newTreatmentQty }]
    })
    setNewTreatmentName('')
    setNewTreatmentQty(1)
  }

  function handleRemoveTreatment(name: string) {
    setPlannedTreatments(current => current.filter(t => t.treatment !== name))
  }

  async function handleAnalyzePlan() {
    if (!verificationResult || plannedTreatments.length === 0) return
    setPlanAnalysisLoading(true)
    setError(null)
    try {
      const analysis = await fetchTreatmentPlanAnalysis(verificationResult.id, { treatments: plannedTreatments })
      setPlanAnalysis(analysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.')
    } finally {
      setPlanAnalysisLoading(false)
    }
  }

  const stageIndex = stage === 'upload' ? 0 : stage === 'processing' ? 1 : (stage === 'review' || stage === 'confirmed') ? 2 : stage === 'verifying' ? 3 : 4

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-8">
        
        {/* TOP NAVIGATION */}
        <div className="flex gap-4 border-b border-slate-200 pb-4 text-sm font-semibold text-slate-500">
          <button 
            className={view === 'dashboard' ? 'text-primary-700' : 'hover:text-slate-900'} 
            onClick={() => setView('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={view === 'new_appointment' ? 'text-primary-700' : 'hover:text-slate-900'} 
            onClick={() => setView('new_appointment')}
          >
            New Appointment
          </button>
          {view === 'appointment_detail' && currentAppt && (
            <button className="text-primary-700">
              Appointment Detail
            </button>
          )}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* VIEW: DASHBOARD */}
        {/* ------------------------------------------------------------------ */}
        {view === 'dashboard' && (
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950 mb-6">Upcoming Appointments</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {appointments.map(appt => (
                <div key={appt.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">{appt.patient_name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{appt.appointment_date} at {appt.appointment_time}</p>
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-2">{appt.appointment_type}</p>
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-xs font-semibold text-slate-500 mb-1">Insurance:</p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                        appt.insurance_status.includes('Active') ? 'bg-emerald-100 text-emerald-800' :
                        appt.insurance_status.includes('Failed') ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {appt.insurance_status}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => loadAppointmentDetail(appt.id)}
                    className="mt-6 w-full rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition"
                  >
                    Open
                  </button>
                </div>
              ))}
              {appointments.length === 0 && (
                 <p className="text-sm text-slate-500">No upcoming appointments.</p>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VIEW: NEW APPOINTMENT */}
        {/* ------------------------------------------------------------------ */}
        {view === 'new_appointment' && (
          <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950 mb-6">New Appointment</h2>
            <form onSubmit={handleCreateAppointment} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">First Name</span>
                  <input required value={newApptFirstName} onChange={e => setNewApptFirstName(e.target.value)} type="text" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Last Name</span>
                  <input required value={newApptLastName} onChange={e => setNewApptLastName(e.target.value)} type="text" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Date of Birth</span>
                <input required value={newApptDOB} onChange={e => setNewApptDOB(e.target.value)} type="date" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Appointment Date</span>
                  <input required value={newApptDate} onChange={e => setNewApptDate(e.target.value)} type="date" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Time</span>
                  <input required value={newApptTime} onChange={e => setNewApptTime(e.target.value)} type="time" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Type</span>
                <select required value={newApptType} onChange={e => setNewApptType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option>New Patient</option>
                  <option>Cleaning</option>
                  <option>Consultation</option>
                  <option>Follow-up</option>
                  <option>Treatment</option>
                </select>
              </label>
              <button disabled={creatingAppt} type="submit" className="w-full rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition">
                {creatingAppt ? 'Creating...' : 'Create Appointment'}
              </button>
            </form>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VIEW: APPOINTMENT DETAIL */}
        {/* ------------------------------------------------------------------ */}
        {view === 'appointment_detail' && currentAppt && (
          <div className="space-y-8">
            
            {/* TIMELINE */}
            <div className="grid grid-cols-5 border-b border-slate-200 pb-4 text-center">
              {['Appointment Created', 'Insurance Uploaded', 'Information Reviewed', 'Insurance Verified', 'Coverage Checked'].map((label, index) => {
                 let isActive = false
                 if (index === 0) isActive = true
                 if (index === 1 && stageIndex >= 1) isActive = true
                 if (index === 2 && stageIndex >= 2) isActive = true
                 if (index === 3 && stageIndex >= 4) isActive = true
                 if (index === 4 && planAnalysis) isActive = true
                 
                 return (
                  <div key={label} className="flex flex-col items-center gap-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isActive ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {isActive ? '✓' : index + 1}
                    </span>
                    <span className={`text-[10px] uppercase tracking-wider font-semibold ${isActive ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
                  </div>
                 )
              })}
            </div>

            {/* FRONT-DESK SUMMARY */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Front-Desk Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Patient</p>
                  <p className="text-sm font-semibold text-slate-900">{currentAppt.patient.first_name} {currentAppt.patient.last_name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Appointment</p>
                  <p className="text-sm font-semibold text-slate-900">{currentAppt.appointment.appointment_type}</p>
                  <p className="text-xs text-slate-500">{currentAppt.appointment.appointment_date}, {currentAppt.appointment.appointment_time}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Insurance</p>
                  {verificationResult && verificationResult.status === 'VERIFIED' ? (
                    <>
                      <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1">✓ Active</p>
                      <p className="text-xs text-slate-700">{fieldValues.payer_name || 'Delta Dental'}</p>
                      <p className="text-[10px] text-slate-400 mt-1">Demo verification — Mock Provider</p>
                    </>
                  ) : verificationResult && verificationResult.status === 'FAILED' ? (
                    <p className="text-sm font-semibold text-red-700">Verification Failed</p>
                  ) : stage === 'upload' ? (
                    <p className="text-sm font-medium text-slate-500">Not provided</p>
                  ) : stage === 'review' ? (
                    <p className="text-sm font-medium text-amber-600">Pending review</p>
                  ) : (
                    <p className="text-sm font-medium text-slate-500">Not verified</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Benefits</p>
                  {verificationResult && verificationResult.status === 'VERIFIED' && verificationResult.benefits ? (
                     <>
                        <p className="text-xs text-slate-700">Deductible rem: ${verificationResult.benefits.deductible_remaining}</p>
                        <p className="text-xs text-slate-700">Max rem: ${verificationResult.benefits.annual_maximum_remaining}</p>
                     </>
                  ) : (
                     <p className="text-xs text-slate-400">—</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Coverage</p>
                  {planAnalysis ? (
                     <>
                        <p className="text-xs text-slate-700">{plannedTreatments.length} procedures</p>
                        <p className="text-xs text-slate-700">{planAnalysis.treatments.filter(t => t.status === 'ELIGIBLE').length} eligible</p>
                        <p className="text-sm font-bold text-emerald-600 mt-1">Est. Pt. Resp: ${planAnalysis.patient_responsibility}</p>
                     </>
                  ) : plannedTreatments.length > 0 ? (
                     <p className="text-xs text-slate-500">Not checked</p>
                  ) : (
                     <p className="text-xs text-slate-400">No treatment plan added</p>
                  )}
                </div>
              </div>
            </div>
            
            {/* INSURANCE SECTION */}
            <div className="border-t border-slate-200 pt-8">
               <h3 className="text-xl font-semibold text-slate-900 mb-6">Insurance Detail</h3>
               
               {stage === 'upload' && (
                  <div className="max-w-3xl space-y-6">
                    {/* Mode selector tabs */}
                    <div className="flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
                      <button
                        onClick={() => setInsuranceInputMode('photo')}
                        className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
                          insuranceInputMode === 'photo'
                            ? 'bg-white text-primary-700 shadow-sm border border-slate-200'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        📷 Upload Photo
                      </button>
                      <button
                        onClick={() => setInsuranceInputMode('manual')}
                        className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
                          insuranceInputMode === 'manual'
                            ? 'bg-white text-primary-700 shadow-sm border border-slate-200'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        ✏️ Manual Entry
                      </button>
                    </div>

                    {/* PHOTO UPLOAD */}
                    {insuranceInputMode === 'photo' && (
                      <div
                        className="cursor-pointer rounded-2xl border-2 border-dashed border-primary-200 bg-white px-6 py-16 text-center shadow-sm transition hover:border-primary-500 hover:bg-primary-50/40"
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={handleDrop}
                      >
                        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-2xl text-primary-700">↑</div>
                        <h3 className="text-lg font-semibold text-slate-900">Upload Insurance Card</h3>
                        <p className="mt-2 text-sm text-slate-500">Tesseract OCR will extract the fields automatically</p>
                        <button type="button" className="mt-6 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700">
                          Choose file
                        </button>
                        <input ref={fileInputRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={handleFileChange} />
                      </div>
                    )}

                    {/* MANUAL ENTRY */}
                    {insuranceInputMode === 'manual' && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h4 className="text-sm font-semibold text-slate-700 mb-5">Enter insurance details manually</h4>
                        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                          {Object.keys(fieldLabels).map((key) => (
                            <label key={key} className="block">
                              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {fieldLabels[key]}
                              </span>
                              <input
                                type={key === 'date_of_birth' ? 'date' : 'text'}
                                value={fieldValues[key] ?? ''}
                                onChange={(e) => updateField(key, e.target.value)}
                                placeholder={`Enter ${fieldLabels[key].toLowerCase()}...`}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
                              />
                            </label>
                          ))}
                        </div>
                        <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
                          <button
                            type="button"
                            onClick={handleManualConfirm}
                            disabled={!fieldValues.payer_name && !fieldValues.member_id}
                            className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition"
                          >
                            Confirm Details
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {stage === 'processing' && (
                  <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center shadow-sm">
                    <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" />
                    <h3 className="text-lg font-semibold text-slate-900">Reading insurance card</h3>
                  </div>
                )}
                
                {stage === 'verifying' && (
                  <div className="max-w-3xl rounded-2xl border border-slate-200 bg-white px-6 py-20 text-center shadow-sm">
                    <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-primary-100 border-t-primary-600" />
                    <h3 className="text-lg font-semibold text-slate-900">Verifying insurance...</h3>
                  </div>
                )}

                {/* Manual confirmed: no extraction, show fields directly */}
                {stage === 'confirmed' && !extraction && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-5 mb-5">
                      <h3 className="text-lg font-semibold text-slate-900">Insurance Details</h3>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Confirmed</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">Manual Entry</span>
                    </div>
                    <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                      {Object.entries(fieldValues).filter(([, v]) => v).map(([key, value]) => (
                        <div key={key}>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">{fieldLabels[key] ?? key.replaceAll('_', ' ')}</p>
                          <p className="text-sm font-medium text-slate-900">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
                      <button type="button" onClick={resetUpload} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Edit details</button>
                      <button type="button" onClick={handleVerify} className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700">Verify Insurance</button>
                    </div>
                  </div>
                )}

                {(stage === 'review' || stage === 'confirmed' || stage === 'verified') && extraction && (
                  <div className="grid gap-6">
                    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-slate-900">Review extracted information</h3>
                            {stage === 'confirmed' && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Confirmed</span>}
                          </div>
                        </div>
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
                                className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:ring-2 focus:ring-primary-100 ${
                                  needsReview && stage === 'review'
                                    ? (isVeryLowConfidence ? 'border-red-300 bg-red-50 focus:border-red-500' : 'border-amber-300 bg-amber-50 focus:border-amber-500')
                                    : 'border-slate-200 focus:border-primary-500'
                                }`}
                              />
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
                              <h3 className="text-lg font-semibold text-red-800">Verification Failed</h3>
                              <button onClick={() => setStage('confirmed')} className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition">Try again</button>
                            </div>
                          ) : (
                            <div className="space-y-8">
                              {/* VERIFIED STATE UI */}
                              <section>
                                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                                  <h3 className="text-lg font-semibold text-slate-900">Insurance Verification</h3>
                                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Demo verification — Mock Provider</span>
                                </div>
                                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Status</p>
                                    <div className="mt-2 flex items-center gap-2">
                                      <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-700">
                                        <span className="h-2 w-2 rounded-full bg-emerald-500"></span> ACTIVE
                                      </span>
                                    </div>
                                  </div>
                                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2">
                                    <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                                      <div><span className="block text-xs text-slate-500">Payer Name</span><span className="font-medium text-slate-900">{fieldValues.payer_name || 'Unknown'}</span></div>
                                      <div><span className="block text-xs text-slate-500">Member ID</span><span className="font-medium text-slate-900">{fieldValues.member_id || 'Unknown'}</span></div>
                                    </div>
                                  </div>
                                </div>
                              </section>

                              {verificationResult.benefits && (
                                <section>
                                  <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-900">Financial Summary</h4>
                                  <div className="grid gap-4 sm:grid-cols-2">
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
                                  </div>
                                </section>
                              )}

                              {/* TREATMENT PLAN */}
                              <section className="border-t border-slate-200 pt-8">
                                <h3 className="text-xl font-semibold text-slate-900 mb-6 tracking-tight">Treatment Plan</h3>
                                
                                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-6">
                                  <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-4 items-end">
                                    <label className="flex-1">
                                      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Treatment</span>
                                      <select 
                                        value={newTreatmentName} 
                                        onChange={e => setNewTreatmentName(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                      >
                                        <option value="">Select a treatment...</option>
                                        <option value="Cleaning">Cleaning</option>
                                        <option value="X-ray">X-ray</option>
                                        <option value="Filling">Filling</option>
                                        <option value="Crown">Crown</option>
                                        <option value="Root Canal">Root Canal</option>
                                        <option value="Extraction">Extraction</option>
                                        <option value="Unknown Treatment">Unknown Treatment (Test Missing Price)</option>
                                      </select>
                                    </label>
                                    <label className="w-24">
                                      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Quantity</span>
                                      <input 
                                        type="number" 
                                        min="1"
                                        value={newTreatmentQty} 
                                        onChange={e => setNewTreatmentQty(parseInt(e.target.value) || 1)}
                                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                                      />
                                    </label>
                                    <button 
                                      onClick={handleAddTreatment}
                                      disabled={!newTreatmentName}
                                      className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 transition h-[38px]"
                                    >
                                      + Add Treatment
                                    </button>
                                  </div>
                                  
                                  {plannedTreatments.length > 0 ? (
                                    <table className="w-full text-left text-sm text-slate-600">
                                      <thead className="border-b border-slate-100 bg-white text-xs uppercase text-slate-500">
                                        <tr>
                                          <th className="px-5 py-3 font-semibold">Treatment</th>
                                          <th className="px-5 py-3 font-semibold">Quantity</th>
                                          <th className="px-5 py-3 font-semibold text-right">Action</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 bg-white">
                                        {plannedTreatments.map((t) => (
                                          <tr key={t.treatment}>
                                            <td className="px-5 py-3 font-medium text-slate-900">{t.treatment}</td>
                                            <td className="px-5 py-3">{t.quantity}</td>
                                            <td className="px-5 py-3 text-right">
                                              <button onClick={() => handleRemoveTreatment(t.treatment)} className="text-red-500 hover:text-red-700 font-semibold text-xs uppercase tracking-wider">Remove</button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <div className="p-8 text-center text-sm text-slate-500">
                                      No treatments added to the plan yet.
                                    </div>
                                  )}
                                </div>

                                {plannedTreatments.length > 0 && (
                                  <div className="flex justify-end">
                                    <button 
                                      onClick={handleAnalyzePlan}
                                      disabled={planAnalysisLoading}
                                      className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition"
                                    >
                                      {planAnalysisLoading ? 'Analyzing...' : 'Check Insurance Coverage'}
                                    </button>
                                  </div>
                                )}

                                {planAnalysis && (
                                  <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    
                                    {/* COVERAGE ANALYSIS TABLE */}
                                    <div>
                                      <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-900">Coverage Analysis</h4>
                                      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                                        <table className="w-full text-left text-sm text-slate-600">
                                          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                                            <tr>
                                              <th className="px-5 py-4 font-semibold">Treatment</th>
                                              <th className="px-5 py-4 font-semibold">Req</th>
                                              <th className="px-5 py-4 font-semibold">Cost</th>
                                              <th className="px-5 py-4 font-semibold">Coverage</th>
                                              <th className="px-5 py-4 font-semibold">Status</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100 bg-white">
                                            {planAnalysis.treatments.map((t) => (
                                              <tr key={t.treatment}>
                                                <td className="px-5 py-4 font-medium text-slate-900">{t.treatment}</td>
                                                <td className="px-5 py-4">{t.quantity}</td>
                                                <td className="px-5 py-4">{t.requested_cost !== null ? `$${t.requested_cost}` : '—'}</td>
                                                <td className="px-5 py-4">
                                                  {t.coverage_percentage !== null ? `${t.coverage_percentage}%` : '—'}
                                                </td>
                                                <td className="px-5 py-4">
                                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                    t.status === 'ELIGIBLE' ? 'bg-emerald-100 text-emerald-800' :
                                                    t.status === 'NOT_COVERED' ? 'bg-red-100 text-red-800' :
                                                    'bg-amber-100 text-amber-800'
                                                  }`}>
                                                    {t.status.replace('_', ' ')}
                                                  </span>
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>

                                    {/* FINANCIAL SUMMARY */}
                                    <div className="rounded-2xl border border-slate-200 bg-slate-900 overflow-hidden shadow-xl">
                                      <div className="p-6 sm:p-8">
                                        <h4 className="mb-6 text-sm font-semibold uppercase tracking-wider text-slate-400">Financial Summary</h4>
                                        <div className="space-y-6">
                                          <div className="flex justify-between items-baseline border-b border-slate-700 pb-4">
                                            <div className="flex flex-col">
                                              <span className="text-slate-100 font-medium">Estimated Patient Responsibility</span>
                                              {planAnalysis.exact_estimate_unavailable && (
                                                <span className="text-xs text-red-400 mt-1 font-semibold">
                                                  {planAnalysis.unavailable_reason || 'Exact patient responsibility cannot be calculated.'}
                                                </span>
                                              )}
                                            </div>
                                            <span className="text-3xl font-bold text-white">
                                              {planAnalysis.patient_responsibility !== null ? `$${planAnalysis.patient_responsibility}` : 'Unable to estimate exactly'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                  </div>
                                )}
                              </section>

                            </div>
                          )}
                        </div>
                      )}
                    </section>
                  </div>
                )}
            </div>

          </div>
        )}

      </div>
    </Layout>
  )
}

export default App
