import { useEffect, useState } from 'react'

import type { FormEvent } from 'react'

import {
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom'

import { createProject, getProject, sendJson } from '../services/api'
import type { Project } from '../types/project'
import { useAuth } from '../auth/AuthContext'

type FormData = {
  name: string
  state: string
  district: string
  proposed_area_ha: string
  agency: string
  sector: string
  description: string
  target_date: string
}

const initialForm: FormData = {
  name: '',
  state: '',
  district: '',
  proposed_area_ha: '',
  agency: '', sector: '', description: '', target_date: '',
}

export default function ProjectCreatePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { projectId } = useParams()
  const editing = Boolean(projectId)

  const [form, setForm] = useState<FormData>({ ...initialForm,
    state: user?.state ?? '', district: user?.district ?? '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!projectId) return
    let active = true
    void getProject(Number(projectId)).then((p) => {
      if (active) setForm({ name: p.name, state: p.state, district: p.district,
        proposed_area_ha: p.proposed_area_ha, agency: p.agency ?? '', sector: p.sector ?? '',
        description: p.description ?? '', target_date: p.target_date ?? '' })
    }).catch((e: Error) => { if (active) setError(e.message) })
    return () => { active = false }
  }, [projectId])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setSaving(true)
    setError('')

    try {
      const payload = {
        name: form.name.trim(),
        state: form.state.trim(),
        district: form.district.trim(),
        proposed_area_ha: Number(form.proposed_area_ha),
        agency: form.agency.trim() || null,
        sector: form.sector.trim() || null,
        description: form.description.trim() || null,
        target_date: form.target_date || null,
      }
      const project = editing
        ? await sendJson<Project>(`/api/v1/projects/${projectId}`, payload, 'PATCH')
        : await createProject(payload)

      navigate(`/projects/${project.id}`, {
        state: {
          notice: `Project ${project.id} was ${editing ? 'updated' : 'created'} successfully.`,
        },
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create project.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            PROJECT MANAGEMENT
          </div>

          <h1>{editing ? 'Edit project proposal' : 'Register a new project'}</h1>

          <p>
            Enter the initial administrative details
            of a proposed land acquisition project.
          </p>
        </div>
      </div>

      {error && (
        <div className="message message-error" role="alert">
          {error}
        </div>
      )}

      <form
        className="form-panel"
        onSubmit={handleSubmit}
      >
        <div className="form-section-heading">
          <h2>Project information</h2>

          <p>Core location and land area are required. {editing ? 'Update the proposal before submitting it again.' : 'Your proposal begins in draft.'}</p>
        </div>

        <div className="form-grid">
          <div className="form-field field-full">
            <label htmlFor="project-name">
              Project name
            </label>

            <input
              id="project-name"
              required
              minLength={3}
              maxLength={250}
              value={form.name}
              onChange={(event) =>
                setForm({
                  ...form,
                  name: event.target.value,
                })
              }
              placeholder="Enter the official project name"
            />
          </div>

          <div className="form-field">
            <label htmlFor="project-state">
              State / Union Territory
            </label>

            <input
              id="project-state"
              required
              minLength={2}
              maxLength={100}
              value={form.state}
              readOnly={Boolean(user?.state)}
              onChange={(event) =>
                setForm({
                  ...form,
                  state: event.target.value,
                })
              }
              placeholder="Enter state or UT"
            />
          </div>

          <div className="form-field">
            <label htmlFor="project-district">
              District
            </label>

            <input
              id="project-district"
              required
              minLength={2}
              maxLength={100}
              value={form.district}
              readOnly={Boolean(user?.district)}
              onChange={(event) =>
                setForm({
                  ...form,
                  district: event.target.value,
                })
              }
              placeholder="Enter district"
            />
          </div>

          <div className="form-field">
            <label htmlFor="project-area">
              Proposed land area (hectares)
            </label>

            <input
              id="project-area"
              type="number"
              required
              min="0.0001"
              step="0.0001"
              value={form.proposed_area_ha}
              onChange={(event) =>
                setForm({
                  ...form,
                  proposed_area_ha: event.target.value,
                })
              }
              placeholder="0.0000"
            />
          </div>
          <div className="form-field">
            <label htmlFor="project-agency">Implementing agency</label>
            <input id="project-agency" maxLength={180} value={form.agency}
              onChange={(e) => setForm({ ...form, agency: e.target.value })}
              placeholder="e.g. State infrastructure agency" />
          </div>
          <div className="form-field">
            <label htmlFor="project-sector">Sector</label>
            <select id="project-sector" value={form.sector}
              onChange={(e) => setForm({ ...form, sector: e.target.value })}>
              <option value="">Select a sector</option>
              {['Roads and highways', 'Railways', 'Irrigation', 'Renewable energy',
                'Urban development', 'Industrial corridor', 'Other'].map((s) =>
                <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="project-target">Target date</label>
            <input id="project-target" type="date" value={form.target_date}
              onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
          </div>
          <div className="form-field field-full">
            <label htmlFor="project-description">Project description</label>
            <textarea id="project-description" rows={3} maxLength={2000} value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Purpose, location and anticipated public benefit" />
          </div>
        </div>

        <div className="form-actions">
          <Link
            className="button button-secondary"
            to="/projects"
          >
            Cancel
          </Link>

          <button
            type="submit"
            className="button button-primary"
            disabled={saving}
          >
            {saving
              ? 'Creating project...'
              : editing ? 'Save proposal' : 'Register project'}
          </button>
        </div>
      </form>
    </>
  )
}
