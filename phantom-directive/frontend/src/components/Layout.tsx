import { Outlet, NavLink } from 'react-router-dom'
import { LayoutDashboard, FolderOpen, Zap, PlusCircle, BarChart2 } from 'lucide-react'
import styles from './Layout.module.css'

export default function Layout() {
  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <Zap size={20} color="var(--accent)" />
          <span>Phantom Directive</span>
        </div>
        <nav className={styles.nav}>
          <NavLink to="/" end className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}>
            <LayoutDashboard size={16} />
            Dashboard
          </NavLink>
          <NavLink to="/projects" end className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}>
            <FolderOpen size={16} />
            Projects
          </NavLink>
          <NavLink to="/projects/new" className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}>
            <PlusCircle size={16} />
            New project
          </NavLink>
          <NavLink to="/videos" className={({ isActive }) => isActive ? `${styles.link} ${styles.active}` : styles.link}>
            <BarChart2 size={16} />
            Videos
          </NavLink>
        </nav>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}
