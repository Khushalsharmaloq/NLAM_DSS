import { useState } from 'react'

import type { FormEvent } from 'react'

import {
  Link,
  useNavigate,
} from 'react-router-dom'

import { createProject } from '../services/api'

type FormData = {
  name: string
  state: string
  district: string
  proposed_area_ha: string
}

const initialForm: FormData = {
  name: '',
  state: '',
  district: '',
  proposed_area_ha: '',
}

export default function ProjectCreatePage() {
  const navigate = useNavigate()

  const [form, setForm] = useState<FormData>(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    setSaving(true)
    setError('')

    try {
      const project = await createProject({
        name: form.name.trim(),
        state: form.state.trim(),
        district: form.district.trim(),
        proposed_area_ha: Number(form.proposed_area_ha),
      })

      navigate(`/projects/${project.id}`, {
        state: {
          notice: `Project ${project.id} was created successfully.`,
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

          <h1>Register a new project</h1>

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

          <p>
            All fields are required. New projects
            are registered with draft status.
          </p>
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
              : 'Register project'}
          </button>
        </div>
      </form>
    </>
  )
}