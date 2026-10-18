import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PermissionsProvider, usePermissions } from './context/PermissionsContext'

import LoginPage from './pages/LoginPage'
import WrongRole from './pages/WrongRole'
import ManagerLayout from './layouts/ManagerLayout'
import Employees from './pages/Employees'
import Salary from './pages/Salary'
import Attendance from './pages/Attendance'
import EmployeeDetail from './pages/EmployeeDetail'

function AppRoutes() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user || !profile) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // Menejer (yoki admin) kira oladi
  if (profile.role !== 'manager' && profile.role !== 'admin') {
    return <WrongRole message="Bu sahifa faqat menejerlar uchun." />
  }

  return (
    <PermissionsProvider>
      <ManagerRoutes />
    </PermissionsProvider>
  )
}

function ManagerRoutes() {
  const { perms, ready } = usePermissions()
  if (!ready) return null
  const canSalary = perms.view_salary || perms.pay_salary || perms.give_advance

  return (
    <Routes>
      <Route path="/" element={<ManagerLayout />}>
        <Route index element={<Navigate to="/employees" replace />} />
        <Route path="employees"  element={<Employees />} />
        {canSalary && <Route path="salary" element={<Salary />} />}
        {canSalary && <Route path="salary/:employeeId" element={<EmployeeDetail />} />}
        {perms.view_attendance && <Route path="attendance" element={<Attendance />} />}
      </Route>
      <Route path="*" element={<Navigate to="/employees" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
