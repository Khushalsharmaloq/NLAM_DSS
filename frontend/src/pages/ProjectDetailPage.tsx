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
import ProjectWorkflow from '../components/workflow/ProjectWorkflow'
import ProjectDocuments from '../components/documents/ProjectDocuments'
import ProjectCompensation from '../components/compensation/ProjectCompensation'
import ProjectRR from '../components/rr/ProjectRR'

export default function ProjectDetailPage() {
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

            <span className="status-badge">
              {project.status}
            </span>
          </div>

          <section className="panel">
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
            </dl>
          </section>

          <ProjectWorkflow
            projectId={project.id}
            onStatusChange={(status) =>
              setProject((current) =>
                current ? { ...current, status } : current
              )
            }
          />
          <ProjectDocuments projectId={project.id} />

          <ProjectCompensation projectId={project.id} />

          <ProjectRR projectId={project.id} />

          <div className="information-note">
            Land parcel management is available through
            the project GIS map. Workflow, documents,
            compensation, rehabilitation, and possession
            modules will be added during subsequent
            development phases.
          </div>
        </>
      )}
    </>
  )
}