import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom'

import AppLayout from './components/layout/AppLayout'

import DashboardPage from './pages/DashboardPage'
import ProjectListPage from './pages/ProjectListPage'
import ProjectCreatePage from './pages/ProjectCreatePage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import ProjectGISPage from './pages/ProjectGISPage'

import './App.css'

function NotFoundPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            NAVIGATION
          </div>

          <h1>Page not found</h1>

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
      <Routes>
        <Route element={<AppLayout />}>
          <Route
            path="/"
            element={<Navigate to="/dashboard" replace />}
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
            element={<ProjectCreatePage />}
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
      </Routes>
    </BrowserRouter>
  )
}