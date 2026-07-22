import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthProvider } from './components/auth/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import StudentLoginPage from './pages/StudentLoginPage'
import StudentWelcomeScreen from './pages/StudentWelcomeScreen'
import RegisterPage from './pages/RegisterPage'
import AdminLayout from './pages/AdminLayout'
import DashboardScreen from './pages/DashboardScreen'
import QuestionsScreen from './pages/QuestionsScreen'
import LevelsScreen from './pages/LevelsScreen'
import ExamConfigurationScreen from './pages/ExamConfigurationScreen'
import ReportsScreen from './pages/ReportsScreen'
import AdminAuditLogScreen from './pages/AdminAuditLogScreen'

function PlaceholderPage({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation()

  return (
    <div className="text-center py-12">
      <h2 className="text-2xl font-semibold text-gray-700">{t(titleKey)}</h2>
      <p className="text-gray-500 mt-2">Coming soon / Próximamente.</p>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/student/login" element={<StudentLoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute requiredRole="admin" />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<DashboardScreen />} />
              <Route path="students" element={<PlaceholderPage titleKey="dashboard.nav.students" />} />
              <Route path="questions" element={<QuestionsScreen />} />
              <Route path="questions/new" element={<QuestionsScreen />} />
              <Route path="questions/:id/edit" element={<QuestionsScreen />} />
              <Route path="levels" element={<LevelsScreen />} />
              <Route path="exam-configuration" element={<ExamConfigurationScreen />} />
              <Route path="reports" element={<ReportsScreen />} />
              <Route path="audit-log" element={<AdminAuditLogScreen />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute requiredRole="student" />}>
            <Route path="/student" element={<StudentWelcomeScreen />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
