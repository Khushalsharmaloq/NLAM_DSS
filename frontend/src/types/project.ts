export type Project = {
  id: number
  name: string
  state: string
  district: string
  proposed_area_ha: string
  status: string
  agency: string | null
  sector: string | null
  description: string | null
  target_date: string | null
  owner_username: string | null
  created_at: string
}

export type ProjectInput = {
  name: string
  state: string
  district: string
  proposed_area_ha: number
  agency?: string | null
  sector?: string | null
  description?: string | null
  target_date?: string | null
}
