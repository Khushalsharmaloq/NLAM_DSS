import { useEffect, useState } from 'react'
import { formatDate, request } from '../../services/api'

type Entry = { id: string; kind: string; detail: string; actor: string; at: string }

export default function AuditPanel({ projectId }: { projectId: number }) {
  const [rows, setRows] = useState<Entry[]>([])
  const [error, setError] = useState('')
  useEffect(() => { void request<Entry[]>(`/api/v1/projects/${projectId}/audit`)
    .then(setRows).catch((e: Error) => setError(e.message)) }, [projectId])
  return <section className="panel operations-panel"><div className="panel-heading"><div>
    <h2>Project activity & audit history</h2><p>Who recorded each document and administrative event.</p>
  </div></div>{error && <p className="message message-error" role="alert">{error}</p>}
    <div className="ops-list">{rows.length ? rows.map((r) => <article className="ops-row" key={r.id}>
      <div><strong>{r.kind}</strong><small>{r.detail}</small></div><div>
        <strong>{r.actor}</strong><small>{formatDate(r.at)}</small></div></article>) :
      <p className="table-message">No recorded activity yet.</p>}</div></section>
}
