import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './components/auth/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AdminLayout from './pages/AdminLayout'
import DashboardScreen from './pages/DashboardScreen'
import QuestionsScreen from './pages/QuestionsScreen'

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="text-center py-12">
      <h2 className="text-2xl font-semibold text-gray-700">{title}</h2>
      <p className="text-gray-500 mt-2">Coming soon.</p>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<DashboardScreen />} />
              <Route path="students" element={<PlaceholderPage title="Students" />} />
              <Route path="questions" element={<QuestionsScreen />} />
              <Route path="audit-log" element={<PlaceholderPage title="Audit Log" />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
