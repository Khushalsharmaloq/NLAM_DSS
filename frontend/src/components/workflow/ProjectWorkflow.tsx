import { useCallback, useEffect, useState } from 'react'

import './ProjectWorkflow.css'
import { apiFetch } from '../../services/api'
import { useAuth } from '../../auth/AuthContext'

type WorkflowAction =
  | 'SUBMIT'
  | 'START_REVIEW'
  | 'RETURN'
  | 'APPROVE'
  | 'REJECT'

type WorkflowState = {
  project_id: number
  current_status: string
  allowed_actions: WorkflowAction[]
  simulation: boolean
  message: string
}

type WorkflowEvent = {
  id: number
  project_id: number
  action: string
  previous_status: string
  new_status: string
  comment: string | null
  actor_reference: string
  created_at: string
}

type WorkflowProps = {
  projectId: number
  onStatusChange?: (status: string) => void
}

const actionLabels: Record<WorkflowAction, string> = {
  SUBMIT: 'Submit proposal',
  START_REVIEW: 'Start scrutiny',
  RETURN: 'Return for revision',
  APPROVE: 'Approve proposal',
  REJECT: 'Reject proposal',
}

const actionRoles: Record<WorkflowAction, string> = {
  SUBMIT: 'PROJECT_OFFICER',
  START_REVIEW: 'DISTRICT_AUTHORITY',
  RETURN: 'DISTRICT_AUTHORITY',
  APPROVE: 'STATE_AUTHORITY',
  REJECT: 'STATE_AUTHORITY',
}
function formatStatus(status: string): string {
  return status.replaceAll('_', ' ')
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function ProjectWorkflow({
  projectId,
  onStatusChange,
}: WorkflowProps) {
  const { user } = useAuth()

  const [workflow, setWorkflow] =
    useState<WorkflowState | null>(null)

  const [history, setHistory] =
    useState<WorkflowEvent[]>([])

  const [selectedAction, setSelectedAction] =
    useState<WorkflowAction | ''>('')

  const [comment, setComment] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadWorkflow = useCallback(async () => {
    const base = `/api/v1/projects/${projectId}`

    const [workflowResponse, historyResponse] =
      await Promise.all([
        apiFetch(`${base}/workflow`),
        apiFetch(`${base}/workflow/history`),
      ])

    if (!workflowResponse.ok || !historyResponse.ok) {
      throw new Error(
        'Unable to retrieve project workflow information.'
      )
    }

    const workflowData =
      (await workflowResponse.json()) as WorkflowState

    const historyData =
      (await historyResponse.json()) as WorkflowEvent[]

    return {
      workflowData,
      historyData,
    }
  }, [projectId])

  useEffect(() => {
    let active = true

    loadWorkflow()
      .then(({ workflowData, historyData }) => {
        if (!active) return

        setWorkflow(workflowData)
        setHistory(historyData)
        setError('')
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
  }, [loadWorkflow])

  async function refreshWorkflow() {
    setLoading(true)
    setError('')

    try {
      const { workflowData, historyData } =
        await loadWorkflow()

      setWorkflow(workflowData)
      setHistory(historyData)

      onStatusChange?.(workflowData.current_status)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to refresh workflow.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function executeAction() {
    if (!selectedAction || !workflow || saving) return

    if (!workflow.allowed_actions.includes(selectedAction) || actionRoles[selectedAction] !== user?.role) {
      setError('This action is no longer available.')
      return
    }

    const reason = comment.trim()

    if (
      (selectedAction === 'RETURN' ||
        selectedAction === 'REJECT') &&
      !reason
    ) {
      setError(
        'A comment is required when returning or rejecting a proposal.'
      )
      return
    }

    if (
      ['APPROVE', 'REJECT'].includes(selectedAction) &&
      !window.confirm(
        `Confirm simulated action: ${actionLabels[selectedAction]}?`
      )
    ) {
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const response = await apiFetch(
        `/api/v1/projects/${projectId}/workflow/transition`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: selectedAction,
            comment: reason || null,
          }),
        }
      )

      if (!response.ok) {
        let message =
          `Workflow transition failed (${response.status}).`

        try {
          const body: unknown = await response.json()

          if (
            typeof body === 'object' &&
            body !== null &&
            'detail' in body &&
            typeof body.detail === 'string'
          ) {
            message = body.detail
          }
        } catch {
          // Preserve the HTTP error message.
        }

        throw new Error(message)
      }

      setSelectedAction('')
      setComment('')

      const { workflowData, historyData } =
        await loadWorkflow()

      setWorkflow(workflowData)
      setHistory(historyData)

      onStatusChange?.(workflowData.current_status)

      setNotice(
        `Workflow updated. Current status: ${formatStatus(
          workflowData.current_status
        )}.`
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update workflow.'
      )
    } finally {
      setSaving(false)
    }
  }

  const requiresComment =
    selectedAction === 'RETURN' ||
    selectedAction === 'REJECT'


  const availableActions = workflow?.allowed_actions.filter(
    (action) => actionRoles[action] === user?.role
  ) ?? []
  return (
    <section className="panel workflow-section">
      <div className="panel-heading">
        <div>
          <h2>Project approval workflow</h2>
          <p>
            Proposal submission, scrutiny, and administrative
            action history.
          </p>
        </div>

        <button
          type="button"
          className="button button-secondary"
          onClick={() => void refreshWorkflow()}
          disabled={loading || saving}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="workflow-message workflow-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="workflow-message workflow-success" role="status">
          {notice}
        </div>
      )}

      {loading && (
        <div className="workflow-loading">
          Loading workflow information...
        </div>
      )}

      {!loading && workflow && (
        <>
          <div className="workflow-status">
            <div>
              <span className="workflow-label">
                CURRENT STATUS
              </span>

              <strong>
                {formatStatus(workflow.current_status)}
              </strong>
            </div>

            <div>
              <span className="workflow-label">
                AVAILABLE ACTIONS
              </span>

              <strong>
                {availableActions.length}
              </strong>
            </div>

            <div>
              <span className="workflow-label">
                RECORDED EVENTS
              </span>

              <strong>{history.length}</strong>
            </div>
          </div>

          <div className="workflow-content">
            <div className="workflow-actions">
              <h3>Administrative action</h3>

              <p className="workflow-description">
                Choose an available workflow action.
                A reason is mandatory when returning
                or rejecting a proposal.
              </p>

              {availableActions.length === 0 ? (
                <div className="workflow-empty">
                  No further actions are available
                  from the current project status.
                </div>
              ) : (
                <>
                  <div className="workflow-field">
                    <label htmlFor="workflow-action">
                      Select action
                    </label>

                    <select
                      id="workflow-action"
                      value={selectedAction}
                      disabled={saving}
                      onChange={(event) => {
                        setSelectedAction(
                          event.target.value as WorkflowAction | ''
                        )
                        setError('')
                      }}
                    >
                      <option value="">
                        Choose an action
                      </option>

                      {availableActions.map((action) => (
                        <option
                          key={action}
                          value={action}
                        >
                          {actionLabels[action]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="workflow-field">
                    <label htmlFor="workflow-comment">
                      Comment
                      {requiresComment ? ' (required)' : ' (optional)'}
                    </label>

                    <textarea
                      id="workflow-comment"
                      rows={4}
                      maxLength={500}
                      required={requiresComment}
                      value={comment}
                      disabled={saving}
                      onChange={(event) =>
                        setComment(event.target.value)
                      }
                      placeholder="Enter the reason or supporting remarks"
                    />
                  </div>

                  <button
                    type="button"
                    className="button button-primary"
                    disabled={!selectedAction || saving}
                    onClick={() => void executeAction()}
                  >
                    {saving
                      ? 'Processing...'
                      : 'Confirm workflow action'}
                  </button>
                </>
              )}

              <div className="workflow-prototype-note">
                Prototype simulation only. Authentication
                and authorized officer approvals will be
                implemented separately.
              </div>
            </div>

            <div className="workflow-history">
              <h3>Workflow history</h3>

              <p className="workflow-description">
                Recorded project status transitions,
                displayed newest first.
              </p>

              {history.length === 0 ? (
                <div className="workflow-empty">
                  No workflow actions have been recorded yet.
                </div>
              ) : (
                <div className="workflow-events">
                  {history.map((event) => (
                    <div
                      className="workflow-event"
                      key={event.id}
                    >
                      <div className="workflow-event-header">
                        <strong>
                          {formatStatus(event.action)}
                        </strong>

                        <span>
                          {formatDate(event.created_at)}
                        </span>
                      </div>

                      <div className="workflow-event-transition">
                        {formatStatus(event.previous_status)}
                        {' → '}
                        {formatStatus(event.new_status)}
                      </div>

                      {event.comment && (
                        <p>{event.comment}</p>
                      )}

                      <div className="workflow-event-actor">
                        Operator: {event.actor_reference}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}