import { useEffect, useState } from 'react'

import {
  Link,
  useSearchParams,
} from 'react-router-dom'

import ProjectTable from '../components/projects/ProjectTable'
import { useAuth } from '../auth/AuthContext'

import { getProjects } from '../services/api'

import type { Project } from '../types/project'

export default function ProjectListPage() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get('search') || ''
  const stateFilter = searchParams.get('state') || ''

  useEffect(() => {
    let active = true

    getProjects()
      .then((data) => {
        if (active) {
          setProjects(data)
          setError('')
        }
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
  }, [refreshKey])

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams)

    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }

    setSearchParams(next, { replace: true })
  }

  const states = Array.from(
    new Set(projects.map((project) => project.state))
  ).sort()

  const filteredProjects = projects.filter((project) => {
    const query = search.toLowerCase().trim()

    const matchesSearch =
      project.name.toLowerCase().includes(query) ||
      project.district.toLowerCase().includes(query) ||
      String(project.id).includes(query)

    const matchesState =
      !stateFilter || project.state === stateFilter

    return matchesSearch && matchesState
  })

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            PROJECT MANAGEMENT
          </div>

          <h1>Project register</h1>

          <p>
            Search, review, and manage registered
            land acquisition projects.
          </p>
        </div>

        {user?.role === 'PROJECT_OFFICER' && <Link
          className="button button-primary"
          to="/projects/new"
        >
          Create project
        </Link>}
      </div>

      {error && (
        <div className="message message-error" role="alert">
          {error}
        </div>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Registered projects</h2>

            <p>
              {filteredProjects.length} matching records
            </p>
          </div>

          <button
            type="button"
            className="button button-secondary"
            disabled={loading}
            onClick={() => {
              setLoading(true)
              setRefreshKey((current) => current + 1)
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="filter-bar">
          <div className="filter-field">
            <label htmlFor="project-search">
              Search projects
            </label>

            <input
              id="project-search"
              value={search}
              onChange={(event) =>
                updateFilter('search', event.target.value)
              }
              placeholder="Project name, district or ID"
            />
          </div>

          <div className="filter-field">
            <label htmlFor="state-filter">
              State
            </label>

            <select
              id="state-filter"
              value={stateFilter}
              onChange={(event) =>
                updateFilter('state', event.target.value)
              }
            >
              <option value="">All states</option>

              {states.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>
        </div>

        <ProjectTable
          projects={filteredProjects}
          loading={loading}
        />
      </section>
    </>
  )
}
