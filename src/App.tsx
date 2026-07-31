import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useNotificationScheduler } from './hooks/useNotificationScheduler'
import Dashboard from './pages/Dashboard'
import CompanyNew from './pages/CompanyNew'
import CompanyEdit from './pages/CompanyEdit'
import CompanyDetail from './pages/CompanyDetail'
import ProjectWorkshop from './pages/ProjectWorkshop'
import Calendar from './pages/Calendar'
import Stats from './pages/Stats'
import Resumes from './pages/Resumes'
import Notes from './pages/Notes'
import Settings from './pages/Settings'

function AppRoutes() {
  useNotificationScheduler()

  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/company/new" element={<CompanyNew />} />
      <Route path="/company/:id/edit" element={<CompanyEdit />} />
      <Route path="/company/:id" element={<CompanyDetail />} />
      <Route path="/company/:id/project/:projectId" element={<ProjectWorkshop />} />
      <Route path="/calendar" element={<Calendar />} />
      <Route path="/stats" element={<Stats />} />
      <Route path="/resumes" element={<Resumes />} />
      <Route path="/notes" element={<Notes />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  )
}

function routerBasename(): string | undefined {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return base || undefined
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter basename={routerBasename()}>
        <AppRoutes />
      </BrowserRouter>
    </ErrorBoundary>
  )
}
