import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

import ProjectTable from '../components/projects/ProjectTable'

import {
  apiFetch,
  formatArea,
  getProjects,
} from '../services/api'

import type { Project } from '../types/project'

import './DashboardPage.css'


type ProjectStatusCounts = Record<string, number>
type ParcelStageCounts = Record<string, number>

type MisOverview = {
  project_count: number
  proposed_area_ha: string
  states_count: number
  project_status_counts: ProjectStatusCounts

  parcel_count: number
  parcel_stage_counts: ParcelStageCounts

  compensation_estimate_records: number
  compensation_parcels_with_estimates: number
  compensation_latest_per_parcel_total_inr: string

  rr_household_count: number
  rr_affected_persons: number
  rr_relocation_anticipated_households: number
  rr_indicative_assistance_total_inr: string
}


const projectStatuses = [
  ['DRAFT', 'Draft'],
  ['SUBMITTED', 'Submitted'],
  ['UNDER_REVIEW', 'Under review'],
  ['APPROVED', 'Approved'],
  ['RETURNED', 'Returned'],
  ['REJECTED', 'Rejected'],
] as const


const parcelStages = [
  ['REGISTERED', 'Registered'],
  ['SURVEY_RECORDED', 'Survey recorded'],
  ['DOCUMENTATION_RECORDED', 'Documentation recorded'],
  ['POSSESSION_RECORDED', 'Possession recorded (demo)'],
] as const


function money(value: string): string {
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
      'detail' in body &&
      typeof body.detail === 'string'
    ) {
      return body.detail
    }
  } catch {
    // Use the HTTP status if the API supplies no JSON detail.
  }

  return `MIS request failed (HTTP ${response.status}).`
}


export default function DashboardPage() {
  const { user } = useAuth()

  const [projects, setProjects] = useState<Project[]>([])
  const [overview, setOverview] = useState<MisOverview | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')


  useEffect(() => {
    let active = true

    async function loadDashboard() {
      setLoading(true)
      setError('')

      try {
        const [projectData, misResponse] = await Promise.all([
          getProjects(),
          apiFetch('/api/v1/mis/overview'),
        ])

        if (!misResponse.ok) {
          throw new Error(await readError(misResponse))
        }

        const misData =
          (await misResponse.json()) as MisOverview

        if (!active) return

        setProjects(projectData)
        setOverview(misData)
      } catch (err) {
        if (!active) return

        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load dashboard information.'
        )
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDashboard()

    return () => {
      active = false
    }
  }, [])


  const showFigures = !loading && overview !== null

  const reportedProjectStatuses = overview
    ? Object.entries(overview.project_status_counts).filter(
        ([status]) =>
          !projectStatuses.some(([knownStatus]) => knownStatus === status)
      )
    : []

  const reportedParcelStages = overview
    ? Object.entries(overview.parcel_stage_counts).filter(
        ([stage]) =>
          !parcelStages.some(([knownStage]) => knownStage === stage)
      )
    : []


  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            OPERATIONS OVERVIEW
          </div>

          <h1>Land acquisition overview</h1>

          <p>
            Live summary of the current demonstration dataset:
            projects, parcels, compensation planning, R&amp;R
            planning, and parcel progress.
          </p>
        </div>

        {user?.role === 'PROJECT_OFFICER' && (
          <Link
            className="button button-primary"
            to="/projects/new"
          >
            Create project
          </Link>
        )}
      </div>

      {error && (
        <div
          className="message message-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <section
        className="summary-grid"
        aria-label="Project and land summary"
      >
        <div className="summary-item">
          <div className="metric-label">
            REGISTERED PROJECTS
          </div>

          <div className="metric-value">
            {showFigures ? overview.project_count : '—'}
          </div>

          <div className="metric-note">
            Total project records
          </div>
        </div>

        <div className="summary-item">
          <div className="metric-label">
            PROPOSED LAND AREA
          </div>

          <div className="metric-value">
            {showFigures
              ? formatArea(Number(overview.proposed_area_ha))
              : '—'}
          </div>

          <div className="metric-note">
            Hectares proposed across projects
          </div>
        </div>

        <div className="summary-item">
          <div className="metric-label">
            REGISTERED PARCELS
          </div>

          <div className="metric-value">
            {showFigures ? overview.parcel_count : '—'}
          </div>

          <div className="metric-note">
            GIS parcel records
          </div>
        </div>

        <div className="summary-item">
          <div className="metric-label">
            STATES REPRESENTED
          </div>

          <div className="metric-value">
            {showFigures ? overview.states_count : '—'}
          </div>

          <div className="metric-note">
            Based on registered projects
          </div>
        </div>
      </section>

      <div className="dashboard-mis-grid">
        <section className="panel dashboard-mis-panel">
          <div className="panel-heading">
            <div>
              <h2>Project workflow status</h2>
              <p>Current status of each registered project.</p>
            </div>
          </div>

          <div className="dashboard-mis-rows">
            {projectStatuses.map(([status, label]) => (
              <div className="dashboard-mis-row" key={status}>
                <span>{label}</span>
                <strong>
                  {showFigures
                    ? overview.project_status_counts[status] ?? 0
                    : '—'}
                </strong>
              </div>
            ))}

            {reportedProjectStatuses.map(([status, count]) => (
              <div className="dashboard-mis-row" key={status}>
                <span>{status.replaceAll('_', ' ')}</span>
                <strong>{showFigures ? count : '—'}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="panel dashboard-mis-panel">
          <div className="panel-heading">
            <div>
              <h2>Parcel acquisition stages</h2>
              <p>
                Latest recorded stage for each registered parcel.
              </p>
            </div>
          </div>

          <div className="dashboard-mis-rows">
            {parcelStages.map(([stage, label]) => (
              <div className="dashboard-mis-row" key={stage}>
                <span>{label}</span>
                <strong>
                  {showFigures
                    ? overview.parcel_stage_counts[stage] ?? 0
                    : '—'}
                </strong>
              </div>
            ))}

            {reportedParcelStages.map(([stage, count]) => (
              <div className="dashboard-mis-row" key={stage}>
                <span>{stage.replaceAll('_', ' ')}</span>
                <strong>{showFigures ? count : '—'}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="dashboard-mis-grid">
        <section className="panel dashboard-mis-panel">
          <div className="panel-heading">
            <div>
              <h2>Compensation planning</h2>
              <p>Indicative parcel-linked planning records.</p>
            </div>
          </div>

          <div className="dashboard-mis-financial">
            <span>CURRENT PLANNING TOTAL</span>

            <strong>
              {showFigures
                ? money(
                    overview.compensation_latest_per_parcel_total_inr
                  )
                : '—'}
            </strong>

            <p>
              Uses the latest saved estimate for each parcel.
              Historical estimates for the same parcel are not
              added together.
            </p>
          </div>

          <div className="dashboard-mis-rows">
            <div className="dashboard-mis-row">
              <span>Saved estimate records</span>
              <strong>
                {showFigures
                  ? overview.compensation_estimate_records
                  : '—'}
              </strong>
            </div>

            <div className="dashboard-mis-row">
              <span>Parcels with estimates</span>
              <strong>
                {showFigures
                  ? overview.compensation_parcels_with_estimates
                  : '—'}
              </strong>
            </div>
          </div>

          <p className="dashboard-mis-footnote">
            Not an approved compensation award or payment total.
          </p>
        </section>

        <section className="panel dashboard-mis-panel">
          <div className="panel-heading">
            <div>
              <h2>R&amp;R planning</h2>
              <p>Synthetic affected-household planning records.</p>
            </div>
          </div>

          <div className="dashboard-mis-financial">
            <span>INDICATIVE ASSISTANCE TOTAL</span>

            <strong>
              {showFigures
                ? money(overview.rr_indicative_assistance_total_inr)
                : '—'}
            </strong>

            <p>
              Sum of indicative assistance entered in the
              household-planning register.
            </p>
          </div>

          <div className="dashboard-mis-rows">
            <div className="dashboard-mis-row">
              <span>Household records</span>
              <strong>
                {showFigures ? overview.rr_household_count : '—'}
              </strong>
            </div>

            <div className="dashboard-mis-row">
              <span>Recorded affected persons</span>
              <strong>
                {showFigures ? overview.rr_affected_persons : '—'}
              </strong>
            </div>

            <div className="dashboard-mis-row">
              <span>Relocation anticipated</span>
              <strong>
                {showFigures
                  ? overview.rr_relocation_anticipated_households
                  : '—'}
              </strong>
            </div>
          </div>

          <p className="dashboard-mis-footnote">
            Not verified eligibility, approved assistance,
            or a payment total.
          </p>
        </section>
      </div>

      <section className="panel dashboard-recent-projects">
        <div className="panel-heading">
          <div>
            <h2>Recent project registrations</h2>

            <p>
              Latest records retrieved from the project database.
            </p>
          </div>

          <Link
            className="button button-secondary"
            to="/projects"
          >
            View register
          </Link>
        </div>

        <ProjectTable
          projects={projects.slice(0, 5)}
          loading={loading}
        />
      </section>

      <div className="information-note">
        <strong>Data scope:</strong> Figures are calculated
        from current records in the local demonstration database.
        Proposed area is not acquired area. Compensation and
        R&amp;R amounts are indicative planning values, not
        approved awards or payments. Possession stages refer
        only to synthetic progress events.
      </div>
    </>
  )
}