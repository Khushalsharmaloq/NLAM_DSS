import { useEffect, useState } from 'react'

import {
  Link,
  useLocation,
  useParams,
} from 'react-router-dom'

import {
  formatArea,
  formatDate,
  getProject,
  projectReference,
} from '../services/api'

import type { Project } from '../types/project'
import { useAuth } from '../auth/AuthContext'
import ProjectWorkflow from '../components/workflow/ProjectWorkflow'
import ProjectDocuments from '../components/documents/ProjectDocuments'
import ProjectCompensation from '../components/compensation/ProjectCompensation'
import ProjectRR from '../components/rr/ProjectRR'
import ProjectPossession from '../components/possession/ProjectPossession'
import AcquisitionPanel from '../components/acquisition/AcquisitionPanel'
import TimelinePanel from '../components/milestones/TimelinePanel'
import AuditPanel from '../components/audit/AuditPanel'

import './ProjectDetailPage.css'

export default function ProjectDetailPage() {
  const { user } = useAuth()
  const { projectId } = useParams()

  const location = useLocation()

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const id = Number(projectId)

  const validId =
    typeof projectId === 'string' &&
    /^[1-9]\d*$/.test(projectId) &&
    Number.isSafeInteger(id)

  const notice =
    (
      location.state as {
        notice?: string
      } | null
    )?.notice

  useEffect(() => {
    if (!validId) return

    let active = true

    getProject(id)
      .then((data) => {
        if (active) setProject(data)
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
  }, [id, validId])

  if (!validId) {
    return (
      <div className="message message-error">
        Invalid project reference.
      </div>
    )
  }

  return (
    <>
      <Link className="back-button" to="/projects">
        Back to project register
      </Link>

      {notice && (
        <div className="message message-success" role="status">
          {notice}
        </div>
      )}

      {loading && (
        <p>Loading project details...</p>
      )}

      {error && (
        <div className="message message-error" role="alert">
          {error}
        </div>
      )}

      {!loading && project && (
        <>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                PROJECT / {project.id}
              </div>

              <h1>{project.name}</h1>

              <p>
                Project registration details and current
                administrative status.
              </p>
            </div>

            <div className="project-heading-actions">
              {user?.role === 'PROJECT_OFFICER' && ['DRAFT', 'RETURNED'].includes(project.status) &&
                <Link className="button button-secondary" to={`/projects/${project.id}/edit`}>Edit proposal</Link>}
              <span className="status-badge">{project.status}</span>
            </div>
          </div>

          <nav
            className="project-jump-nav"
            aria-label="Project sections"
          >
            <span className="project-jump-label">
              GO TO SECTION
            </span>

            <a href="#project-details">
              Project details
            </a>

            <a href="#project-workflow">
              Workflow
            </a>

            <a href="#project-documents">
              Documents
            </a>

            <a href="#project-acquisition">Notifications &amp; awards</a>

            <a href="#project-compensation">
              Compensation
            </a>

            <a href="#project-rr">
              R&R
            </a>

            <a href="#project-possession">
              Parcel progress
            </a>

            <a href="#project-timeline">Timeline</a>
            <a href="#project-audit">Audit history</a>

            <Link to={`/projects/${project.id}/gis`}>
              GIS map
            </Link>
          </nav>

          <section
            id="project-details"
            className="panel project-section-anchor"
          >
            <div className="panel-heading">
              <div>
                <h2>Project details</h2>

                <p>
                  Information stored in the project register.
                </p>
              </div>

              <Link
                className="button button-primary"
                to={`/projects/${project.id}/gis`}
              >
                Open GIS map
              </Link>
            </div>

            <dl className="detail-grid">
              <div>
                <dt>Project reference</dt>
                <dd>{projectReference(project.id)}</dd>
              </div>

              <div>
                <dt>Current status</dt>
                <dd>{project.status}</dd>
              </div>

              <div>
                <dt>State / Union Territory</dt>
                <dd>{project.state}</dd>
              </div>

              <div>
                <dt>District</dt>
                <dd>{project.district}</dd>
              </div>

              <div>
                <dt>Proposed land area</dt>
                <dd>
                  {formatArea(Number(project.proposed_area_ha))} ha
                </dd>
              </div>

              <div>
                <dt>Registration date</dt>
                <dd>{formatDate(project.created_at)}</dd>
              </div>
              <div><dt>Implementing agency</dt><dd>{project.agency || 'Not provided'}</dd></div>
              <div><dt>Sector</dt><dd>{project.sector || 'Not provided'}</dd></div>
              <div><dt>Target date</dt><dd>{project.target_date ? formatDate(project.target_date) : 'Not set'}</dd></div>
              <div><dt>Project officer</dt><dd>{project.owner_username || 'Legacy record'}</dd></div>
              {project.description && <div className="field-full"><dt>Description</dt><dd>{project.description}</dd></div>}
            </dl>
          </section>

          <div
            id="project-workflow"
            className="project-section-anchor"
          >
            <ProjectWorkflow
              projectId={project.id}
              onStatusChange={(status) =>
                setProject((current) =>
                  current ? { ...current, status } : current
                )
              }
            />
          </div>
          <div
            id="project-documents"
            className="project-section-anchor"
          >
            <ProjectDocuments projectId={project.id} />
          </div>

          <div
            id="project-compensation"
            className="project-section-anchor"
          >
            <ProjectCompensation projectId={project.id} />
          </div>

          <div id="project-acquisition" className="project-section-anchor">
            <AcquisitionPanel projectId={project.id} approved={project.status === 'APPROVED'} />
          </div>

          <div
            id="project-rr"
            className="project-section-anchor"
          >
            <ProjectRR projectId={project.id} />
          </div>

          <div
            id="project-possession"
            className="project-section-anchor"
          >
            <ProjectPossession projectId={project.id} />
          </div>

          <div id="project-timeline" className="project-section-anchor">
            <TimelinePanel projectId={project.id} />
          </div>

          <div id="project-audit" className="project-section-anchor">
            <AuditPanel projectId={project.id} />
          </div>

          <div className="information-note">
            <strong>Demonstration data:</strong> This project
            uses synthetic records. Compensation and R&amp;R
            amounts are indicative planning values, not
            approved awards or payments. Parcel progress
            records are demonstration milestones, not legal
            possession certificates.
          </div>
        </>
      )}
    </>
  )
}
