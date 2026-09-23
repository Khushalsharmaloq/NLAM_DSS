import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { request, sendJson } from '../services/api'
import type { AuthUser, UserRole } from '../auth/types'

const roles: UserRole[] = ['PROJECT_OFFICER', 'DISTRICT_AUTHORITY', 'STATE_AUTHORITY',
  'CENTRAL_MINISTRY', 'SYSTEM_ADMIN']
export default function AdminUsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [form, setForm] = useState({ username: '', full_name: '', password: '',
    role: 'PROJECT_OFFICER' as UserRole, state: '', district: '' })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function refresh() {
    try { setUsers(await request<AuthUser[]>('/api/v1/users')) }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load accounts.') }
  }
  useEffect(() => { void refresh() }, [])
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      await sendJson('/api/v1/users', { ...form, state: form.state || null,
        district: form.district || null })
      setMessage('Account created. Share credentials through your approved channel.')
      setForm({ ...form, username: '', full_name: '', password: '' })
      await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create account.') }
    finally { setBusy(false) }
  }
  async function toggle(user: AuthUser) {
    setError(''); setMessage('')
    try { await sendJson(`/api/v1/users/${user.id}`, { is_active: !user.is_active }, 'PATCH')
      setMessage(`Account ${user.is_active ? 'deactivated' : 'activated'}.`); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update account.') }
  }
  const assigned = form.role !== 'CENTRAL_MINISTRY' && form.role !== 'SYSTEM_ADMIN'
  return <><div className="page-heading"><div><div className="eyebrow">ACCESS CONTROL</div>
    <h1>User administration</h1><p>Assign jurisdiction and role before granting access to project records.</p></div></div>
    {error && <p role="alert" className="message message-error">{error}</p>}
    {message && <p role="status" className="message message-success">{message}</p>}
    <section className="panel operations-panel"><div className="panel-heading"><div><h2>Create an account</h2>
      <p>Use unique names and a password of 12 or more characters with letters and numbers.</p></div></div>
      <form className="ops-form" onSubmit={(e) => void create(e)}><div className="ops-fields">
        <label>Full name<input required minLength={2} maxLength={150} value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
        <label>Username<input required pattern="[a-z0-9._-]+" minLength={3} maxLength={80}
          value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
        <label>Role<select value={form.role} onChange={(e) => setForm({ ...form,
          role: e.target.value as UserRole })}>{roles.map((r) => <option key={r} value={r}>{r.replaceAll('_', ' ')}</option>)}</select></label>
        {assigned && <label>State / UT<input required maxLength={100} value={form.state}
          onChange={(e) => setForm({ ...form, state: e.target.value })} /></label>}
        {form.role === 'DISTRICT_AUTHORITY' || form.role === 'PROJECT_OFFICER' ?
          <label>District<input required={form.role === 'DISTRICT_AUTHORITY'} maxLength={100}
            value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></label> : null}
        <label>Temporary password<input required type="password" autoComplete="new-password" minLength={12}
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
      </div><button type="submit" disabled={busy} className="button button-primary">{busy ? 'Creating…' : 'Create account'}</button></form>
    </section>
    <section className="panel"><div className="panel-heading"><h2>Registered accounts</h2></div>
      <div className="table-container"><table className="data-table"><thead><tr><th>User</th><th>Role</th><th>Jurisdiction</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{users.map((u) => <tr key={u.id}><td><strong>{u.full_name}</strong><br />{u.username}</td>
          <td>{u.role.replaceAll('_', ' ')}</td><td>{[u.district, u.state].filter(Boolean).join(', ') || 'National'}</td>
          <td><span className="status-badge">{u.is_active ? 'Active' : 'Inactive'}</span></td>
          <td><button type="button" className="table-action" onClick={() => void toggle(u)}>
            {u.is_active ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div></section></>
}
