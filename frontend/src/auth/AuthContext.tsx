import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'

import type {
  ReactNode,
} from 'react'

import type {
  AuthUser,
} from './types'

import {
  AUTH_TOKEN_KEY,
  getCurrentUser,
  loginUser,
} from '../services/api'


type AuthContextValue = {
  user: AuthUser | null
  loading: boolean

  login: (
    username: string,
    password: string
  ) => Promise<void>

  logout: () => void
}


const AuthContext =
  createContext<AuthContextValue | null>(null)


export function AuthProvider({
  children,
}: {
  children: ReactNode
}) {

  const [user, setUser] =
    useState<AuthUser | null>(null)

  const [loading, setLoading] = useState(
    () => Boolean(sessionStorage.getItem(AUTH_TOKEN_KEY))
  )


  useEffect(() => {

    let active = true

    const existingToken =
      sessionStorage.getItem(AUTH_TOKEN_KEY)

    if (!existingToken) {
      return
    }

    getCurrentUser()
      .then((profile) => {

        if (active) {
          setUser(profile)
        }

      })
      .catch(() => {

        if (active) {
          sessionStorage.removeItem(AUTH_TOKEN_KEY)
          setUser(null)
        }

      })
      .finally(() => {

        if (active) {
          setLoading(false)
        }

      })

    return () => {
      active = false
    }

  }, [])


  useEffect(() => {

    function handleUnauthorized() {
      setUser(null)
      setLoading(false)
    }

    window.addEventListener(
      'nlam:unauthorized',
      handleUnauthorized
    )

    return () => {

      window.removeEventListener(
        'nlam:unauthorized',
        handleUnauthorized
      )

    }

  }, [])


  async function login(
    username: string,
    password: string
  ) {

    const response = await loginUser(
      username.trim().toLowerCase(),
      password
    )

    sessionStorage.setItem(
      AUTH_TOKEN_KEY,
      response.access_token
    )

    setUser(response.user)
    setLoading(false)
  }


  function logout() {

    sessionStorage.removeItem(AUTH_TOKEN_KEY)

    setUser(null)
    setLoading(false)
  }


  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}


// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {

  const context = useContext(AuthContext)

  if (!context) {
    throw new Error(
      'Authentication context is not available.'
    )
  }

  return context
}
