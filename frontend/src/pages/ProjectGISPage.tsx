import { useEffect, useState } from 'react'

import {
  Link,
  useParams,
} from 'react-router-dom'

import ParcelGIS from '../ParcelGIS'
import LandLookupPanel from '../components/integrations/LandLookupPanel'

import { getProject } from '../services/api'

import type { Project } from '../types/project'

export default function ProjectGISPage() {
  const { projectId } = useParams()

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const id = Number(projectId)

  const validId =
    typeof projectId === 'string' &&
    /^[1-9]\d*$/.test(projectId) &&
    Number.isSafeInteger(id)

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
      <Link
        className="back-button"
        to={`/projects/${id}`}
      >
        Back to project details
      </Link>

      {loading && (
        <p>Loading project GIS...</p>
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
                PROJECT / {project.id} / GIS
              </div>

              <h1>Land parcels and GIS</h1>

              <p>
                {project.name} · {project.district}, {project.state}
              </p>
            </div>

            <span className="status-badge">
              {project.status}
            </span>
          </div>

          <ParcelGIS
            key={project.id}
            projectId={project.id}
            projectStatus={project.status}
            proposedAreaHa={Number(project.proposed_area_ha)}
          />
          <LandLookupPanel projectId={project.id} />
        </>
      )}
    </>
  )
}
