import {
  BrowserRouter,
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'

import type { ReactNode } from 'react'

import {
  AuthProvider,
  useAuth,
} from './auth/AuthContext'

import AppLayout from './components/layout/AppLayout'

import DashboardPage from './pages/DashboardPage'
import ProjectListPage from './pages/ProjectListPage'
import ProjectCreatePage from './pages/ProjectCreatePage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import ProjectGISPage from './pages/ProjectGISPage'
import LoginPage from './pages/LoginPage'

import './App.css'


function ProtectedRoute() {

  const {
    user,
    loading,
  } = useAuth()

  const location = useLocation()


  if (loading) {

    return (
      <div className="auth-loading" role="status">
        Verifying your session...
      </div>
    )

  }


  if (!user) {

    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname + location.search,
        }}
      />
    )

  }


  return <Outlet />
}


function RoleRoute({
  role,
  children,
}: {
  role: string
  children: ReactNode
}) {

  const { user } = useAuth()

  if (user?.role !== role) {

    return (
      <div className="message message-error" role="alert">
        You do not have permission to access this page.
      </div>
    )

  }

  return <>{children}</>
}


function NotFoundPage() {

  return (
    <>
      <div className="page-heading">

        <div>

          <div className="eyebrow">
            NAVIGATION
          </div>

          <h1>
            Page not found
          </h1>

          <p>
            The requested page does not exist.
          </p>

        </div>

      </div>

      <Link
        className="button button-primary"
        to="/dashboard"
      >
        Return to overview
      </Link>
    </>
  )
}


export default function App() {

  return (
    <BrowserRouter>

      <AuthProvider>

        <Routes>

          <Route
            path="/login"
            element={<LoginPage />}
          />

          <Route element={<ProtectedRoute />}>

            <Route element={<AppLayout />}>

              <Route
                path="/"
                element={
                  <Navigate
                    to="/dashboard"
                    replace
                  />
                }
              />

              <Route
                path="/dashboard"
                element={<DashboardPage />}
              />

              <Route
                path="/projects"
                element={<ProjectListPage />}
              />

              <Route
                path="/projects/new"
                element={
                  <RoleRoute role="PROJECT_OFFICER">
                    <ProjectCreatePage />
                  </RoleRoute>
                }
              />

              <Route
                path="/projects/:projectId"
                element={<ProjectDetailPage />}
              />

              <Route
                path="/projects/:projectId/gis"
                element={<ProjectGISPage />}
              />

              <Route
                path="*"
                element={<NotFoundPage />}
              />

            </Route>

          </Route>

        </Routes>

      </AuthProvider>

    </BrowserRouter>
  )
}