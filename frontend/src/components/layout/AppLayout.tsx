import { NavLink, Outlet } from 'react-router-dom'

export default function AppLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-symbol">NL</div>

          <div>
            <div className="brand-title">NLAM DSS</div>

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

          <NavLink
            to="/projects/new"
            className={({ isActive }) =>
              isActive ? 'nav-active' : ''
            }
          >
            New project
          </NavLink>
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

            <span className="topbar-org">
              Land Administration
            </span>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}