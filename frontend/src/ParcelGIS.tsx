import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

import './ParcelGIS.css'
import { apiFetch } from './services/api'
import { useAuth } from './auth/AuthContext'

type Parcel = {
  id: number
  project_id: number
  survey_number: string
  village: string
  land_type: string
  area_ha: string
  acquisition_status: string
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
  created_at: string
}

type ParcelForm = {
  survey_number: string
  village: string
  land_type: string
}

type ParcelGISProps = {
  projectId: number
  projectStatus: string
  proposedAreaHa: number
}

const emptyForm: ParcelForm = {
  survey_number: '',
  village: '',
  land_type: 'Agricultural',
}

function formatArea(value: number): string {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })
}

export default function ParcelGIS({
  projectId,
  projectStatus,
  proposedAreaHa,
}: ParcelGISProps) {
  const { user } = useAuth()

  const mapElementRef = useRef<HTMLDivElement | null>(null)

  const mapRef = useRef<L.Map | null>(null)

  const parcelLayerRef = useRef<L.FeatureGroup | null>(null)

  const previewRef = useRef<L.Layer | null>(null)

  const verticesRef = useRef<L.LatLng[]>([])

  const drawingRef = useRef(false)

  const [parcels, setParcels] = useState<Parcel[]>([])

  const [loading, setLoading] = useState(true)

  const [saving, setSaving] = useState(false)

  const [drawing, setDrawing] = useState(false)

  const [vertexCount, setVertexCount] = useState(0)

  const [form, setForm] = useState<ParcelForm>(emptyForm)

  const [correcting, setCorrecting] = useState<Parcel | null>(null)

  const [correctionReason, setCorrectionReason] = useState('')

  const [error, setError] = useState('')

  const [notice, setNotice] = useState('')

  const updatePreview = useCallback((points: L.LatLng[]) => {
    const map = mapRef.current

    if (!map) return

    previewRef.current?.remove()

    const layers: L.Layer[] = []

    if (points.length >= 3) {
      layers.push(
        L.polygon(points, {
          color: '#a56b28',
          weight: 2,
          fillColor: '#c89b57',
          fillOpacity: 0.25,
        })
      )
    } else if (points.length === 2) {
      layers.push(
        L.polyline(points, {
          color: '#a56b28',
          weight: 2,
        })
      )
    }

    points.forEach((point) => {
      layers.push(
        L.circleMarker(point, {
          radius: 5,
          color: '#8c5c21',
          fillColor: '#ffffff',
          fillOpacity: 1,
          weight: 2,
        })
      )
    })

    previewRef.current = L.layerGroup(layers).addTo(map)
  }, [])

  const loadParcels = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const response = await apiFetch(
        `/api/v1/projects/${projectId}/parcels`
      )

      if (!response.ok) {
        throw new Error(
          `Unable to load land parcels (${response.status}).`
        )
      }

      const data = (await response.json()) as Parcel[]

      setParcels(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to retrieve land parcels.'
      )
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // Initialize the interactive map.

  useEffect(() => {
    if (!mapElementRef.current) return

    const map = L.map(mapElementRef.current, {
      zoomControl: true,
    }).setView([22.6, 79.0], 5)

    mapRef.current = map

    L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        attribution:
          '&copy; OpenStreetMap contributors',
      }
    ).addTo(map)

    map.on('click', (event: L.LeafletMouseEvent) => {
      if (!drawingRef.current) return

      const points = [
        ...verticesRef.current,
        event.latlng,
      ]

      verticesRef.current = points

      setVertexCount(points.length)

      updatePreview(points)
    })

    return () => {
      drawingRef.current = false

      map.remove()

      mapRef.current = null

      parcelLayerRef.current = null

      previewRef.current = null

      verticesRef.current = []
    }
  }, [projectId, updatePreview])

  // Retrieve the actual parcel records from FastAPI.

  useEffect(() => {
    void loadParcels()
  }, [loadParcels])

  useEffect(() => {
    function importCandidate(event: Event) {
      if (user?.role !== 'PROJECT_OFFICER') return
      const detail = (event as CustomEvent).detail as {
        record?: Record<string, unknown>; geometry?: { type?: string; coordinates?: unknown }
      }
      const rings = detail?.geometry?.coordinates
      if (detail?.geometry?.type !== 'Polygon' || !Array.isArray(rings) ||
          rings.length !== 1 || !Array.isArray(rings[0])) {
        setError('Only simple GeoJSON polygons can be previewed. Check the cadastral map manually.')
        return
      }
      const positions = rings[0] as unknown[]
      if (positions.length < 4 || positions.length > 1001 || positions.some((p) =>
        !Array.isArray(p) || p.length !== 2 || !p.every((v) => typeof v === 'number' && Number.isFinite(v)))) {
        setError('The external service returned invalid boundary coordinates.')
        return
      }
      const points = positions.slice(0, -1).map((p) => {
        const [lng, lat] = p as number[]
        return L.latLng(lat, lng)
      })
      if (points.length < 3) return
      verticesRef.current = points; drawingRef.current = true
      setVertexCount(points.length); setDrawing(true); updatePreview(points)
      setForm({ survey_number: String(detail.record?.survey_number ?? ''),
        village: String(detail.record?.village ?? ''),
        land_type: String(detail.record?.land_type ?? 'Agricultural') })
      setError(''); setNotice('External boundary loaded for visual review. Save only after field verification.')
      mapRef.current?.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 17 })
    }
    window.addEventListener('nlam:land-boundary', importCandidate)
    return () => window.removeEventListener('nlam:land-boundary', importCandidate)
  }, [updatePreview, user?.role])

  // Display database polygons on the map.

  useEffect(() => {
    const map = mapRef.current

    if (!map) return

    parcelLayerRef.current?.remove()

    const group = L.featureGroup()

    parcels.forEach((parcel) => {
      const polygon = L.geoJSON(
        parcel.geometry as Parameters<typeof L.geoJSON>[0],
        {
          style: {
            color: '#315b47',
            weight: 2,
            fillColor: '#638b70',
            fillOpacity: 0.3,
          },
        }
      )

      const popup = document.createElement('div')

      const heading = document.createElement('strong')
      heading.textContent = parcel.survey_number

      const details = document.createElement('p')
      details.textContent =
        `${parcel.village} | ${formatArea(Number(parcel.area_ha))} ha`

      popup.append(heading, details)

      polygon.bindPopup(popup)

      polygon.addTo(group)
    })

    group.addTo(map)

    parcelLayerRef.current = group

    if (group.getLayers().length > 0) {
      const bounds = group.getBounds()

      if (bounds.isValid()) {
        map.fitBounds(bounds, {
          padding: [35, 35],
          maxZoom: 16,
        })
      }
    }

    return () => {
      group.remove()
    }
  }, [parcels])

  function startDrawing(parcel?: Parcel) {
    setError('')
    setNotice('')

    setCorrecting(parcel ?? null)
    setCorrectionReason('')
    setForm(parcel ? {
      survey_number: parcel.survey_number,
      village: parcel.village,
      land_type: parcel.land_type,
    } : emptyForm)

    drawingRef.current = true
    verticesRef.current = []

    setVertexCount(0)
    setDrawing(true)

    updatePreview([])
  }

  function undoVertex() {
    const points = verticesRef.current.slice(0, -1)

    verticesRef.current = points

    setVertexCount(points.length)

    updatePreview(points)
  }

  function cancelDrawing() {
    drawingRef.current = false

    verticesRef.current = []

    setVertexCount(0)
    setDrawing(false)

    setCorrecting(null)

    setCorrectionReason('')

    updatePreview([])

    setError('')
  }

  async function saveParcel(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault()

    const points = verticesRef.current

    if (points.length < 3) {
      setError(
        'Draw at least three boundary points before registering the parcel.'
      )

      return
    }

    if (correcting && correctionReason.trim().length < 10) {
      setError('Explain the boundary correction in at least 10 characters.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    const coordinates = points.map((point) => [
      point.lng,
      point.lat,
    ])

    // GeoJSON polygons require a closed boundary.

    coordinates.push([...coordinates[0]])

    const geometry = {
      type: 'Polygon',
      coordinates: [coordinates],
    }

    const payload = correcting
      ? { geometry, reason: correctionReason.trim() }
      : {
        survey_number: form.survey_number.trim(),
        village: form.village.trim(),
        land_type: form.land_type,
        geometry,
      }

    try {
      const response = await apiFetch(
        correcting
          ? `/api/v1/projects/${projectId}/parcels/${correcting.id}/boundary`
          : `/api/v1/projects/${projectId}/parcels`,
        {
          method: correcting ? 'PATCH' : 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify(payload),
        }
      )

      if (!response.ok) {
        let message =
          `Unable to save parcel boundary (${response.status}).`

        try {
          const result = await response.json()

          if (typeof result.detail === 'string') {
            message = result.detail
          }
        } catch {
          // Keep the HTTP error message when no JSON is available.
        }

        throw new Error(message)
      }

      const created = (await response.json()) as Parcel

      drawingRef.current = false
      verticesRef.current = []

      setVertexCount(0)
      setDrawing(false)

      setCorrecting(null)

      setCorrectionReason('')

      updatePreview([])

      setForm(emptyForm)

      setNotice(correcting
        ? `Parcel ${created.survey_number} boundary corrected. ` +
          `Calculated area: ${formatArea(Number(created.area_ha))} hectares. ` +
          'The original boundary remains in project audit history.'
        : `Parcel ${created.survey_number} registered successfully. ` +
          `Calculated area: ${formatArea(Number(created.area_ha))} hectares.`)

      await loadParcels()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to register land parcel.'
      )
    } finally {
      setSaving(false)
    }
  }

  const totalParcelArea = parcels.reduce(
    (sum, parcel) => sum + Number(parcel.area_ha),
    0
  )

  const canCorrect = user?.role === 'PROJECT_OFFICER' &&
    (projectStatus === 'DRAFT' || projectStatus === 'RETURNED')

  return (
    <section className="panel gis-section">
      <div className="panel-heading">
        <div>
          <h2>Land parcels and GIS</h2>
          <p>
            Register and visualize geographic boundaries
            associated with this project.
          </p>
        </div>

        <button
          type="button"
          className="button button-secondary"
          onClick={() => void loadParcels()}
          disabled={loading || saving}
        >
          {loading ? 'Loading...' : 'Refresh parcels'}
        </button>
      </div>

      <div className="gis-summary">
        <div>
          <span>REGISTERED PARCELS</span>
          <strong>{loading ? '...' : parcels.length}</strong>
        </div>

        <div>
          <span>TOTAL PARCEL AREA</span>
          <strong>
            {loading ? '...' : formatArea(totalParcelArea)} ha
          </strong>
        </div>

        <div>
          <span>SPATIAL REFERENCE</span>
          <strong>WGS 84 / EPSG:4326</strong>
        </div>
      </div>

      {error && (
        <div className="gis-message gis-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="gis-message gis-success" role="status">
          {notice}
        </div>
      )}

      {parcels.length > 0 && totalParcelArea > proposedAreaHa + 0.0001 && (
        <div className="gis-message gis-error" role="status">
          Mapped parcels total {formatArea(totalParcelArea)} ha, above the
          project proposal of {formatArea(proposedAreaHa)} ha. Check the
          boundary or edit the proposal before submitting it for review.
        </div>
      )}

      <div className="gis-layout">
        <div className="gis-map-area">
          <div className="gis-map-toolbar">
            <div>
              <strong>Project boundary map</strong>
              <span>
                Select a parcel to inspect its location.
              </span>
            </div>

            {user?.role === 'PROJECT_OFFICER' && !drawing && (
              <button
                type="button"
                className="button button-primary"
                onClick={() => startDrawing()}
              >
                Draw new parcel
              </button>
            )}

            <button type="button" className="button button-secondary" onClick={() => {
              if (!navigator.geolocation) { setError('Location is not available in this browser.'); return }
              navigator.geolocation.getCurrentPosition(
                (position) => mapRef.current?.setView([position.coords.latitude, position.coords.longitude], 16),
                () => setError('Location access was unavailable. Use the map controls instead.'),
                { enableHighAccuracy: true, timeout: 10000 })
            }}>Use my location</button>

            {drawing && (
              <button
                type="button"
                className="button button-secondary"
                onClick={cancelDrawing}
                disabled={saving}
              >
                Cancel drawing
              </button>
            )}
          </div>

          <div
            id="parcel-map"
            ref={mapElementRef}
            className="gis-map"
            aria-label="Interactive project land parcel map"
          />

          <div className="gis-map-footer">
            <span>
              Green: registered parcel
            </span>

            <span>
              Brown: new parcel boundary
            </span>
          </div>
        </div>

        <div className="gis-side-panel">
          {!drawing ? (
            <>
              <div className="gis-side-heading">
                <h3>Parcel register</h3>
                <p>
                  {parcels.length} parcels associated
                  with this project.
                </p>
              </div>

              {loading && (
                <p className="gis-empty">
                  Retrieving parcel records...
                </p>
              )}

              {!loading && parcels.length === 0 && (
                <p className="gis-empty">
                  No land parcels have been registered.
                  Select Draw new parcel to begin.
                </p>
              )}

              {!loading &&
                parcels.map((parcel) => (
                  <div className="gis-parcel-entry" key={parcel.id}>
                    <button
                    type="button"
                    className="gis-parcel-item"
                    onClick={() => {
                      const map = mapRef.current

                      if (!map) return

                      const coordinates =
                        parcel.geometry.coordinates[0]

                      const bounds = L.latLngBounds(
                        coordinates.map(
                          ([longitude, latitude]) =>
                            L.latLng(latitude, longitude)
                        )
                      )

                      if (bounds.isValid()) {
                        map.fitBounds(bounds, {
                          padding: [35, 35],
                          maxZoom: 17,
                        })
                      }
                    }}
                  >
                    <strong>{parcel.survey_number}</strong>

                    <span>{parcel.village}</span>

                    <span>
                      {formatArea(Number(parcel.area_ha))} ha
                    </span>

                    <small>{parcel.acquisition_status}</small>
                    </button>
                    {canCorrect && (
                      <button type="button" className="gis-correct-button"
                        onClick={() => startDrawing(parcel)}>
                        Correct boundary
                      </button>
                    )}
                  </div>
                ))}
            </>
          ) : (
            <form
              className="gis-drawing-form"
              onSubmit={saveParcel}
            >
              <div className="gis-side-heading">
                <h3>{correcting ? `Correct ${correcting.survey_number}` : 'Register a land parcel'}</h3>

                <p>
                  {correcting
                    ? 'Click on the map to mark the corrected boundary.'
                    : 'Click on the map to mark the boundary of the new parcel.'}
                </p>
              </div>

              <div className="gis-instructions">
                <strong>Boundary points: {vertexCount}</strong>

                <p>
                  Select at least three points on the map.
                  The system will close the polygon
                  automatically when you save it.
                </p>

                <button
                  type="button"
                  className="button button-secondary"
                  onClick={undoVertex}
                  disabled={vertexCount === 0 || saving}
                >
                  Undo last point
                </button>
              </div>

              {!correcting && <div className="form-field">
                <label htmlFor="gis-survey">
                  Survey number
                </label>

                <input
                  id="gis-survey"
                  required
                  maxLength={100}
                  value={form.survey_number}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      survey_number: event.target.value,
                    })
                  }
                  placeholder="Enter survey reference"
                />
              </div>}

              {!correcting && <div className="form-field">
                <label htmlFor="gis-village">
                  Village
                </label>

                <input
                  id="gis-village"
                  required
                  minLength={2}
                  maxLength={150}
                  value={form.village}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      village: event.target.value,
                    })
                  }
                  placeholder="Enter village name"
                />
              </div>}

              {!correcting && <div className="form-field">
                <label htmlFor="gis-land-type">
                  Land type
                </label>

                <select
                  id="gis-land-type"
                  value={form.land_type}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      land_type: event.target.value,
                    })
                  }
                >
                  <option value="Agricultural">
                    Agricultural
                  </option>

                  <option value="Residential">
                    Residential
                  </option>

                  <option value="Commercial">
                    Commercial
                  </option>

                  <option value="Industrial">
                    Industrial
                  </option>

                  <option value="Government">
                    Government
                  </option>

                  <option value="Other">
                    Other
                  </option>
                </select>
              </div>}

              {correcting && (
                <div className="form-field">
                  <label htmlFor="gis-correction-reason">Reason for correction</label>
                  <textarea id="gis-correction-reason" required minLength={10}
                    maxLength={500} rows={3} value={correctionReason}
                    onChange={(event) => setCorrectionReason(event.target.value)}
                    placeholder="Explain why the original boundary was inaccurate" />
                </div>
              )}

              <button
                type="submit"
                className="button button-primary gis-save-button"
                disabled={saving || vertexCount < 3 ||
                  Boolean(correcting && correctionReason.trim().length < 10)}
              >
                {saving
                  ? 'Saving boundary...'
                  : correcting ? 'Save boundary correction' : 'Register land parcel'}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="gis-disclaimer">
        Demonstration environment. Map boundaries are
        illustrative and are not authoritative cadastral
        or legal ownership records. Parcel area is
        calculated by PostGIS from the submitted geometry.
      </div>
    </section>
  )
}
