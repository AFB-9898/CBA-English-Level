import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './components/auth/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import AdminLayout from './pages/AdminLayout'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route
                index
                element={
                  <div className="text-center py-12">
                    <h2 className="text-2xl font-semibold text-gray-700">
                      Welcome to the Admin Panel
                    </h2>
                    <p className="text-gray-500 mt-2">
                      Use the navigation to manage exams, questions, and reports.
                    </p>
                  </div>
                }
              />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
