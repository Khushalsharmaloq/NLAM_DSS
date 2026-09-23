import { Link } from 'react-router-dom'

import type { Project } from '../../types/project'

import {
  formatArea,
  projectReference,
} from '../../services/api'

type Props = {
  projects: Project[]
  loading?: boolean
}

export default function ProjectTable({
  projects,
  loading = false,
}: Props) {
  if (loading) {
    return (
      <div className="table-message">
        Loading project records...
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="table-message">
        No projects found for the current selection.
      </div>
    )
  }

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Reference</th>
            <th scope="col">Project name</th>
            <th scope="col">State</th>
            <th scope="col">District</th>
            <th scope="col">Proposed area</th>
            <th scope="col">Status</th>
            <th scope="col">Action</th>
          </tr>
        </thead>

        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <td className="reference-cell">
                {projectReference(project.id)}
              </td>

              <td className="project-name-cell">
                {project.name}
              </td>

              <td>{project.state}</td>

              <td>{project.district}</td>

              <td>
                {formatArea(Number(project.proposed_area_ha))} ha
              </td>

              <td>
                <span className="status-badge">
                  {project.status}
                </span>
              </td>

              <td>
                <Link
                  className="table-action"
                  to={`/projects/${project.id}`}
                >
                  View details
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}