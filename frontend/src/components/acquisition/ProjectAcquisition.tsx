import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { apiFetch } from '../../services/api'
import './ProjectAcquisition.css'

type Notice = { id:number; reference:string; notification_type:string; notification_date:string; status:string; parcel_ids:number[] }
type Award = { id:number; reference:string; parcel_id:number; award_date:string; amount:string }
type Parcel = { id:number; village:string; survey_number:string }
async function query<T>(path:string, options?:RequestInit):Promise<T> {
  const response = await apiFetch(path, options)
  if (!response.ok) {
    const data:unknown = await response.json().catch(() => null)
    throw new Error(data && typeof data === 'object' && 'detail' in data ? JSON.stringify(data.detail) : `HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}
export default function ProjectAcquisition({projectId,projectStatus}:{projectId:number;projectStatus:string}) {
  const {user} = useAuth()
  const base = `/api/v1/projects/${projectId}`
  const [notices,setNotices] = useState<Notice[]>([])
  const [awards,setAwards] = useState<Award[]>([])
  const [parcels,setParcels] = useState<Parcel[]>([])
  const [error,setError] = useState('')
  const [message,setMessage] = useState('')
  const [busy,setBusy] = useState(false)
  const [reference,setReference] = useState('')
  const [type,setType] = useState('Preliminary notification')
  const [framework,setFramework] = useState('RFCTLARR Act, 2013 (demo reference)')
  const [noticeDate,setNoticeDate] = useState('')
  const [selected,setSelected] = useState<number[]>([])
  const [recorded,setRecorded] = useState(false)
  const [awardRef,setAwardRef] = useState('')
  const [noticeId,setNoticeId] = useState('')
  const [parcelId,setParcelId] = useState('')
  const [awardDate,setAwardDate] = useState('')
  const [amount,setAmount] = useState('')
  const canWrite = projectStatus === 'APPROVED' && ['DISTRICT_AUTHORITY','STATE_AUTHORITY','SYSTEM_ADMIN'].includes(user?.role ?? '')
  const load = useCallback(async () => {
    const [ns,as,ps] = await Promise.all([query<Notice[]>(`${base}/notifications`),query<Award[]>(`${base}/awards`),query<Parcel[]>(`${base}/parcels`)])
    setNotices(ns);setAwards(as);setParcels(ps)
  },[base])
  useEffect(() => { let active=true; load().catch((e:Error)=>{if(active)setError(e.message)});return()=>{active=false} },[load])
  async function saveNotice(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');setMessage('')
    try {
      await query(`${base}/notifications`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reference,notification_type:type,legal_framework:framework,notification_date:noticeDate,status:recorded?'RECORDED':'DRAFT',parcel_ids:selected})})
      await load();setReference('');setSelected([]);setNoticeDate('');setRecorded(false);setMessage('Notification saved.')
    } catch(e) {setError(e instanceof Error?e.message:'Unable to save notification')} finally {setBusy(false)}
  }
  async function saveAward(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');setMessage('')
    try {
      await query(`${base}/awards`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reference:awardRef,notification_id:Number(noticeId),parcel_id:Number(parcelId),award_date:awardDate,amount})})
      await load();setAwardRef('');setAmount('');setAwardDate('');setMessage('Award saved.')
    } catch(e) {setError(e instanceof Error?e.message:'Unable to save award')} finally {setBusy(false)}
  }
  const activeNotice = notices.find(n=>String(n.id)===noticeId)
  return <section className="panel acquisition-panel" aria-label="Acquisition notifications and awards">
    <div className="panel-heading"><div><h2>Notifications &amp; awards</h2><p>Demonstration records; no legal notices are published or funds transferred.</p></div></div>
    {error && <div className="message message-error" role="alert">{error}</div>}
    {message && <div className="message" role="status">{message}</div>}
    <div className="acquisition-grid"><div><h3>Notifications ({notices.length})</h3>{notices.length?notices.map(n=><article className="acquisition-record" key={n.id}><strong>{n.reference}</strong> · {n.status}<p>{n.notification_type} · {n.notification_date}</p><small>{n.parcel_ids.length} linked parcels</small></article>):<p>No notifications yet.</p>}</div>
    <div><h3>Awards ({awards.length})</h3>{awards.length?awards.map(a=><article className="acquisition-record" key={a.id}><strong>{a.reference}</strong><p>Parcel #{a.parcel_id} · {a.award_date}</p><small>Recorded amount ₹{Number(a.amount).toLocaleString('en-IN')}</small></article>):<p>No awards yet.</p>}</div></div>
    {!canWrite && <p className="acquisition-muted">An approved project and an authorized district, state or system administrator account are required to add records.</p>}
    {canWrite && <div className="acquisition-grid acquisition-forms"><form onSubmit={saveNotice}><h3>Add notification</h3>
      <label>Reference<input required maxLength={100} value={reference} onChange={e=>setReference(e.target.value)}/></label>
      <label>Type<input required maxLength={100} value={type} onChange={e=>setType(e.target.value)}/></label>
      <label>Applicable legal framework<input required maxLength={200} value={framework} onChange={e=>setFramework(e.target.value)}/></label>
      <label>Notification date<input required type="date" value={noticeDate} onChange={e=>setNoticeDate(e.target.value)}/></label>
      <fieldset><legend>Affected parcels</legend><div className="acquisition-parcels">{parcels.map(p=><label key={p.id}><input type="checkbox" checked={selected.includes(p.id)} onChange={e=>setSelected(old=>e.target.checked?[...old,p.id]:old.filter(id=>id!==p.id))}/>{p.village} · {p.survey_number}</label>)}</div></fieldset>
      <label className="acquisition-check"><input type="checkbox" checked={recorded} onChange={e=>setRecorded(e.target.checked)}/>Recorded in demo (not official publication)</label>
      <button className="button button-primary" disabled={busy||!selected.length} type="submit">Save notification</button></form>
      <form onSubmit={saveAward}><h3>Add award</h3>
      <label>Reference<input required maxLength={100} value={awardRef} onChange={e=>setAwardRef(e.target.value)}/></label>
      <label>Recorded notification<select required value={noticeId} onChange={e=>{setNoticeId(e.target.value);setParcelId('')}}><option value="">Choose notification</option>{notices.filter(n=>n.status==='RECORDED').map(n=><option key={n.id} value={n.id}>{n.reference}</option>)}</select></label>
      <label>Linked parcel<select required value={parcelId} onChange={e=>setParcelId(e.target.value)}><option value="">Choose parcel</option>{parcels.filter(p=>activeNotice?.parcel_ids.includes(p.id)).map(p=><option key={p.id} value={p.id}>{p.village} · {p.survey_number}</option>)}</select></label>
      <label>Award date<input required type="date" min={activeNotice?.notification_date} value={awardDate} onChange={e=>setAwardDate(e.target.value)}/></label>
      <label>Recorded award amount (₹)<input required type="number" min="0" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
      <button className="button button-primary" disabled={busy||!noticeId||!parcelId} type="submit">Save award</button></form></div>}
  </section>
}
