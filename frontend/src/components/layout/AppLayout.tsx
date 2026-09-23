import {
  NavLink,
  Outlet,
  useNavigate,
} from 'react-router-dom'

import { useAuth } from '../../auth/AuthContext'


function formatRole(role: string): string {

  return role.replaceAll('_', ' ')
}


export default function AppLayout() {

  const {
    user,
    logout,
  } = useAuth()

  const navigate = useNavigate()


  function handleLogout() {

    logout()

    navigate('/login', {
      replace: true,
    })

  }


  return (
    <div className="app-shell">

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-symbol">
            NL
          </div>

          <div>

            <div className="brand-title">
              NLAM DSS
            </div>

            <div className="brand-subtitle">
              Land Administration
            </div>

          </div>

        </div>


        <div className="sidebar-section">
          WORKSPACE
        </div>


        <nav
          className="main-nav"
          aria-label="Main navigation"
        >

          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              isActive ? 'nav-active' : ''
            }
          >
            Overview
          </NavLink>


          <NavLink
            to="/projects"
            end
            className={({ isActive }) =>
              isActive ? 'nav-active' : ''
            }
          >
            Project register
          </NavLink>


          {user?.role === 'PROJECT_OFFICER' && (

            <NavLink
              to="/projects/new"
              className={({ isActive }) =>
                isActive ? 'nav-active' : ''
              }
            >
              New project
            </NavLink>

          )}

        </nav>


        <div className="sidebar-bottom">

          <div className="environment-label">
            DEVELOPMENT ENVIRONMENT
          </div>

          <div className="environment-description">
            Prototype system. Use synthetic demonstration
            records only.
          </div>

          <div className="sidebar-version">
            Application v0.1.0
          </div>

        </div>

      </aside>


      <div className="workspace">

        <header className="topbar">

          <div className="topbar-heading">
            National Land Acquisition &amp; Management System
          </div>


          <div className="topbar-right">

            <span className="environment-badge">
              LOCAL PROTOTYPE
            </span>

            <div className="account-info">

              <strong>
                {user?.full_name}
              </strong>

              <span>
                {user ? formatRole(user.role) : ''}
              </span>

            </div>

            <button
              type="button"
              className="button button-secondary logout-button"
              onClick={handleLogout}
            >
              Sign out
            </button>

          </div>

        </header>


        <main className="page-content">

          <Outlet />

        </main>

      </div>

    </div>
  )
}