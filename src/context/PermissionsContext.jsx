import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

// Admin menejerga bergan ruxsatlar (018_manager_permissions_pay.sql)
const ALL = { add_employees: true, pay_salary: true, give_advance: true, view_salary: true, view_attendance: true }
const DEFAULT = { add_employees: true, pay_salary: false, give_advance: false, view_salary: true, view_attendance: true }

const PermissionsContext = createContext({ perms: DEFAULT, ready: false })

export function PermissionsProvider({ children }) {
  const { user, profile } = useAuth()
  const [state, setState] = useState({ perms: DEFAULT, ready: false })

  useEffect(() => {
    let alive = true
    if (profile?.role === 'admin') {
      setState({ perms: ALL, ready: true })
      return
    }
    supabase.from('manager_permissions').select('*').eq('user_id', user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return
        // Jadval hali yo'q (018 ishga tushmagan) — standart ruxsatlar
        setState({ perms: error || !data ? DEFAULT : { ...DEFAULT, ...data }, ready: true })
      })
    return () => { alive = false }
  }, [user.id, profile?.role])

  return <PermissionsContext.Provider value={state}>{children}</PermissionsContext.Provider>
}

export const usePermissions = () => useContext(PermissionsContext)
