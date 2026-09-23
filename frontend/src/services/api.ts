import type { Project, ProjectInput } from '../types/project'

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:8001'

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, options)

  if (!response.ok) {
    let message = `Request failed (${response.status}).`

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
      // Retain the HTTP error message.
    }

    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export function getProjects(): Promise<Project[]> {
  return request<Project[]>('/api/v1/projects')
}

export function getProject(id: number): Promise<Project> {
  return request<Project>(`/api/v1/projects/${id}`)
}

export function createProject(
  input: ProjectInput
): Promise<Project> {
  return request<Project>('/api/v1/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
}

export function formatArea(value: number): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function projectReference(id: number): string {
  return `NLAM-${String(id).padStart(6, '0')}`
}