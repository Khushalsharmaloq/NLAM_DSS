import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { formatDate, request, sendJson } from '../../services/api'

type Milestone = { id: number; title: string; target_date: string; completed_date: string | null;
  notes: string | null; recorded_by: string }
type Forecast = { risk_score: number; risk_level: string; parcel_count: number;
  possession_recorded: number; estimated_completion_date: string | null; note: string }

export default function TimelinePanel({ projectId }: { projectId: number }) {
  const { user } = useAuth()
  const [items, setItems] = useState<Milestone[]>([])
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const base = `/api/v1/projects/${projectId}`
  const load = useCallback(async () => {
    const [rows, risk] = await Promise.all([
      request<Milestone[]>(`${base}/milestones`),
      request<Forecast>(`/api/v1/mis/projects/${projectId}/forecast`),
    ])
    setItems(rows); setForecast(risk)
  }, [base, projectId])
  useEffect(() => { void load().catch((e: Error) => setError(e.message)) }, [load])
  const canEdit = user?.role !== 'CENTRAL_MINISTRY'

  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      await sendJson(`${base}/milestones`, { title, target_date: target, notes })
      setTitle(''); setTarget(''); setNotes(''); setMessage('Milestone added.'); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create milestone.') }
    finally { setBusy(false) }
  }
  async function complete(id: number) {
    setBusy(true); setError(''); setMessage('')
    try {
      await sendJson(`${base}/milestones/${id}`, { completed_date: new Date().toISOString().slice(0, 10) }, 'PATCH')
      setMessage('Milestone marked complete.'); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update milestone.') }
    finally { setBusy(false) }
  }
  return <section className="panel operations-panel">
    <div className="panel-heading"><div><h2>Timeline & decision support</h2>
      <p>Track target dates, recorded progress and an illustrative completion trend.</p></div></div>
    {error && <p role="alert" className="message message-error">{error}</p>}
    {message && <p role="status" className="message message-success">{message}</p>}
    {forecast && <div className="forecast-grid">
      <div><span>Possession recorded</span><strong>{forecast.possession_recorded} / {forecast.parcel_count}</strong></div>
      <div><span>Schedule risk</span><strong className={`risk-${forecast.risk_level}`}>{forecast.risk_level.toUpperCase()} · {forecast.risk_score}/100</strong></div>
      <div><span>Illustrative completion</span><strong>{forecast.estimated_completion_date ? formatDate(forecast.estimated_completion_date) : 'Insufficient history'}</strong></div>
    </div>}
    <p className="ops-hint">{forecast?.note ?? 'Forecast will appear when the project is available.'}</p>
    {canEdit && <form className="ops-form" onSubmit={(e) => void create(e)}>
      <h3>Plan a milestone</h3><div className="ops-fields">
        <label>Milestone title<input required minLength={2} maxLength={120} value={title}
          onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Survey verification complete" /></label>
        <label>Target date<input required type="date" value={target} onChange={(e) => setTarget(e.target.value)} /></label>
        <label>Notes (optional)<input maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      </div><button className="button button-primary" disabled={busy}>Add milestone</button></form>}
    <div className="ops-list">{items.length ? items.map((item) => {
      const overdue = !item.completed_date && item.target_date < new Date().toISOString().slice(0, 10)
      return <article className="ops-row" key={item.id}><div><strong>{item.title}</strong>
        <small>Target {formatDate(item.target_date)} · {item.recorded_by}</small>{item.notes && <small>{item.notes}</small>}</div>
        <div><span className={`status-badge ${overdue ? 'badge-overdue' : ''}`}>
          {item.completed_date ? `Completed ${formatDate(item.completed_date)}` : overdue ? 'Overdue' : 'Planned'}</span>
          {!item.completed_date && canEdit && <button type="button" className="table-action" disabled={busy}
            onClick={() => void complete(item.id)}>Mark complete</button>}</div></article>
    }) : <p className="table-message">No milestones yet. Add the first target date to begin monitoring.</p>}</div>
  </section>
}
