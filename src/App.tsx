import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './components/auth/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import StudentWelcomeScreen from './pages/StudentWelcomeScreen'
import RegisterPage from './pages/RegisterPage'
import AdminLayout from './pages/AdminLayout'
import DashboardScreen from './pages/DashboardScreen'
import QuestionsScreen from './pages/QuestionsScreen'
import LevelsScreen from './pages/LevelsScreen'
import ExamConfigurationScreen from './pages/ExamConfigurationScreen'
import ReportsScreen from './pages/ReportsScreen'
import AdminAuditLogScreen from './pages/AdminAuditLogScreen'
import AdminStudentsScreen from './pages/AdminStudentsScreen'
import AdminStudentDetailScreen from './pages/AdminStudentDetailScreen'
import AdministratorsScreen from './pages/AdministratorsScreen'
import StudentExamScreen from './pages/StudentExamScreen'
import StudentExamHistoryScreen from './pages/StudentExamHistoryScreen'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/student/login" element={<Navigate to="/login" replace />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute requiredRole="admin" />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<DashboardScreen />} />
              <Route path="students" element={<AdminStudentsScreen />} />
              <Route path="students/:studentId" element={<AdminStudentDetailScreen />} />
              <Route element={<ProtectedRoute capability="administrator_management" />}><Route path="administrators" element={<AdministratorsScreen />} /></Route>
              <Route path="questions" element={<QuestionsScreen />} />
              <Route path="questions/new" element={<QuestionsScreen />} />
              <Route path="questions/:id/edit" element={<QuestionsScreen />} />
              <Route element={<ProtectedRoute capability="levels" />}><Route path="levels" element={<LevelsScreen />} /></Route>
              <Route element={<ProtectedRoute capability="exam_configuration" />}><Route path="exam-configuration" element={<ExamConfigurationScreen />} /></Route>
              <Route path="reports" element={<ReportsScreen />} />
              <Route element={<ProtectedRoute capability="audit" />}><Route path="audit-log" element={<AdminAuditLogScreen />} /></Route>
            </Route>
          </Route>
          <Route element={<ProtectedRoute requiredRole="student" />}>
            <Route path="/student" element={<StudentWelcomeScreen />} />
            <Route path="/student/history" element={<StudentExamHistoryScreen />} />
            <Route path="/student/history/:attemptId" element={<StudentExamHistoryScreen />} />
            <Route path="/student/exam/:attemptId" element={<StudentExamScreen />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
