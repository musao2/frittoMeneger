import { useState } from 'react'
import { LuX, LuCheck } from 'react-icons/lu'
import { supabase, formatMoney } from '../lib/supabase'

const MONTHS = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr']

const PAY_ERRORS = {
  NO_PERMISSION: "Sizga oylik berishga ruxsat berilmagan",
  BAD_AMOUNT: "Summani to'g'ri yozing",
  EMPLOYEE_NOT_FOUND: 'Xodim topilmadi',
}

// Oylik berish: summa serverda tekshiriladi, oylikdan ko'p berib bo'lmaydi
// advance=true — avans berish (oylik hisobida keyin ayiriladi)
export default function PayDrawer({ row, year, month, onClose, onPaid, advance = false }) {
  const [amount, setAmount] = useState(advance ? '' : String(Math.round(row.remaining)))
  const [method, setMethod] = useState('cash')
  const [notes, setNotes]   = useState('')
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState('')
  const [done, setDone]     = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const value = Number(amount)
    if (!value || value <= 0) return setError(PAY_ERRORS.BAD_AMOUNT)
    setBusy(true)
    const { data, error } = advance
      ? await supabase.rpc('manager_give_advance', {
          p_employee_id: row.id, p_amount: value, p_method: method, p_notes: notes,
        })
      : await supabase.rpc('manager_pay_salary', {
          p_employee_id: row.id, p_year: year, p_month: month,
          p_amount: value, p_method: method, p_notes: notes,
        })
    setBusy(false)
    if (error) {
      const msg = error.message || ''
      const over = msg.match(/OVERPAY:(\d+)/)
      if (over) return setError(Number(over[1]) > 0
        ? `Oylikdan ko'p berib bo'lmaydi. Ko'pi bilan ${formatMoney(Number(over[1]))} berish mumkin.`
        : "Bu oy uchun oylik to'liq berib bo'lingan.")
      if (error.code === 'PGRST202' || msg.includes('Could not find the function')) {
        return setError(`Supabase'da ${advance ? '019_manager_advance' : '018_manager_permissions_pay'}.sql hali ishga tushirilmagan`)
      }
      const key = Object.keys(PAY_ERRORS).find(k => msg.includes(k))
      return setError(key ? PAY_ERRORS[key] : msg)
    }
    setDone(advance ? { paid: value } : data)
    onPaid()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">{advance ? 'Avans berish' : 'Pul berish'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 cursor-pointer" aria-label="Yopish"><LuX size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="border border-slate-200 rounded-lg px-4 py-3">
            <p className="font-medium text-slate-900">{row.full_name}</p>
            <p className="text-sm text-slate-500">{MONTHS[month - 1]} {year} · oylik {formatMoney(row.salary)} · berilgan {formatMoney(row.paid)}</p>
            {advance
              ? <p className="text-sm text-slate-500 mt-1">Bu oy olgan avansi: {formatMoney(row.advance)}. Avans oylikdan ayiriladi.</p>
              : <p className="text-sm font-semibold text-emerald-700 mt-1">Qoldi: {formatMoney(row.remaining)}</p>}
          </div>

          {done ? (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 flex gap-2">
                <LuCheck size={18} className="flex-shrink-0 mt-0.5" />
                <span>
                  {advance
                    ? `${formatMoney(done.paid)} avans berildi. Oylikdan ayiriladi. Admin buni ko'radi.`
                    : `${formatMoney(done.paid)} berildi. Yana berish kerak: ${formatMoney(done.remaining)}. Admin buni ko'radi.`}
                </span>
              </div>
              <button onClick={onClose} className="btn-primary w-full">Tayyor</button>
            </>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="label">Summa (so'm)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="input-field" min="1" autoFocus />
              </div>
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
                <input value={notes} onChange={e => setNotes(e.target.value)} className="input-field" placeholder="Masalan: oyning yarmi" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? 'Berilmoqda...' : `${formatMoney(Number(amount) || 0)} ${advance ? 'avans ' : ''}berish`}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, tone = 'text-slate-900' }) {
  return (
    <div className="stat-card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-xl font-semibold truncate ${tone}`}>{value}</p>
    </div>
  )
}
