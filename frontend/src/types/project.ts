export type Project = {
  id: number
  name: string
  state: string
  district: string
  proposed_area_ha: string
  status: string
  created_at: string
}

export type ProjectInput = {
  name: string
  state: string
  district: string
  proposed_area_ha: number
}