import { NavLink, Outlet, useLocation } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();
  const title = location.pathname.startsWith('/bed/')
    ? 'Patient Monitor'
    : location.pathname.startsWith('/admin')
      ? 'Administration'
      : 'Unit Dashboard';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">ICU</div>
        <NavLink to="/" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} title="Dashboard">
          ⊞
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} title="Admin">
          ⚙
        </NavLink>
        <a href="http://localhost:7031" className="nav-item" title="Mobile PWA" target="_blank" rel="noreferrer">
          📱
        </a>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            <div className="topbar-meta" style={{ marginTop: 4 }}>
              RTWO · JPN · ICU Connect Hub
            </div>
          </div>
          <div className="topbar-meta">
            <span className="live-dot">Live</span>
            <span>{new Date().toLocaleTimeString()}</span>
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
