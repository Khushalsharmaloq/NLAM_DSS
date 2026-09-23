import { useEffect, useState } from 'react'

import { Link } from 'react-router-dom'

import ProjectTable from '../components/projects/ProjectTable'

import {
  formatArea,
  getProjects,
} from '../services/api'

import type { Project } from '../types/project'

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    getProjects()
      .then((data) => {
        if (active) setProjects(data)
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
  }, [])

  const totalArea = projects.reduce(
    (sum, project) => sum + Number(project.proposed_area_ha),
    0
  )

  const draftProjects = projects.filter(
    (project) => project.status === 'DRAFT'
  ).length

  const states = new Set(
    projects.map((project) => project.state)
  )

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            OPERATIONS OVERVIEW
          </div>

          <h1>Land acquisition overview</h1>

          <p>
            Project registration and proposed land area
            across the current demonstration dataset.
          </p>
        </div>

        <Link
          className="button button-primary"
          to="/projects/new"
        >
          Create project
        </Link>
      </div>

      {error && (
        <div className="message message-error" role="alert">
          {error}
        </div>
      )}

      <section
        className="summary-grid"
        aria-label="Project summary"
      >
        <div className="summary-item">
          <div className="metric-label">
            REGISTERED PROJECTS
          </div>

          <div className="metric-value">
            {loading ? '...' : projects.length}
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
            {loading ? '...' : formatArea(totalArea)}
          </div>

          <div className="metric-note">
            Hectares
          </div>
        </div>

        <div className="summary-item">
          <div className="metric-label">
            DRAFT PROJECTS
          </div>

          <div className="metric-value">
            {loading ? '...' : draftProjects}
          </div>

          <div className="metric-note">
            Not yet submitted
          </div>
        </div>

        <div className="summary-item">
          <div className="metric-label">
            STATES REPRESENTED
          </div>

          <div className="metric-value">
            {loading ? '...' : states.size}
          </div>

          <div className="metric-note">
            Based on registered projects
          </div>
        </div>
      </section>

      <section className="panel">
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
        <strong>Data scope:</strong> Dashboard figures are
        calculated from registered project records.
        Compensation, acquisition, and possession
        figures will be introduced when their
        operational modules are implemented.
      </div>
    </>
  )
}