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

      <a className="skip-link" href="#main-content">Skip to main content</a>

      <aside className="sidebar">

        <div className="brand">

          <div className="brand-symbol">
            ◈
          </div>

          <div>

            <div className="brand-title">
              NLAM
            </div>

            <div className="brand-subtitle">
              National land management
            </div>

          </div>

        </div>


        <div className="sidebar-section">
          OPERATIONS
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
            <span aria-hidden="true" className="nav-icon">◫</span> Overview
          </NavLink>


          <NavLink
            to="/projects"
            end
            className={({ isActive }) =>
              isActive ? 'nav-active' : ''
            }
          >
            <span aria-hidden="true" className="nav-icon">▤</span> Project register
          </NavLink>


          {user?.role === 'PROJECT_OFFICER' && (

            <NavLink
              to="/projects/new"
              className={({ isActive }) =>
                isActive ? 'nav-active' : ''
              }
            >
              <span aria-hidden="true" className="nav-icon">＋</span> New proposal
            </NavLink>

          )}

          <NavLink to="/reports" className={({ isActive }) => isActive ? 'nav-active' : ''}>
            <span aria-hidden="true" className="nav-icon">▥</span> Reports &amp; MIS
          </NavLink>
          <NavLink to="/alerts" className={({ isActive }) => isActive ? 'nav-active' : ''}>
            <span aria-hidden="true" className="nav-icon">◉</span> Alerts
          </NavLink>
          {user?.role === 'SYSTEM_ADMIN' && <NavLink to="/administration"
            className={({ isActive }) => isActive ? 'nav-active' : ''}>
            <span aria-hidden="true" className="nav-icon">⚙</span> Administration
          </NavLink>}
          <NavLink to="/account" className={({ isActive }) => isActive ? 'nav-active' : ''}>
            <span aria-hidden="true" className="nav-icon">◎</span> Account settings
          </NavLink>

        </nav>


        <div className="sidebar-bottom">

          <div className="environment-label">
            LOCAL WORKSPACE
          </div>

          <div className="environment-description">
            Synthetic demonstration records. No statutory approvals or payments are issued here.
          </div>

          <div className="sidebar-version">
            PS 26016 · Version 1.0
          </div>

        </div>

      </aside>


      <div className="workspace">

        <header className="topbar">

          <div className="topbar-heading">
            <span className="topbar-ministry">Ministry of Rural Development · Department of Land Resources</span>
            <strong>National Land Acquisition &amp; Management System</strong>
          </div>


          <div className="topbar-right">

            <span className="environment-badge">
              DEMONSTRATION
            </span>

            <div className="account-info">

              <strong>
                {user?.full_name}
              </strong>

              <span>
                {user ? `${formatRole(user.role)}${user.state ? ` · ${user.state}` : ''}` : ''}
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


        <main id="main-content" className="page-content">

          <Outlet />

        </main>

      </div>

    </div>
  )
}
