import { useEffect, useState } from 'react'

import type { FormEvent } from 'react'

import { useAuth } from '../../auth/AuthContext'
import { apiFetch } from '../../services/api'

import './ProjectDocuments.css'


type DocumentRecord = {
  id: number
  project_id: number
  document_type: string
  original_filename: string
  content_type: string
  size_bytes: number
  notes: string | null
  uploaded_by_username: string
  uploaded_at: string
}

const DOCUMENT_TYPES = [
  { value: 'PROPOSAL', label: 'Project proposal' },
  { value: 'LAND_RECORD', label: 'Land record' },
  { value: 'SURVEY_MAP', label: 'Survey map' },
  { value: 'CONSENT', label: 'Consent document' },
  { value: 'OTHER', label: 'Other supporting document' },
]

function formatType(value: string): string {
  return DOCUMENT_TYPES.find(
    (item) => item.value === value
  )?.label ?? value.replaceAll('_', ' ')
}

async function responseError(response: Response): Promise<string> {
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
    // Preserve the HTTP status message.
  }

  return `Document request failed (${response.status}).`
}

export default function ProjectDocuments({
  projectId,
}: {
  projectId: number
}) {
  const { user } = useAuth()

  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [documentType, setDocumentType] = useState('PROPOSAL')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [inputKey, setInputKey] = useState(0)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const basePath = `/api/v1/projects/${projectId}/documents`

  useEffect(() => {
    let active = true

    setLoading(true)
    setError('')

    apiFetch(basePath)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await responseError(response))
        }

        return response.json() as Promise<DocumentRecord[]>
      })
      .then((data) => {
        if (active) setDocuments(data)
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
  }, [basePath])

  async function refreshDocuments() {
    setLoading(true)
    setError('')

    try {
      const response = await apiFetch(basePath)

      if (!response.ok) {
        throw new Error(await responseError(response))
      }

      const data = (await response.json()) as DocumentRecord[]
      setDocuments(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load documents.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!file || saving || user?.role !== 'PROJECT_OFFICER') {
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('The maximum file size is 10 MB.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    const formData = new FormData()
    formData.append('document_type', documentType)
    formData.append('notes', notes)
    formData.append('file', file)

    try {
      const response = await apiFetch(basePath, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(await responseError(response))
      }

      setFile(null)
      setNotes('')
      setInputKey((current) => current + 1)
      setNotice('Document uploaded successfully.')

      await refreshDocuments()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to upload document.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function downloadDocument(item: DocumentRecord) {
    setDownloadingId(item.id)
    setError('')

    try {
      const response = await apiFetch(
        `${basePath}/${item.id}/download`
      )

      if (!response.ok) {
        throw new Error(await responseError(response))
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')

      anchor.href = url
      anchor.download = item.original_filename
      anchor.click()

      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to download document.'
      )
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <section className="panel documents-section">
      <div className="panel-heading">
        <div>
          <h2>Project document register</h2>
          <p>
            Supporting documents associated with this project.
          </p>
        </div>

        <button
          type="button"
          className="button button-secondary"
          onClick={() => void refreshDocuments()}
          disabled={loading || saving}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="documents-message documents-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="documents-message documents-success" role="status">
          {notice}
        </div>
      )}

      {user?.role === 'PROJECT_OFFICER' && (
        <form
          className="documents-upload"
          onSubmit={(event) => void uploadDocument(event)}
        >
          <h3>Register supporting document</h3>

          <div className="documents-form-grid">
            <div className="form-field">
              <label htmlFor="document-type">Document type</label>

              <select
                id="document-type"
                value={documentType}
                disabled={saving}
                onChange={(event) =>
                  setDocumentType(event.target.value)
                }
              >
                {DOCUMENT_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="document-file">
                Document file
              </label>

              <input
                key={inputKey}
                id="document-file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                required
                disabled={saving}
                onChange={(event) =>
                  setFile(event.target.files?.[0] ?? null)
                }
              />
            </div>

            <div className="form-field documents-notes">
              <label htmlFor="document-notes">
                Notes (optional)
              </label>

              <textarea
                id="document-notes"
                rows={2}
                maxLength={500}
                disabled={saving}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Enter supporting remarks"
              />
            </div>
          </div>

          <div className="documents-upload-footer">
            <p>PDF, PNG, or JPEG. Maximum size: 10 MB.</p>

            <button
              type="submit"
              className="button button-primary"
              disabled={!file || saving}
            >
              {saving ? 'Uploading...' : 'Upload document'}
            </button>
          </div>
        </form>
      )}

      <div className="documents-register">
        <h3>Registered documents</h3>

        {loading ? (
          <p>Loading document records...</p>
        ) : documents.length === 0 ? (
          <p>No documents have been registered for this project.</p>
        ) : (
          <div className="documents-table-wrapper">
            <table className="documents-table">
              <thead>
                <tr>
                  <th scope="col">Document</th>
                  <th scope="col">Type</th>
                  <th scope="col">Uploaded by</th>
                  <th scope="col">Uploaded on</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>

              <tbody>
                {documents.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.original_filename}</strong>
                      <span>
                        {(item.size_bytes / 1024).toFixed(1)} KB
                      </span>
                      {item.notes && <span>{item.notes}</span>}
                    </td>

                    <td>{formatType(item.document_type)}</td>
                    <td>{item.uploaded_by_username}</td>

                    <td>
                      {new Date(item.uploaded_at).toLocaleString(
                        'en-IN',
                        {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="button button-secondary"
                        disabled={downloadingId === item.id}
                        onClick={() => void downloadDocument(item)}
                      >
                        {downloadingId === item.id
                          ? 'Downloading...'
                          : 'Download'}
                      </button>
                    </td>
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