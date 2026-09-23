import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'

import { useAuth } from '../../auth/AuthContext'
import { apiFetch, sendJson } from '../../services/api'

import './ProjectRR.css'

type Parcel = {
  id: number
  survey_number: string
  village: string
}

type RRHousehold = {
  id: number
  project_id: number
  parcel_id: number | null
  household_reference: string
  village: string
  affected_persons: number
  impact_type: string
  relocation_required: boolean
  assistance_type: string
  indicative_assistance_inr: string
  remarks: string | null
  progress_status: string
  created_by_username: string
  created_at: string
}

type ImpactType = 'PHYSICAL' | 'ECONOMIC' | 'BOTH'

type AssistanceType =
  | 'HOUSING'
  | 'LIVELIHOOD'
  | 'FINANCIAL'
  | 'COMBINED'
  | 'TO_BE_ASSESSED'

const impactOptions: { value: ImpactType; label: string }[] = [
  { value: 'PHYSICAL', label: 'Physical displacement' },
  { value: 'ECONOMIC', label: 'Economic impact' },
  { value: 'BOTH', label: 'Physical and economic impact' },
]

const assistanceOptions: {
  value: AssistanceType
  label: string
}[] = [
  { value: 'TO_BE_ASSESSED', label: 'To be assessed' },
  { value: 'HOUSING', label: 'Housing assistance' },
  { value: 'LIVELIHOOD', label: 'Livelihood assistance' },
  { value: 'FINANCIAL', label: 'Indicative financial assistance' },
  { value: 'COMBINED', label: 'Combined assistance' },
]

function optionLabel(
  options: { value: string; label: string }[],
  value: string
): string {
  return options.find((option) => option.value === value)?.label ??
    value.replaceAll('_', ' ')
}

function formatMoney(value: string | number): string {
  return Number(value).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
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
    // Keep the HTTP status message.
  }

  return `Request failed (HTTP ${response.status}).`
}

export default function ProjectRR({
  projectId,
}: {
  projectId: number
}) {
  const { user } = useAuth()
  const canCreate = user?.role === 'PROJECT_OFFICER'
  const canAdvance = ['DISTRICT_AUTHORITY', 'STATE_AUTHORITY', 'SYSTEM_ADMIN'].includes(user?.role ?? '')

  const [records, setRecords] = useState<RRHousehold[]>([])
  const [parcels, setParcels] = useState<Parcel[]>([])

  const [reference, setReference] = useState('')
  const [village, setVillage] = useState('')
  const [parcelId, setParcelId] = useState('')
  const [affectedPersons, setAffectedPersons] = useState('1')
  const [impactType, setImpactType] = useState<ImpactType>('ECONOMIC')
  const [relocationRequired, setRelocationRequired] = useState(false)
  const [assistanceType, setAssistanceType] =
    useState<AssistanceType>('TO_BE_ASSESSED')
  const [assistanceAmount, setAssistanceAmount] = useState('0')
  const [remarks, setRemarks] = useState('')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const rrPath = `/api/v1/projects/${projectId}/rr-households`
  const parcelsPath = `/api/v1/projects/${projectId}/parcels`

  useEffect(() => {
    let active = true

    setLoading(true)
    setError('')
    setNotice('')
    setRecords([])
    setParcels([])

    Promise.all([
      apiFetch(rrPath),
      apiFetch(parcelsPath),
    ])
      .then(async ([rrResponse, parcelsResponse]) => {
        if (!rrResponse.ok) {
          throw new Error(await readError(rrResponse))
        }

        if (!parcelsResponse.ok) {
          throw new Error(await readError(parcelsResponse))
        }

        return {
          rrData: (await rrResponse.json()) as RRHousehold[],
          parcelData: (await parcelsResponse.json()) as Parcel[],
        }
      })
      .then(({ rrData, parcelData }) => {
        if (!active) return

        setRecords(rrData)
        setParcels(parcelData)
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
  }, [rrPath, parcelsPath])

  async function refreshRecords() {
    setLoading(true)
    setError('')

    try {
      const response = await apiFetch(rrPath)

      if (!response.ok) {
        throw new Error(await readError(response))
      }

      setRecords((await response.json()) as RRHousehold[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to retrieve R&R records.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function submitRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canCreate || saving) return

    const cleanedReference = reference.trim().toUpperCase()
    const cleanedVillage = village.trim()

    if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(cleanedReference)) {
      setError(
        'Household reference must contain 3–40 letters, numbers, hyphens, or underscores.'
      )
      return
    }

    if (cleanedVillage.length < 2) {
      setError('Enter a village name.')
      return
    }

    const persons = Number(affectedPersons)
    const amount = Number(assistanceAmount)

    if (
      !Number.isInteger(persons) ||
      persons < 1 ||
      persons > 100 ||
      !Number.isFinite(amount) ||
      amount < 0
    ) {
      setError('Enter a valid affected-person count and assistance amount.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const response = await apiFetch(rrPath, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          household_reference: cleanedReference,
          village: cleanedVillage,
          parcel_id: parcelId ? Number(parcelId) : null,
          affected_persons: persons,
          impact_type: impactType,
          relocation_required: relocationRequired,
          assistance_type: assistanceType,
          indicative_assistance_inr: assistanceAmount,
          remarks: remarks.trim() || null,
        }),
      })

      if (!response.ok) {
        throw new Error(await readError(response))
      }

      const saved = (await response.json()) as RRHousehold

      setRecords((current) => [
        saved,
        ...current.filter((item) => item.id !== saved.id),
      ])

      setReference('')
      setVillage('')
      setParcelId('')
      setAffectedPersons('1')
      setImpactType('ECONOMIC')
      setRelocationRequired(false)
      setAssistanceType('TO_BE_ASSESSED')
      setAssistanceAmount('0')
      setRemarks('')

      setNotice(
        `Household planning record ${saved.household_reference} registered.`
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to register the household-planning record.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function advance(record: RRHousehold) {
    const next: Record<string, string> = {
      IDENTIFIED: 'VERIFIED', VERIFIED: 'ASSISTANCE_APPROVED',
      ASSISTANCE_APPROVED: 'ASSISTANCE_DELIVERED',
    }
    if (!next[record.progress_status]) return
    setSaving(true); setError(''); setNotice('')
    try {
      await sendJson(`/api/v1/projects/${projectId}/rr-households/${record.id}/progress`,
        { status: next[record.progress_status] }, 'PATCH')
      setNotice(`R&R stage advanced for ${record.household_reference}.`)
      await refreshRecords()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to advance R&R progress.')
    } finally { setSaving(false) }
  }

  const parcelLabels = new Map(
    parcels.map((parcel) => [
      parcel.id,
      `${parcel.survey_number} — ${parcel.village}`,
    ])
  )

  const recordedPersons = records.reduce(
    (total, record) => total + record.affected_persons,
    0
  )

  const relocationRecords = records.filter(
    (record) => record.relocation_required
  ).length

  return (
    <section className="panel rr-section">
      <div className="panel-heading">
        <div>
          <h2>Rehabilitation &amp; Resettlement planning</h2>
          <p>
            Synthetic affected-household records and indicative
            assistance planning.
          </p>
        </div>

        <button
          type="button"
          className="button button-secondary"
          onClick={() => void refreshRecords()}
          disabled={loading || saving}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="rr-disclaimer">
        Demonstration planning data only. These records do not
        establish household eligibility, approved assistance,
        relocation orders, or payment entitlements. Do not enter
        real names, identity numbers, addresses, or bank details.
      </div>

      {error && (
        <div className="rr-message rr-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="rr-message rr-success" role="status">
          {notice}
        </div>
      )}

      <div className="rr-summary">
        <div>
          <span>HOUSEHOLD RECORDS</span>
          <strong>{loading ? '—' : records.length}</strong>
        </div>

        <div>
          <span>RECORDED AFFECTED PERSONS</span>
          <strong>{loading ? '—' : recordedPersons}</strong>
        </div>

        <div>
          <span>RELOCATION ANTICIPATED</span>
          <strong>{loading ? '—' : relocationRecords}</strong>
        </div>
      </div>

      {canCreate && (
        <form
          className="rr-form"
          onSubmit={(event) => void submitRecord(event)}
        >
          <h3>Register synthetic household</h3>

          <div className="rr-form-grid">
            <div className="form-field">
              <label htmlFor="rr-reference">
                Household reference
              </label>

              <input
                id="rr-reference"
                required
                minLength={3}
                maxLength={40}
                pattern="[A-Za-z0-9][A-Za-z0-9_-]*"
                value={reference}
                disabled={saving}
                onChange={(event) =>
                  setReference(event.target.value)
                }
                placeholder="DEMO-HH-002"
              />
            </div>

            <div className="form-field">
              <label htmlFor="rr-village">Village</label>

              <input
                id="rr-village"
                required
                minLength={2}
                maxLength={100}
                value={village}
                disabled={saving}
                onChange={(event) =>
                  setVillage(event.target.value)
                }
                placeholder="Synthetic demonstration village"
              />
            </div>

            <div className="form-field">
              <label htmlFor="rr-parcel">
                Related land parcel (optional)
              </label>

              <select
                id="rr-parcel"
                value={parcelId}
                disabled={saving || loading}
                onChange={(event) =>
                  setParcelId(event.target.value)
                }
              >
                <option value="">No parcel linked</option>

                {parcels.map((parcel) => (
                  <option key={parcel.id} value={parcel.id}>
                    {parcel.survey_number} — {parcel.village}
                    {' '} (ID {parcel.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="rr-persons">
                Number of affected persons
              </label>

              <input
                id="rr-persons"
                type="number"
                required
                min="1"
                max="100"
                step="1"
                value={affectedPersons}
                disabled={saving}
                onChange={(event) =>
                  setAffectedPersons(event.target.value)
                }
              />
            </div>

            <div className="form-field">
              <label htmlFor="rr-impact">Impact type</label>

              <select
                id="rr-impact"
                value={impactType}
                disabled={saving}
                onChange={(event) =>
                  setImpactType(event.target.value as ImpactType)
                }
              >
                {impactOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="rr-assistance">
                Indicative assistance type
              </label>

              <select
                id="rr-assistance"
                value={assistanceType}
                disabled={saving}
                onChange={(event) =>
                  setAssistanceType(
                    event.target.value as AssistanceType
                  )
                }
              >
                {assistanceOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="rr-amount">
                Indicative assistance amount (INR)
              </label>

              <input
                id="rr-amount"
                type="number"
                required
                min="0"
                step="0.01"
                value={assistanceAmount}
                disabled={saving}
                onChange={(event) =>
                  setAssistanceAmount(event.target.value)
                }
              />
            </div>

            <div className="rr-check-field">
              <label htmlFor="rr-relocation">
                <input
                  id="rr-relocation"
                  type="checkbox"
                  checked={relocationRequired}
                  disabled={saving}
                  onChange={(event) =>
                    setRelocationRequired(event.target.checked)
                  }
                />
                Relocation anticipated
              </label>

              <p>
                Planning indicator only; not a relocation decision.
              </p>
            </div>

            <div className="form-field rr-full-width">
              <label htmlFor="rr-remarks">
                Planning remarks (optional)
              </label>

              <textarea
                id="rr-remarks"
                rows={3}
                maxLength={500}
                value={remarks}
                disabled={saving}
                onChange={(event) =>
                  setRemarks(event.target.value)
                }
                placeholder="Synthetic planning remarks only"
              />
            </div>
          </div>

          <div className="rr-form-footer">
            <span>
              Use a unique synthetic reference for each record.
            </span>

            <button
              type="submit"
              className="button button-primary"
              disabled={saving || loading}
            >
              {saving ? 'Registering...' : 'Register household'}
            </button>
          </div>
        </form>
      )}

      <div className="rr-register">
        <div className="rr-register-heading">
          <h3>R&amp;R household register</h3>
          <p>
            {loading
              ? 'Loading records...'
              : `${records.length} household-planning record(s)`}
          </p>
        </div>

        {!loading && records.length === 0 ? (
          <p className="rr-empty">
            No household-planning records are registered
            for this project.
          </p>
        ) : (
          <div className="rr-table-wrapper">
            <table className="rr-table">
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Village / parcel</th>
                  <th scope="col">Persons</th>
                  <th scope="col">Impact</th>
                  <th scope="col">Relocation</th>
                  <th scope="col">Assistance plan</th>
                  <th scope="col">Progress</th>
                  <th scope="col">Recorded by</th>
                </tr>
              </thead>

              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong>
                        {record.household_reference}
                      </strong>

                      <span>
                        {new Date(record.created_at).toLocaleString(
                          'en-IN',
                          {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }
                        )}
                      </span>

                      {record.remarks && (
                        <span>{record.remarks}</span>
                      )}
                    </td>

                    <td>
                      <strong>{record.village}</strong>
                      <span>
                        {record.parcel_id === null
                          ? 'No linked parcel'
                          : parcelLabels.get(record.parcel_id) ??
                            `Parcel ID ${record.parcel_id}`}
                      </span>
                    </td>

                    <td>{record.affected_persons}</td>

                    <td>
                      {optionLabel(
                        impactOptions,
                        record.impact_type
                      )}
                    </td>

                    <td>
                      {record.relocation_required
                        ? 'Anticipated'
                        : 'Not anticipated'}
                    </td>

                    <td>
                      <strong>
                        {formatMoney(
                          record.indicative_assistance_inr
                        )}
                      </strong>

                      <span>
                        {optionLabel(
                          assistanceOptions,
                          record.assistance_type
                        )}
                      </span>
                    </td>

                    <td><span className="status-badge">{record.progress_status.replaceAll('_', ' ')}</span>
                      {canAdvance && record.progress_status !== 'ASSISTANCE_DELIVERED' &&
                        <button type="button" className="table-action" disabled={saving}
                          onClick={() => void advance(record)}>Advance stage</button>}</td>
                    <td>{record.created_by_username}</td>
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
