import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { formatDate, request, sendJson } from '../../services/api'

type Parcel = { id: number; survey_number: string; village: string; area_ha: string }
type Notification = { id: number; reference: string; notification_type: string; legal_framework: string;
  notification_date: string; status: string; parcel_ids: number[] }
type Award = { id: number; reference: string; notification_id: number; parcel_id: number;
  award_date: string; amount: string }
type Payment = { id: number; award_id: number; reference: string; payment_date: string;
  amount: string; recorded_by: string }
type Tab = 'notifications' | 'awards' | 'payments'
const currency = (value: number | string) => Number(value).toLocaleString('en-IN',
  { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })

export default function AcquisitionPanel({ projectId, approved }: { projectId: number; approved: boolean }) {
  const { user } = useAuth()
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [notices, setNotices] = useState<Notification[]>([])
  const [awards, setAwards] = useState<Award[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [tab, setTab] = useState<Tab>('notifications')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [ref, setRef] = useState('')
  const [kind, setKind] = useState('Preliminary notification')
  const [framework, setFramework] = useState('')
  const [recordDate, setRecordDate] = useState(new Date().toISOString().slice(0, 10))
  const [selected, setSelected] = useState<number[]>([])
  const [notificationId, setNotificationId] = useState('')
  const [parcelId, setParcelId] = useState('')
  const [awardId, setAwardId] = useState('')
  const [amount, setAmount] = useState('')
  const base = `/api/v1/projects/${projectId}`
  const canRecord = ['DISTRICT_AUTHORITY', 'STATE_AUTHORITY', 'SYSTEM_ADMIN'].includes(user?.role ?? '')
  const reload = useCallback(async () => {
    const [p, n, a, pay] = await Promise.all([
      request<Parcel[]>(`${base}/parcels`), request<Notification[]>(`${base}/notifications`),
      request<Award[]>(`${base}/awards`), request<Payment[]>(`${base}/payments`),
    ])
    setParcels(p); setNotices(n); setAwards(a); setPayments(pay)
  }, [base])
  useEffect(() => { void reload().catch((e: Error) => setError(e.message)) }, [reload])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('')
    try {
      if (tab === 'notifications') {
        await sendJson(`${base}/notifications`, { reference: ref, notification_type: kind,
          legal_framework: framework, notification_date: recordDate,
          status: 'RECORDED', parcel_ids: selected })
      } else if (tab === 'awards') {
        await sendJson(`${base}/awards`, { notification_id: Number(notificationId),
          parcel_id: Number(parcelId), reference: ref, award_date: recordDate, amount: Number(amount) })
      } else {
        await sendJson(`${base}/payments`, { award_id: Number(awardId), reference: ref,
          payment_date: recordDate, amount: Number(amount) })
      }
      setRef(''); setAmount(''); setSelected([])
      setNotice(`${tab === 'payments' ? 'Disbursement' : tab === 'awards' ? 'Award' : 'Notification'} record saved.`)
      await reload()
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save record.') }
    finally { setBusy(false) }
  }

  const chosenNotice = notices.find((item) => item.id === Number(notificationId))
  const eligibleParcels = parcels.filter((item) => chosenNotice?.parcel_ids.includes(item.id))
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'notifications', label: 'Notifications', count: notices.length },
    { key: 'awards', label: 'Awards', count: awards.length },
    { key: 'payments', label: 'Disbursements', count: payments.length },
  ]
  return <section className="panel operations-panel" aria-label="Acquisition records">
    <div className="panel-heading"><div><h2>Acquisition & compensation ledger</h2>
      <p>Notification → award → recorded payment. All values are stored as separate traceable records.</p></div>
      <button className="button button-secondary" type="button" onClick={() => void reload()}>
        Refresh records</button></div>
    <div className="ops-tabs" role="group" aria-label="Acquisition stages">
      {tabs.map((item) => <button key={item.key} type="button" className={tab === item.key ? 'ops-tab active' : 'ops-tab'}
        aria-pressed={tab === item.key} onClick={() => { setTab(item.key); setError(''); setNotice('') }}>
        {item.label}<span>{item.count}</span></button>)}
    </div>
    {error && <p className="message message-error" role="alert">{error}</p>}
    {notice && <p className="message message-success" role="status">{notice}</p>}
    {canRecord && approved && <form className="ops-form" onSubmit={(e) => void submit(e)}>
      <h3>Record {tab === 'notifications' ? 'a notification' : tab === 'awards' ? 'an award' : 'a disbursement'}</h3>
      <div className="ops-fields">
        {tab === 'awards' && <label>Recorded notification
          <select required value={notificationId} onChange={(e) => { setNotificationId(e.target.value); setParcelId('') }}>
            <option value="">Select notification</option>{notices.filter((n) => n.status === 'RECORDED').map((n) =>
              <option key={n.id} value={n.id}>{n.reference}</option>)}</select></label>}
        {tab === 'awards' && <label>Parcel under notification
          <select required value={parcelId} onChange={(e) => setParcelId(e.target.value)}>
            <option value="">Select parcel</option>{eligibleParcels.map((p) =>
              <option key={p.id} value={p.id}>{p.survey_number} · {p.village}</option>)}</select></label>}
        {tab === 'payments' && <label>Assessed award
          <select required value={awardId} onChange={(e) => setAwardId(e.target.value)}>
            <option value="">Select award</option>{awards.map((a) =>
              <option key={a.id} value={a.id}>{a.reference} · {currency(a.amount)}</option>)}</select></label>}
        <label>Record reference<input required maxLength={100} value={ref} onChange={(e) => setRef(e.target.value)}
          placeholder={tab === 'notifications' ? 'NOT-2026-001' : tab === 'awards' ? 'AWD-2026-001' : 'PAY-2026-001'} /></label>
        {tab === 'notifications' && <><label>Notification type<input required maxLength={100} value={kind}
          onChange={(e) => setKind(e.target.value)} /></label>
          <label>Legal framework / authority<input required maxLength={200} value={framework}
            onChange={(e) => setFramework(e.target.value)} placeholder="Enter applicable legal basis" /></label></>}
        {tab !== 'notifications' && <label>Amount (INR)<input type="number" required min={tab === 'awards' ? '0' : '0.01'}
          step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>}
        <label>{tab === 'notifications' ? 'Notification' : tab === 'awards' ? 'Award' : 'Payment'} date
          <input type="date" required value={recordDate} onChange={(e) => setRecordDate(e.target.value)} /></label>
      </div>
      {tab === 'notifications' && <fieldset className="ops-parcels"><legend>Linked land parcels</legend>
        {parcels.length ? parcels.map((p) => <label key={p.id}><input type="checkbox" checked={selected.includes(p.id)}
          onChange={(e) => setSelected(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))} />
          {p.survey_number} · {p.village} ({Number(p.area_ha).toFixed(2)} ha)</label>) :
          <p>Register a parcel on the GIS page first.</p>}</fieldset>}
      <button className="button button-primary" type="submit" disabled={busy || (tab === 'notifications' && !selected.length)}>
        {busy ? 'Saving…' : 'Save record'}</button>
    </form>}
    {!approved && <p className="ops-hint">Approve the project before entering notifications, awards or payments.</p>}
    <div className="ops-list">{tab === 'notifications' ? (notices.length ? notices.map((n) =>
      <article className="ops-row" key={n.id}><div><strong>{n.reference}</strong><small>{n.notification_type} · {n.legal_framework}</small></div>
        <div><span className="status-badge">{n.status}</span><small>{formatDate(n.notification_date)} · {n.parcel_ids.length} parcels</small></div></article>) :
      <p className="table-message">No notifications recorded yet.</p>) : tab === 'awards' ? (awards.length ? awards.map((a) =>
      <article className="ops-row" key={a.id}><div><strong>{a.reference}</strong><small>Parcel {parcels.find((p) => p.id === a.parcel_id)?.survey_number ?? a.parcel_id}</small></div>
        <div><strong>{currency(a.amount)}</strong><small>{formatDate(a.award_date)}</small></div></article>) :
      <p className="table-message">No awards recorded yet.</p>) : payments.length ? payments.map((p) =>
      <article className="ops-row" key={p.id}><div><strong>{p.reference}</strong><small>Award {awards.find((a) => a.id === p.award_id)?.reference ?? p.award_id} · by {p.recorded_by}</small></div>
        <div><strong>{currency(p.amount)}</strong><small>{formatDate(p.payment_date)}</small></div></article>) :
      <p className="table-message">No disbursements recorded yet.</p>}</div>
    <p className="ops-hint">Payment entries record reported disbursements; this website does not initiate bank transfers or issue statutory instruments.</p>
  </section>
}
