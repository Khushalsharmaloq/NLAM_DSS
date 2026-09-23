import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { sendJson } from '../services/api'

export default function AccountPage() {
  const { user } = useAuth()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try { await sendJson('/api/v1/users/change-password',
      { old_password: oldPassword, new_password: newPassword })
      setOldPassword(''); setNewPassword(''); setMessage('Password updated successfully.') }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to change password.') }
    finally { setBusy(false) }
  }
  return <><div className="page-heading"><div><div className="eyebrow">YOUR ACCOUNT</div>
    <h1>Account settings</h1><p>Review your role and update your password.</p></div></div>
    <section className="panel operations-panel"><div className="panel-heading"><h2>Profile</h2></div>
      <dl className="detail-grid"><div><dt>Name</dt><dd>{user?.full_name}</dd></div>
        <div><dt>Username</dt><dd>{user?.username}</dd></div>
        <div><dt>Role</dt><dd>{user?.role.replaceAll('_', ' ')}</dd></div>
        <div><dt>Jurisdiction</dt><dd>{[user?.district, user?.state].filter(Boolean).join(', ') || 'National'}</dd></div></dl></section>
    <section className="panel operations-panel"><div className="panel-heading"><h2>Change password</h2></div>
      {error && <p className="message message-error" role="alert">{error}</p>}
      {message && <p className="message message-success" role="status">{message}</p>}
      <form className="ops-form" onSubmit={(e) => void submit(e)}><div className="ops-fields">
        <label>Current password<input required type="password" autoComplete="current-password"
          value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} /></label>
        <label>New password<input required minLength={12} maxLength={128} type="password" autoComplete="new-password"
          value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label></div>
        <button className="button button-primary" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></form>
    </section></>
}
