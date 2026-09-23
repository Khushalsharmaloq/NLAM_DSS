import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '../../auth/AuthContext'
import { apiFetch } from '../../services/api'

import './ProjectPossession.css'

type ProgressStage =
  | 'REGISTERED'
  | 'SURVEY_RECORDED'
  | 'DOCUMENTATION_RECORDED'
  | 'POSSESSION_RECORDED'

type ProgressAction =
  | 'RECORD_SURVEY'
  | 'RECORD_DOCUMENTATION'
  | 'RECORD_POSSESSION'

type ProgressEvent = {
  id: number
  action: ProgressAction
  previous_stage: ProgressStage
  new_stage: ProgressStage
  remarks: string | null
  recorded_by_username: string
  recorded_at: string
}

type ParcelProgress = {
  parcel_id: number
  survey_number: string
  village: string
  current_stage: ProgressStage
  history: ProgressEvent[]
}

const stages: ProgressStage[] = [
  'REGISTERED',
  'SURVEY_RECORDED',
  'DOCUMENTATION_RECORDED',
  'POSSESSION_RECORDED',
]

const stageLabels: Record<ProgressStage, string> = {
  REGISTERED: 'Registered',
  SURVEY_RECORDED: 'Survey recorded',
  DOCUMENTATION_RECORDED: 'Documentation recorded',
  POSSESSION_RECORDED: 'Possession recorded (demo)',
}

const actionLabels: Record<ProgressAction, string> = {
  RECORD_SURVEY: 'Record survey',
  RECORD_DOCUMENTATION: 'Record documentation',
  RECORD_POSSESSION: 'Record demonstration possession',
}

function availableAction(
  stage: ProgressStage,
  role: string | undefined
): ProgressAction | null {
  if (stage === 'REGISTERED' && role === 'PROJECT_OFFICER') {
    return 'RECORD_SURVEY'
  }

  if (
    stage === 'SURVEY_RECORDED' &&
    role === 'PROJECT_OFFICER'
  ) {
    return 'RECORD_DOCUMENTATION'
  }

  if (
    stage === 'DOCUMENTATION_RECORDED' &&
    role === 'DISTRICT_AUTHORITY'
  ) {
    return 'RECORD_POSSESSION'
  }

  return null
}

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()

    if (
      typeof body === 'object' &&
      body !== null &&
      'detail' in body
    ) {
      if (typeof body.detail === 'string') {
        return body.detail
      }

      if (Array.isArray(body.detail)) {
        return body.detail
          .map((item: { msg?: string }) => item.msg ?? 'Invalid value')
          .join('; ')
      }
    }
  } catch {
    // Fall back to the HTTP status.
  }

  return `Request failed (HTTP ${response.status}).`
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function ProjectPossession({
  projectId,
}: {
  projectId: number
}) {
  const { user } = useAuth()

  const [parcels, setParcels] = useState<ParcelProgress[]>([])
  const [remarks, setRemarks] = useState<Record<number, string>>({})

  const [loading, setLoading] = useState(true)
  const [savingParcelId, setSavingParcelId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const progressPath =
    `/api/v1/projects/${projectId}/possession-progress`

  useEffect(() => {
    let active = true

    setLoading(true)
    setError('')
    setNotice('')
    setParcels([])
    setRemarks({})

    apiFetch(progressPath)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await readError(response))
        }

        return (await response.json()) as ParcelProgress[]
      })
      .then((data) => {
        if (active) setParcels(data)
      })
      .catch((err: Error) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [progressPath])

  async function refreshProgress() {
    setLoading(true)
    setError('')

    try {
      const response = await apiFetch(progressPath)

      if (!response.ok) {
        throw new Error(await readError(response))
      }

      setParcels((await response.json()) as ParcelProgress[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load parcel progress.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function submitProgress(
    event: FormEvent<HTMLFormElement>,
    parcel: ParcelProgress,
    action: ProgressAction
  ) {
    event.preventDefault()

    if (savingParcelId !== null || loading) return

    // The backend enforces role permissions and transition order.
    if (availableAction(parcel.current_stage, user?.role) !== action) {
      return
    }

    const enteredRemarks = (remarks[parcel.parcel_id] ?? '').trim()

    if (action === 'RECORD_POSSESSION' && !enteredRemarks) {
      setError(
        'Remarks are required for the demonstration possession milestone.'
      )
      return
    }

    setSavingParcelId(parcel.parcel_id)
    setError('')
    setNotice('')

    try {
      const response = await apiFetch(
        `/api/v1/projects/${projectId}/parcels/${parcel.parcel_id}/progress`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action,
            remarks: enteredRemarks || null,
          }),
        }
      )

      if (!response.ok) {
        throw new Error(await readError(response))
      }

      setRemarks((current) => ({
        ...current,
        [parcel.parcel_id]: '',
      }))

      setNotice(
        `${parcel.survey_number}: ${actionLabels[action]} saved.`
      )

      // Reload from the API to display the committed event history.
      const updatedResponse = await apiFetch(progressPath)

      if (!updatedResponse.ok) {
        throw new Error(
          'Progress was saved, but the register could not be refreshed. ' +
          (await readError(updatedResponse))
        )
      }

      setParcels(
        (await updatedResponse.json()) as ParcelProgress[]
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to record parcel progress.'
      )
    } finally {
      setSavingParcelId(null)
    }
  }

  const completed = parcels.filter(
    (parcel) => parcel.current_stage === 'POSSESSION_RECORDED'
  ).length

  const inProgress = parcels.filter(
    (parcel) =>
      parcel.current_stage !== 'REGISTERED' &&
      parcel.current_stage !== 'POSSESSION_RECORDED'
  ).length

  return (
    <section className="panel possession-section">
      <div className="panel-heading">
        <div>
          <h2>Parcel acquisition progress</h2>
          <p>
            Stage-by-stage progress and recorded actions for each
            registered land parcel.
          </p>
        </div>

        <button
          type="button"
          className="button button-secondary"
          onClick={() => void refreshProgress()}
          disabled={loading || savingParcelId !== null}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="possession-disclaimer">
        This section records synthetic operational milestones only.
        It does not establish land title, confirm legal transfer,
        or issue a possession certificate. Demonstration possession
        may be recorded only for an approved project.
      </div>

      {error && (
        <div className="possession-message possession-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div
          className="possession-message possession-success"
          role="status"
        >
          {notice}
        </div>
      )}

      <div className="possession-summary">
        <div>
          <span>REGISTERED PARCELS</span>
          <strong>{loading ? '—' : parcels.length}</strong>
        </div>

        <div>
          <span>IN PROGRESS</span>
          <strong>{loading ? '—' : inProgress}</strong>
        </div>

        <div>
          <span>DEMONSTRATION POSSESSION RECORDED</span>
          <strong>{loading ? '—' : completed}</strong>
        </div>
      </div>

      <div className="possession-content">
        {!loading && parcels.length === 0 && (
          <p className="possession-empty">
            No land parcels are registered for this project.
            Register a parcel in the GIS module to begin tracking progress.
          </p>
        )}

        {parcels.map((parcel) => {
          const action = availableAction(
            parcel.current_stage,
            user?.role
          )

          const currentStageIndex = stages.indexOf(
            parcel.current_stage
          )

          const parcelIsSaving =
            savingParcelId === parcel.parcel_id

          const enteredRemarks =
            remarks[parcel.parcel_id] ?? ''

          return (
            <article
              className="possession-parcel"
              key={parcel.parcel_id}
            >
              <div className="possession-parcel-heading">
                <div>
                  <span className="possession-reference">
                    {parcel.survey_number}
                  </span>

                  <p>
                    {parcel.village} · Parcel ID {parcel.parcel_id}
                  </p>
                </div>

                <span className="possession-stage-label">
                  {stageLabels[parcel.current_stage] ??
                    parcel.current_stage}
                </span>
              </div>

              <ol
                className="possession-steps"
                aria-label={`Progress for ${parcel.survey_number}`}
              >
                {stages.map((stage, index) => (
                  <li
                    key={stage}
                    className={
                      index < currentStageIndex
                        ? 'possession-step possession-step-complete'
                        : index === currentStageIndex
                          ? 'possession-step possession-step-current'
                          : 'possession-step'
                    }
                    aria-current={
                      index === currentStageIndex
                        ? 'step'
                        : undefined
                    }
                  >
                    <span className="possession-step-number">
                      {index + 1}
                    </span>

                    <span>{stageLabels[stage]}</span>
                  </li>
                ))}
              </ol>

              {action && (
                <form
                  className="possession-action-form"
                  onSubmit={(event) =>
                    void submitProgress(event, parcel, action)
                  }
                >
                  <div>
                    <h3>{actionLabels[action]}</h3>

                    <p>
                      {action === 'RECORD_POSSESSION'
                        ? 'District Authority action. Requires an APPROVED project and mandatory remarks.'
                        : 'Project Officer action. Record a synthetic progress milestone for this parcel.'}
                    </p>
                  </div>

                  <label htmlFor={`possession-remarks-${parcel.parcel_id}`}>
                    Remarks
                    {action === 'RECORD_POSSESSION'
                      ? ' (required)'
                      : ' (optional)'}
                  </label>

                  <textarea
                    id={`possession-remarks-${parcel.parcel_id}`}
                    rows={2}
                    maxLength={500}
                    required={action === 'RECORD_POSSESSION'}
                    value={enteredRemarks}
                    disabled={savingParcelId !== null || loading}
                    onChange={(event) =>
                      setRemarks((current) => ({
                        ...current,
                        [parcel.parcel_id]: event.target.value,
                      }))
                    }
                    placeholder={
                      action === 'RECORD_POSSESSION'
                        ? 'Explain this synthetic milestone. Do not enter an official possession certificate number.'
                        : 'Add a brief note about the recorded progress.'
                    }
                  />

                  <div className="possession-action-footer">
                    <span>
                      Each action is retained in the parcel history.
                    </span>

                    <button
                      type="submit"
                      className="button button-primary"
                      disabled={
                        loading ||
                        savingParcelId !== null ||
                        (
                          action === 'RECORD_POSSESSION' &&
                          !enteredRemarks.trim()
                        )
                      }
                    >
                      {parcelIsSaving
                        ? 'Saving...'
                        : actionLabels[action]}
                    </button>
                  </div>
                </form>
              )}

              {parcel.current_stage === 'POSSESSION_RECORDED' && (
                <p className="possession-complete-note">
                  Final demonstration progress milestone recorded.
                  No further actions are available for this parcel.
                </p>
              )}

              {parcel.current_stage === 'DOCUMENTATION_RECORDED' &&
                user?.role !== 'DISTRICT_AUTHORITY' && (
                  <p className="possession-waiting-note">
                    Documentation has been recorded. The next
                    demonstration action is restricted to the District
                    Authority and requires project approval.
                  </p>
                )}

              <details className="possession-history">
                <summary>
                  Action history ({parcel.history.length})
                </summary>

                {parcel.history.length === 0 ? (
                  <p>No progress actions recorded yet.</p>
                ) : (
                  <ol>
                    {[...parcel.history].reverse().map((item) => (
                      <li key={item.id}>
                        <div className="possession-history-heading">
                          <strong>
                            {stageLabels[item.new_stage] ??
                              item.new_stage}
                          </strong>

                          <span>
                            {formatTimestamp(item.recorded_at)}
                          </span>
                        </div>

                        <p>
                          Recorded by {item.recorded_by_username}
                        </p>

                        {item.remarks && (
                          <p>Remarks: {item.remarks}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </details>
            </article>
          )
        })}
      </div>
    </section>
  )
}