import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { request } from '../services/api'

type Alert = { id: string; project_id: number; level: 'overdue' | 'due' | 'action'; title: string; detail: string }

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  async function refresh(silent = false) {
    if (!silent) setLoading(true)
    setError('')
    try { setAlerts(await request<Alert[]>('/api/v1/alerts')) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load alerts.') }
    finally { if (!silent) setLoading(false) }
  }
  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(true), 30_000)
    return () => window.clearInterval(timer)
  }, [])
  return <><div className="page-heading"><div><div className="eyebrow">WORK QUEUE</div>
    <h1>Alerts & action items</h1><p>Pending reviews and due dates are derived from current project records.</p></div>
    <button className="button button-secondary" type="button" onClick={() => void refresh()}>Refresh</button></div>
    {error && <p role="alert" className="message message-error">{error}</p>}
    <section className="panel"><div className="panel-heading"><h2>{loading ? 'Checking alerts…' : `${alerts.length} open alerts`}</h2></div>
      <div className="ops-list">{alerts.map((item) => <article className="ops-row" key={item.id}>
        <div><span className={`alert-dot alert-${item.level}`} /><strong>{item.title}</strong><small>{item.detail}</small></div>
        <Link className="button button-secondary" to={`/projects/${item.project_id}`}>View project</Link></article>)}
        {!loading && alerts.length === 0 && <p className="table-message">All caught up. No pending reviews or overdue milestones.</p>}
      </div></section></>
}
