export type UserRole =
  | 'SYSTEM_ADMIN'
  | 'PROJECT_OFFICER'
  | 'DISTRICT_AUTHORITY'
  | 'STATE_AUTHORITY'

export type AuthUser = {
  id: number
  username: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export type LoginResponse = {
  access_token: string
  token_type: string
  expires_in: number
  user: AuthUser
}