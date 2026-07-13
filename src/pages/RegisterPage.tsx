import { useLocation, useNavigate } from 'react-router-dom'
import RegisterForm from '../components/organisms/RegisterForm'

export default function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const registered = (location.state as { registered?: boolean } | null)?.registered === true

  return (
    <PageShell>
      {registered && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm mb-4" role="status">
          Registration successful! Please sign in.
        </div>
      )}

      <RegisterForm onSuccess={() => navigate('/login', { state: { registered: true } })} />
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">CBA — Student Registration</h1>
          <p className="text-sm text-gray-500 mt-1">Create an account to take placement exams</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">{children}</div>
      </div>
    </div>
  )
}
