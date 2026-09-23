import { useState } from 'react'

import type { FormEvent } from 'react'

import {
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'

import './LoginPage.css'


export default function LoginPage() {

  const {
    user,
    login,
  } = useAuth()

  const navigate = useNavigate()
  const location = useLocation()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')


  const routeState = location.state as {
    from?: string
  } | null

  const requestedPage = routeState?.from || '/dashboard'

  const validDestination =
    /^\/(?:dashboard|projects(?:\/(?:new|[1-9]\d*(?:\/gis)?))?)(?:\?.*)?$/.test(
      requestedPage
    )

  const destination = validDestination
    ? requestedPage
    : '/dashboard'


  if (user) {

    return (
      <Navigate
        to={destination}
        replace
      />
    )

  }


  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {

    event.preventDefault()

    setError('')
    setSaving(true)

    try {

      await login(username, password)

      navigate(destination, {
        replace: true,
      })

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to sign in.'
      )

    } finally {
      setSaving(false)
    }

  }


  return (
    <div className="login-page">

      <header className="login-header">

        <div className="login-identity">

          <div className="login-mark">
            NL
          </div>

          <div>

            <strong>
              NLAM DSS
            </strong>

            <span>
              National Land Acquisition &amp; Management System
            </span>

          </div>

        </div>

        <span className="login-environment">
          LOCAL PROTOTYPE
        </span>

      </header>


      <main className="login-main">

        <div className="login-introduction">

          <div className="login-eyebrow">
            LAND ADMINISTRATION
          </div>

          <h1>
            National Land Acquisition &amp; Management System
          </h1>

          <p>
            A unified workspace for project registration,
            land parcel management, administrative scrutiny,
            and acquisition monitoring.
          </p>

          <div className="login-system-note">

            <strong>
              Demonstration environment
            </strong>

            <p>
              This application uses synthetic records and
              demonstration accounts. It is not connected to
              an official government authentication service.
            </p>

          </div>

        </div>


        <section
          className="login-panel"
          aria-labelledby="login-title"
        >

          <div className="login-panel-heading">

            <div className="login-eyebrow">
              SECURE ACCESS
            </div>

            <h2 id="login-title">
              Sign in to your workspace
            </h2>

            <p>
              Enter your assigned demonstration
              account credentials.
            </p>

          </div>


          <form
            className="login-form"
            onSubmit={handleLogin}
          >

            {error && (

              <div
                className="message message-error"
                role="alert"
              >
                {error}
              </div>

            )}


            <div className="form-field">

              <label htmlFor="login-username">
                Username
              </label>

              <input
                id="login-username"
                name="username"
                autoComplete="username"
                required
                autoFocus
                value={username}
                onChange={(event) =>
                  setUsername(event.target.value)
                }
                placeholder="Enter your username"
              />

            </div>


            <div className="form-field">

              <label htmlFor="login-password">
                Password
              </label>

              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Enter your password"
              />

            </div>


            <button
              className="button button-primary login-submit"
              type="submit"
              disabled={saving}
            >
              {saving
                ? 'Signing in...'
                : 'Sign in'}
            </button>


            <div className="login-form-footer">
              Access is restricted to configured
              demonstration accounts.
            </div>

          </form>

        </section>

      </main>


      <footer className="login-footer">

        <span>
          NLAM DSS | Development prototype
        </span>

        <span>
          Synthetic demonstration data
        </span>

      </footer>

    </div>
  )
}