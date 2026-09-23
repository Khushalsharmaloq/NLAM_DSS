import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { request } from '../../services/api'
import { useAuth } from '../../auth/AuthContext'

type Status = { mode: string; message: string }
type Result = { source: string; verified: boolean; record: Record<string, string | number>;
  geometry: { type?: string } | null }

export default function LandLookupPanel({ projectId }: { projectId: number }) {
  const { user } = useAuth()
  const [status, setStatus] = useState<Status | null>(null)
  const [village, setVillage] = useState('')
  const [survey, setSurvey] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { void request<Status>('/api/v1/integrations/land-records/status')
    .then(setStatus).catch((e: Error) => setError(e.message)) }, [])
  async function lookup(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setResult(null)
    try {
      const params = new URLSearchParams({ village, survey_number: survey })
      setResult(await request<Result>(`/api/v1/integrations/projects/${projectId}/land-records/lookup?${params}`))
    } catch (err) { setError(err instanceof Error ? err.message : 'Lookup failed.') }
    finally { setBusy(false) }
  }
  return <section className="panel operations-panel"><div className="panel-heading"><div>
    <h2>Land record interoperability</h2><p>Read-only lookup using an authorized state connector, when configured.</p>
  </div><span className="status-badge">{status?.mode ?? 'Checking'}</span></div>
    {error && <p className="message message-error" role="alert">{error}</p>}
    <p className="ops-hint">{status?.message ?? 'Checking connector configuration…'} Map drawing and saved parcels remain available without it.</p>
    {status?.mode === 'configured' && <form className="ops-form" onSubmit={(e) => void lookup(e)}>
      <div className="ops-fields"><label>Village<input required minLength={2} maxLength={100}
        value={village} onChange={(e) => setVillage(e.target.value)} /></label>
        <label>Survey number<input required maxLength={100} value={survey}
          onChange={(e) => setSurvey(e.target.value)} /></label></div>
      <button className="button button-primary" disabled={busy}>{busy ? 'Checking…' : 'Look up record'}</button></form>}
    {result && <div className="ops-list"><h3>External response · requires field verification</h3>
      {Object.entries(result.record).map(([key, value]) =>
        <p key={key}><strong>{key.replaceAll('_', ' ')}:</strong> {String(value)}</p>)}
      <p>Geometry: {result.geometry?.type ?? 'No geometry supplied'}</p></div>}
    {result?.geometry?.type === 'Polygon' && user?.role === 'PROJECT_OFFICER' &&
      <div className="ops-hint"><button type="button" className="button button-secondary"
        onClick={() => { window.dispatchEvent(new CustomEvent('nlam:land-boundary', { detail: result }))
          document.getElementById('parcel-map')?.scrollIntoView({ behavior: 'smooth' }) }}>
        Preview external boundary on map</button>
        <p>Inspect the proposed boundary before registering a parcel. External records are not saved automatically.</p></div>}
  </section>
}
