import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '../../auth/AuthContext'
import { apiFetch } from '../../services/api'

import './ProjectCompensation.css'


type Parcel = {
  id: number
  survey_number: string
  village: string
}

type CompensationEstimate = {
  id: number
  project_id: number
  parcel_id: number
  proposed_area_ha: string
  indicative_rate_per_ha: string
  additional_planning_amount: string
  estimated_total: string
  remarks: string | null
  created_by_username: string
  created_at: string
}


function money(value: string | number): string {
  return Number(value).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}


function area(value: string | number): string {
  return Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })
}


async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()

    if (
      typeof body === 'object' &&
      body !== null &&
      'detail' in body &&
      typeof body.detail === 'string'
    ) {
      return body.detail
    }
  } catch {
    // Keep the HTTP status when the response has no JSON detail.
  }

  return `Request failed (HTTP ${response.status}).`
}


export default function ProjectCompensation({
  projectId,
}: {
  projectId: number
}) {
  const { user } = useAuth()

  const [parcels, setParcels] = useState<Parcel[]>([])
  const [estimates, setEstimates] = useState<CompensationEstimate[]>([])

  const [parcelId, setParcelId] = useState('')
  const [proposedArea, setProposedArea] = useState('')
  const [indicativeRate, setIndicativeRate] = useState('')
  const [additionalAmount, setAdditionalAmount] = useState('0')
  const [remarks, setRemarks] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const parcelPath = `/api/v1/projects/${projectId}/parcels`
  const estimatePath =
    `/api/v1/projects/${projectId}/compensation-estimates`

  const canCreate = user?.role === 'PROJECT_OFFICER'

  useEffect(() => {
    let active = true

    setLoading(true)
    setError('')
    setParcels([])
    setEstimates([])
    setParcelId('')

    Promise.all([
      apiFetch(parcelPath),
      apiFetch(estimatePath),
    ])
      .then(async ([parcelResponse, estimateResponse]) => {
        if (!parcelResponse.ok) {
          throw new Error(await errorMessage(parcelResponse))
        }

        if (!estimateResponse.ok) {
          throw new Error(await errorMessage(estimateResponse))
        }

        const parcelData =
          (await parcelResponse.json()) as Parcel[]

        const estimateData =
          (await estimateResponse.json()) as CompensationEstimate[]

        return { parcelData, estimateData }
      })
      .then(({ parcelData, estimateData }) => {
        if (!active) return

        setParcels(parcelData)
        setEstimates(estimateData)
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
  }, [parcelPath, estimatePath])


  async function refreshEstimates() {
    setLoading(true)
    setError('')

    try {
      const response = await apiFetch(estimatePath)

      if (!response.ok) {
        throw new Error(await errorMessage(response))
      }

      const data =
        (await response.json()) as CompensationEstimate[]

      setEstimates(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load estimates.'
      )
    } finally {
      setLoading(false)
    }
  }


  async function submitEstimate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canCreate || saving || !parcelId) return

    const parsedArea = Number(proposedArea)
    const parsedRate = Number(indicativeRate)
    const parsedAdditional = Number(additionalAmount)

    if (
      !Number.isFinite(parsedArea) ||
      !Number.isFinite(parsedRate) ||
      !Number.isFinite(parsedAdditional) ||
      parsedArea <= 0 ||
      parsedRate <= 0 ||
      parsedAdditional < 0
    ) {
      setError('Enter valid, positive area and rate values.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const response = await apiFetch(estimatePath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parcel_id: Number(parcelId),
          proposed_area_ha: proposedArea,
          indicative_rate_per_ha: indicativeRate,
          additional_planning_amount: additionalAmount,
          remarks: remarks.trim() || null,
        }),
      })

      if (!response.ok) {
        throw new Error(await errorMessage(response))
      }

      const saved =
        (await response.json()) as CompensationEstimate

      setEstimates((current) => [
        saved,
        ...current.filter((item) => item.id !== saved.id),
      ])

      setProposedArea('')
      setIndicativeRate('')
      setAdditionalAmount('0')
      setRemarks('')

      setNotice(
        `Estimate #${saved.id} saved. Calculated total: ` +
        `${money(saved.estimated_total)}.`
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save estimate.'
      )
    } finally {
      setSaving(false)
    }
  }


  const parcelNames = new Map(
    parcels.map((parcel) => [
      parcel.id,
      `${parcel.survey_number} — ${parcel.village}`,
    ])
  )

  const approximateTotal =
    Number(proposedArea) * Number(indicativeRate) +
    Number(additionalAmount || '0')

  const showPreview =
    proposedArea !== '' &&
    indicativeRate !== '' &&
    Number.isFinite(approximateTotal) &&
    Number(proposedArea) > 0 &&
    Number(indicativeRate) > 0 &&
    Number(additionalAmount || '0') >= 0


  return (
    <section className="panel compensation-section">
      <div className="panel-heading">
        <div>
          <h2>Compensation planning</h2>
          <p>
            Parcel-linked indicative estimates for project planning.
          </p>
        </div>

        <button
          type="button"
          className="button button-secondary"
          disabled={loading || saving}
          onClick={() => void refreshEstimates()}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="compensation-disclaimer">
        Planning estimates only. Values entered here are not
        statutory compensation awards, verified land valuations,
        or payment authorizations.
      </div>

      {error && (
        <div
          className="compensation-message compensation-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          className="compensation-message compensation-success"
          role="status"
        >
          {notice}
        </div>
      )}

      {canCreate && (
        <form
          className="compensation-form"
          onSubmit={(event) => void submitEstimate(event)}
        >
          <h3>Create planning estimate</h3>

          <div className="compensation-form-grid">
            <div className="form-field compensation-full-width">
              <label htmlFor="estimate-parcel">
                Registered land parcel
              </label>

              <select
                id="estimate-parcel"
                required
                value={parcelId}
                disabled={saving || loading || parcels.length === 0}
                onChange={(event) =>
                  setParcelId(event.target.value)
                }
              >
                <option value="">Select a parcel</option>

                {parcels.map((parcel) => (
                  <option
                    key={parcel.id}
                    value={parcel.id}
                  >
                    {parcel.survey_number} — {parcel.village}
                    {' '} (ID {parcel.id})
                  </option>
                ))}
              </select>

              {parcels.length === 0 && !loading && (
                <p className="compensation-help">
                  Register a parcel in the GIS module before
                  creating a compensation estimate.
                </p>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="estimate-area">
                Proposed area (hectares)
              </label>

              <input
                id="estimate-area"
                type="number"
                min="0.0001"
                max="9999999999.9999"
                step="0.0001"
                required
                value={proposedArea}
                disabled={saving}
                onChange={(event) =>
                  setProposedArea(event.target.value)
                }
                placeholder="0.0000"
              />
            </div>

            <div className="form-field">
              <label htmlFor="estimate-rate">
                Indicative rate per hectare (INR)
              </label>

              <input
                id="estimate-rate"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={indicativeRate}
                disabled={saving}
                onChange={(event) =>
                  setIndicativeRate(event.target.value)
                }
                placeholder="0.00"
              />
            </div>

            <div className="form-field">
              <label htmlFor="estimate-additional">
                Additional planning amount (INR)
              </label>

              <input
                id="estimate-additional"
                type="number"
                min="0"
                step="0.01"
                required
                value={additionalAmount}
                disabled={saving}
                onChange={(event) =>
                  setAdditionalAmount(event.target.value)
                }
              />
            </div>

            <div className="form-field compensation-full-width">
              <label htmlFor="estimate-remarks">
                Remarks (optional)
              </label>

              <textarea
                id="estimate-remarks"
                rows={3}
                maxLength={500}
                value={remarks}
                disabled={saving}
                onChange={(event) =>
                  setRemarks(event.target.value)
                }
                placeholder="Explain the indicative inputs used"
              />
            </div>
          </div>

          {showPreview && (
            <div className="compensation-preview">
              <span>Approximate total before saving</span>
              <strong>{money(approximateTotal)}</strong>
              <span>
                Final stored total is calculated by the backend.
              </span>
            </div>
          )}

          <div className="compensation-form-footer">
            <span>
              Saved estimates remain in the register as
              separate planning records.
            </span>

            <button
              type="submit"
              className="button button-primary"
              disabled={saving || loading || !parcelId}
            >
              {saving ? 'Saving...' : 'Save estimate'}
            </button>
          </div>
        </form>
      )}

      <div className="compensation-register">
        <div className="compensation-register-heading">
          <div>
            <h3>Saved estimates</h3>
            <p>
              {loading
                ? 'Loading estimates...'
                : `${estimates.length} planning record(s)`}
            </p>
          </div>
        </div>

        {!loading && estimates.length === 0 ? (
          <p className="compensation-empty">
            No estimates have been saved for this project.
          </p>
        ) : (
          <div className="compensation-table-wrapper">
            <table className="compensation-table">
              <thead>
                <tr>
                  <th scope="col">Estimate</th>
                  <th scope="col">Parcel</th>
                  <th scope="col">Area</th>
                  <th scope="col">Rate / ha</th>
                  <th scope="col">Additional</th>
                  <th scope="col">Estimated total</th>
                  <th scope="col">Recorded by</th>
                </tr>
              </thead>

              <tbody>
                {estimates.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>#{item.id}</strong>
                      <span>
                        {new Date(item.created_at).toLocaleString(
                          'en-IN',
                          {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }
                        )}
                      </span>
                      {item.remarks && <span>{item.remarks}</span>}
                    </td>

                    <td>
                      {parcelNames.get(item.parcel_id) ??
                        `Parcel ID ${item.parcel_id}`}
                    </td>

                    <td>{area(item.proposed_area_ha)} ha</td>

                    <td>{money(item.indicative_rate_per_ha)}</td>

                    <td>
                      {money(item.additional_planning_amount)}
                    </td>

                    <td>
                      <strong>{money(item.estimated_total)}</strong>
                    </td>

                    <td>{item.created_by_username}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}