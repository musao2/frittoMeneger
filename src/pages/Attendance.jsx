import { useEffect, useState } from 'react'
import { LuClock, LuSearch } from 'react-icons/lu'
import { attendanceFunctions, formatMoney } from '../lib/supabase'

const TZ = 'Asia/Tashkent'
const pad = (n) => String(n).padStart(2, '0')
const dayOf = (iso) => new Date(iso).toLocaleDateString('en-GB', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' })
const timeOf = (iso) => iso ? new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : null
const dur = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h} soat ${m} daq` : `${m} daq` }

// Davomat — faqat ko'rish (tuzatish admin panelda)
export default function Attendance() {
  const now = new Date()
  const [from, setFrom] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`)
  const [to, setTo]     = useState(now.toLocaleDateString('en-CA', { timeZone: TZ }))
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [onlyOpen, setOnlyOpen] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    attendanceFunctions.getAll({ from: `${from}T00:00:00+05:00`, to: `${to}T23:59:59+05:00`, limit: 1000 })
      .then(d => alive && setRows(d))
      .catch(e => console.error(e))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [from, to])

  const q = search.trim().toLowerCase()
  const list = rows
    .filter(r => !q || (r.employees?.full_name || '').toLowerCase().includes(q))
    .filter(r => !onlyOpen || r.status === 'open')
  const inNow = rows.filter(r => r.status === 'open').length

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="page-title">Davomat</h1>
        <p className="page-subtitle">{list.length} ta yozuv · hozir ishda: {inNow} kishi</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Dan</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input-field w-auto" />
        </div>
        <div>
          <label className="text-xs text-slate-500 mb-1 block">Gacha</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input-field w-auto" />
        </div>
        <div className="relative flex-1 min-w-48 max-w-sm">
          <LuSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Xodim ismi..." className="input-field pl-9" />
        </div>
        <label className="flex items-center gap-2 h-10 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} className="w-4 h-4 accent-[#FCA914]" />
          Faqat hozir ishdagilar
        </label>
      </div>

      {loading ? (
        <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
      ) : list.length === 0 ? (
        <div className="card text-center py-12">
          <LuClock size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-base font-medium text-slate-900">Bu davrda davomat yo'q</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head">Xodim</th>
                <th className="table-head">Sana</th>
                <th className="table-head">Keldi</th>
                <th className="table-head">Ketdi</th>
                <th className="table-head text-right">Ishladi</th>
                <th className="table-head text-right">Topdi</th>
                <th className="table-head">Holat</th>
              </tr>
            </thead>
            <tbody>
              {list.map(r => (
                <tr key={r.id} className="table-row">
                  <td className="table-cell">
                    <p className="font-medium text-slate-900">{r.employees?.full_name || '—'}</p>
                    <p className="text-xs text-slate-500">{r.employees?.position}</p>
                  </td>
                  <td className="table-cell">{dayOf(r.check_in_at)}</td>
                  <td className="table-cell tabular-nums">{timeOf(r.check_in_at)}</td>
                  <td className="table-cell tabular-nums">{timeOf(r.check_out_at) || <span className="text-emerald-700">hali ishda</span>}</td>
                  <td className="table-cell text-right">{r.status === 'open' ? '—' : dur(r.worked_seconds || 0)}</td>
                  <td className="table-cell text-right">{r.status === 'open' ? '—' : formatMoney(r.earned_amount)}</td>
                  <td className="table-cell">
                    {r.status === 'open'
                      ? <span className="badge-blue">Ishda</span>
                      : r.lateness_type === 'late'
                      ? <span className="badge-yellow">{r.lateness_minutes} daq kechikdi</span>
                      : r.admin_corrected
                      ? <span className="badge-gray">Tuzatilgan</span>
                      : <span className="badge-green">Yakunlandi</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
