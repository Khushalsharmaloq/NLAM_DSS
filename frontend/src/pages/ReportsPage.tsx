import { useCallback, useEffect, useState } from 'react'
import { apiFetch, formatArea, request } from '../services/api'

type Overview = { project_count: number; states_count: number; proposed_area_ha: string;
  notified_area_ha: string; acquired_area_ha: string; parcel_count: number;
  compensation_assessed_inr: string; compensation_paid_inr: string;
  rr_household_count: number; rr_affected_persons: number;
  rr_relocation_anticipated_households: number; rr_status_counts: Record<string, number>;
  milestone_count: number; milestone_completed_count: number; milestone_overdue_count: number;
  project_status_counts: Record<string, number>; parcel_stage_counts: Record<string, number> }
type StateRow = { state: string; projects: number; approved: number;
  proposed_area_ha: string; acquired_area_ha: string; assessed_inr: string; paid_inr: string }
const money = (n: string) => Number(n).toLocaleString('en-IN',
  { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export default function ReportsPage() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [states, setStates] = useState<StateRow[]>([])
  const [state, setState] = useState('')
  const [district, setDistrict] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const params = new URLSearchParams()
  if (state) params.set('state', state)
  if (district) params.set('district', district)
  if (status) params.set('status', status)
  const query = params.toString()
  const load = useCallback(async () => {
    setError('')
    try { setOverview(await request<Overview>(`/api/v1/mis/overview${query ? `?${query}` : ''}`)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load report.') }
  }, [query])
  useEffect(() => { void load() }, [load])
  useEffect(() => { void request<StateRow[]>('/api/v1/mis/state-summary')
    .then(setStates).catch((e: Error) => setError(e.message)) }, [])
  async function download() {
    setDownloading(true); setError('')
    try {
      const response = await apiFetch(`/api/v1/mis/export.csv${query ? `?${query}` : ''}`)
      if (!response.ok) throw new Error(`Export failed (${response.status}).`)
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a'); link.href = url; link.download = 'nlam-projects.csv'
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to export.') }
    finally { setDownloading(false) }
  }
  return <><div className="page-heading"><div><div className="eyebrow">NATIONAL MONITORING</div>
    <h1>Executive reports</h1><p>Live figures calculated from projects within your assigned jurisdiction.</p></div>
    <button type="button" className="button button-primary" disabled={downloading} onClick={() => void download()}>
      {downloading ? 'Preparing…' : 'Export project CSV'}</button></div>
    {error && <p className="message message-error" role="alert">{error}</p>}
    <section className="panel"><div className="panel-heading"><div><h2>Report filters</h2>
      <p>Combine state, district and workflow status to focus the dashboard and export.</p></div></div>
      <div className="report-filters"><label>State / UT<select value={state} onChange={(e) => { setState(e.target.value); setDistrict('') }}>
        <option value="">All accessible states</option>{states.map((s) => <option key={s.state}>{s.state}</option>)}</select></label>
        <label>District<input value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="All districts" /></label>
        <label>Project status<select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>{['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'REJECTED'].map((s) =>
          <option key={s}>{s}</option>)}</select></label></div></section>
    <div className="report-kpis">
      {[['Projects', overview?.project_count], ['Land proposed · ha', overview ? formatArea(Number(overview.proposed_area_ha)) : '—'],
        ['Land notified · ha', overview ? formatArea(Number(overview.notified_area_ha)) : '—'],
        ['Land with possession recorded · ha', overview ? formatArea(Number(overview.acquired_area_ha)) : '—'],
        ['Compensation assessed', overview ? money(overview.compensation_assessed_inr) : '—'],
        ['Recorded disbursements', overview ? money(overview.compensation_paid_inr) : '—'],
        ['Affected families', overview?.rr_household_count],
        ['Displaced families anticipated', overview?.rr_relocation_anticipated_households],
        ['Milestones overdue', overview?.milestone_overdue_count],
      ].map(([label, value]) => <div className="report-kpi" key={String(label)}>
        <span>{label}</span><strong>{value ?? '—'}</strong></div>)}
    </div>
    <div className="report-columns"><section className="panel"><div className="panel-heading"><div>
      <h2>Project pipeline</h2><p>Records by current workflow stage</p></div></div>
      <div className="report-bars">{Object.entries(overview?.project_status_counts ?? {}).map(([key, value]) =>
        <div className="report-bar" key={key}><span>{key.replaceAll('_', ' ')}</span>
          <div><i style={{ width: `${Math.max(2, value * 100 / Math.max(overview?.project_count ?? 1, 1))}%` }} /></div><strong>{value}</strong></div>)}</div></section>
      <section className="panel"><div className="panel-heading"><div>
        <h2>Possession & R&R</h2><p>Recorded milestones across the scoped portfolio</p></div></div>
        <div className="dashboard-mis-rows">{Object.entries(overview?.parcel_stage_counts ?? {}).map(([key, value]) =>
          <div className="dashboard-mis-row" key={key}><span>{key.replaceAll('_', ' ')}</span><strong>{value}</strong></div>)}
          <div className="dashboard-mis-row"><span>People affected</span><strong>{overview?.rr_affected_persons ?? '—'}</strong></div>
          <div className="dashboard-mis-row"><span>Milestones completed</span><strong>{overview?.milestone_completed_count ?? '—'} / {overview?.milestone_count ?? '—'}</strong></div></div>
      </section></div>
    <section className="panel"><div className="panel-heading"><div><h2>State / UT summary</h2>
      <p>All states visible to your account, before report filters.</p></div></div>
      <div className="table-container"><table className="data-table"><thead><tr><th>State / UT</th>
        <th>Projects</th><th>Approved</th><th>Proposed · ha</th><th>Possession · ha</th>
        <th>Awards</th><th>Payments recorded</th></tr></thead><tbody>
        {states.map((s) => <tr key={s.state}><td>{s.state}</td><td>{s.projects}</td><td>{s.approved}</td>
          <td>{formatArea(Number(s.proposed_area_ha))}</td>
          <td>{formatArea(Number(s.acquired_area_ha))}</td><td>{money(s.assessed_inr)}</td>
          <td>{money(s.paid_inr)}</td></tr>)}</tbody></table>
        {!states.length && <p className="table-message">No states registered yet.</p>}</div></section>
    <p className="information-note">Figures reflect entered records. A possession milestone is a recorded event; it does not certify legal transfer. Forecasts are illustrative, not statutory decisions.</p>
  </>
}
