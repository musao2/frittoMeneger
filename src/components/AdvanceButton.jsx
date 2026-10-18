import { useEffect, useState } from 'react'
import { LuHandCoins, LuX, LuCheck, LuSearch } from 'react-icons/lu'
import { supabase, formatMoney } from '../lib/supabase'

const ERRORS = {
  NO_PERMISSION: 'Sizga avans berishga ruxsat berilmagan',
  BAD_AMOUNT: "Summani to'g'ri yozing",
  EMPLOYEE_NOT_FOUND: 'Xodim topilmadi yoki ishdan ketgan',
}

// Tepadagi "Avans berish" tugmasi: xodimni tanlab avans beradi
export default function AdvanceButton({ className = '', onDone }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)} className={`btn-primary h-9 px-3 ${className}`}>
        <LuHandCoins size={16} /> <span className="sm:hidden">Avans</span><span className="hidden sm:inline">Avans berish</span>
      </button>
      {open && <AdvanceDrawer onClose={() => setOpen(false)} onDone={onDone} />}
    </>
  )
}

function AdvanceDrawer({ onClose, onDone }) {
  const [employees, setEmployees] = useState(null)
  const [search, setSearch]   = useState('')
  const [emp, setEmp]         = useState(null)
  const [amount, setAmount]   = useState('')
  const [method, setMethod]   = useState('cash')
  const [notes, setNotes]     = useState('')
  const [busy, setBusy]       = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState(null)

  useEffect(() => {
    supabase.from('employees').select('id, full_name, position').in('status', ['active', 'trial']).order('full_name')
      .then(({ data }) => setEmployees(data || []))
  }, [])

  const q = search.trim().toLowerCase()
  const list = (employees || []).filter(e => !q || e.full_name.toLowerCase().includes(q))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!emp) return setError('Xodimni tanlang')
    const value = Number(amount)
    if (!value || value <= 0) return setError(ERRORS.BAD_AMOUNT)
    setBusy(true)
    const { error } = await supabase.rpc('manager_give_advance', {
      p_employee_id: emp.id, p_amount: value, p_method: method, p_notes: notes,
    })
    setBusy(false)
    if (error) {
      const msg = error.message || ''
      if (error.code === 'PGRST202' || msg.includes('Could not find the function')) {
        return setError("Supabase'da 019_manager_advance.sql hali ishga tushirilmagan")
      }
      const key = Object.keys(ERRORS).find(k => msg.includes(k))
      return setError(key ? ERRORS[key] : msg)
    }
    setDone({ name: emp.full_name, amount: value })
    onDone?.()
  }

  const again = () => {
    setDone(null); setEmp(null); setAmount(''); setNotes(''); setSearch('')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Avans berish</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 cursor-pointer" aria-label="Yopish"><LuX size={20} /></button>
        </div>

        <div className="p-6 space-y-4">
          {done ? (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-4 text-sm text-green-800 flex gap-2">
                <LuCheck size={18} className="flex-shrink-0 mt-0.5" />
                <span><b>{done.name}</b>ga {formatMoney(done.amount)} avans berildi. Oylikdan ayiriladi. Admin buni ko'radi.</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={again} className="btn-secondary">Yana berish</button>
                <button onClick={onClose} className="btn-primary">Tayyor</button>
              </div>
            </>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {/* 1. Kimga */}
              <div>
                <label className="label">Kimga</label>
                {emp ? (
                  <div className="flex items-center justify-between gap-3 border border-emerald-600 bg-emerald-50 rounded-lg px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{emp.full_name}</p>
                      <p className="text-xs text-slate-500 truncate">{emp.position}</p>
                    </div>
                    <button type="button" onClick={() => setEmp(null)} className="text-sm text-emerald-800 underline cursor-pointer">O'zgartirish</button>
                  </div>
                ) : (
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <div className="relative border-b border-slate-200">
                      <LuSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Xodim ismini yozing..." className="w-full h-10 pl-9 pr-3 text-sm outline-none" autoFocus />
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {employees === null ? (
                        <p className="px-4 py-3 text-sm text-slate-400">Yuklanmoqda...</p>
                      ) : list.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-slate-500">Xodim topilmadi</p>
                      ) : list.map(e => (
                        <button key={e.id} type="button" onClick={() => setEmp(e)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 cursor-pointer">
                          <p className="text-sm font-medium text-slate-900">{e.full_name}</p>
                          <p className="text-xs text-slate-500">{e.position}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Qancha */}
              <div>
                <label className="label">Summa (so'm)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="input-field" min="1" placeholder="500000" />
              </div>

              {/* 3. Qanday */}
              <div>
                <label className="label">Qanday berildi</label>
                <div className="grid grid-cols-3 gap-2">
                  {[['cash', 'Naqd'], ['card', 'Karta'], ['transfer', "O'tkazma"]].map(([v, t]) => (
                    <button key={v} type="button" onClick={() => setMethod(v)}
                      className={`h-10 rounded-lg border text-sm cursor-pointer ${method === v ? 'border-emerald-600 bg-emerald-50 font-medium text-slate-900' : 'border-slate-300 text-slate-600'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Izoh (ixtiyoriy)</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} className="input-field" placeholder="Masalan: oila uchun" />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={busy || !emp} className="btn-primary w-full">
                {busy ? 'Berilmoqda...' : emp ? `${formatMoney(Number(amount) || 0)} avans berish` : 'Avval xodimni tanlang'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
