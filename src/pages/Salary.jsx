import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  LuSearch, LuWallet, LuBanknote, LuHandCoins, LuX, LuReceipt,
  LuLayoutGrid, LuList, LuCircleCheck,
} from 'react-icons/lu'
import { supabase, formatMoney, formatDuration } from '../lib/supabase'
import { usePermissions } from '../context/PermissionsContext'
import SalaryBreakdown, { getRemaining } from '../components/SalaryBreakdown'
import PayslipReceipt from '../components/PayslipReceipt'
import PayDrawer from '../components/PayDrawer'
import AdvanceButton from '../components/AdvanceButton'

const MONTHS = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr']
const pad = (n) => String(n).padStart(2, '0')
const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' })

// Ish haqi — admin paneldagi kabi: kartalar, chek, pul va avans berish
export default function Salary() {
  const now = new Date()
  const [params] = useSearchParams()
  const [year, setYear]   = useState(Number(params.get('y')) || now.getFullYear())
  const [month, setMonth] = useState(Number(params.get('m')) || now.getMonth() + 1)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('cards')
  const [reload, setReload] = useState(0)
  const [paying, setPaying] = useState(null)
  const [advancing, setAdvancing] = useState(null)
  const [receiptId, setReceiptId] = useState(null)
  const { perms } = usePermissions()

  useEffect(() => {
    let alive = true
    const load = async () => {
      setLoading(true)
      setError('')
      const last = new Date(year, month, 0).getDate()
      const from = `${year}-${pad(month)}-01T00:00:00+05:00`
      const to   = `${year}-${pad(month)}-${pad(last)}T23:59:59+05:00`
      try {
        const [emps, sess, adv, pay, period] = await Promise.all([
          supabase.from('employees').select('id, full_name, position, status, salary_rates(*)').in('status', ['active', 'trial']).order('full_name'),
          supabase.from('attendance_sessions').select('employee_id, check_in_at, worked_seconds, earned_amount, status').gte('check_in_at', from).lte('check_in_at', to).in('status', ['closed', 'corrected']),
          supabase.from('advances').select('id, employee_id, amount, status, notes, created_at').gte('created_at', from).lte('created_at', to).order('created_at'),
          supabase.from('payments').select('id, employee_id, amount, payment_method, payment_date').gte('payment_date', from).lte('payment_date', to).order('payment_date'),
          supabase.from('payroll_periods').select('id').eq('year', year).eq('month', month).maybeSingle(),
        ])
        const firstErr = [emps, sess, adv, pay].find(r => r.error)?.error
        if (firstErr) throw firstErr

        const adj = period.data
          ? (await supabase.from('payroll_adjustments').select('id, employee_id, type, amount, status, reason').eq('period_id', period.data.id)).data || []
          : []

        const of = (arr, id) => (arr || []).filter(x => x.employee_id === id)
        const sum = (arr, f) => arr.reduce((s, x) => s + (Number(f(x)) || 0), 0)

        const out = (emps.data || []).map(e => {
          const rate     = e.salary_rates?.find(r => !r.effective_to)
          const monthly  = rate?.salary_type === 'monthly'
          const sessions = of(sess.data, e.id)
          const advances = of(adv.data, e.id)
          const payments = of(pay.data, e.id)
          const adjust   = of(adj, e.id).filter(a => a.status === 'approved')

          // Oylikdagi xodim: soat hisoblanmaydi — belgilangan oylik
          const earned  = monthly ? Number(rate.monthly_salary) || 0 : sum(sessions, x => x.earned_amount)
          const advance = sum(advances.filter(a => a.status === 'active'), x => x.amount)
          const bonus   = sum(adjust.filter(a => a.type === 'bonus'), x => x.amount)
          const fine    = sum(adjust.filter(a => a.type === 'deduction'), x => x.amount)
          const paid    = sum(payments, x => x.amount)
          const net     = Math.max(0, Math.round(earned + bonus - fine - advance))
          const remaining = Math.max(0, net - paid)

          return {
            // Chek va SalaryBreakdown admin bilan bir xil ko'rinishda
            id: e.id,
            employee_id: e.id,
            employees: { full_name: e.full_name, position: e.position },
            worked_days: new Set(sessions.map(s => dayKey(s.check_in_at))).size,
            total_worked_seconds: sum(sessions, x => x.worked_seconds),
            total_earned: earned,
            total_advances: advance,
            total_bonuses: bonus,
            total_deductions: fine,
            net_payable: net,
            paid_amount: paid,
            remaining_payable: remaining,
            receipt: {
              advances, adjustments: adjust, payments,
              hourlyRate: monthly ? null : rate?.hourly_rate || null,
              monthlySalary: monthly ? Number(rate.monthly_salary) : null,
            },
            // PayDrawer uchun
            full_name: e.full_name, salary: net, paid, remaining, advance,
          }
        })
        if (alive) setItems(out)
      } catch (e) {
        if (alive) setError(e.message?.includes('permission') || e.code === '42501'
          ? "Ruxsat yo'q: Supabase'da 015 va 018 SQL fayllari ishga tushirilganini tekshiring"
          : e.message)
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [year, month, reload])

  const q = search.trim().toLowerCase()
  const list = items.filter(i => !q || (i.full_name || '').toLowerCase().includes(q))
  const receipt = receiptId ? items.find(i => i.id === receiptId) : null
  const totalEarned    = list.reduce((s, i) => s + i.total_earned, 0)
  const totalAdvances  = list.reduce((s, i) => s + i.total_advances, 0)
  const totalPaid      = list.reduce((s, i) => s + i.paid_amount, 0)
  const totalRemaining = list.reduce((s, i) => s + i.remaining_payable, 0)
  const unpaidCount    = list.filter(i => i.remaining_payable > 0).length
  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear()]

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Sarlavha */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Ish haqi</h1>
          <p className="page-subtitle">Har bir xodim qancha ishlab topdi, qancha avans oldi va qancha pul qoldi</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="input-field w-auto">
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="input-field w-auto">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {perms.give_advance && <AdvanceButton className="h-10" onDone={() => setReload(x => x + 1)} />}
        </div>
      </div>

      {/* Umumiy natija */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Ishlab topildi" value={totalEarned} hint="Barcha xodimlar bo'yicha" />
        <SummaryCard label="Avans berildi" value={totalAdvances} hint="Oy davomida oldindan" />
        <SummaryCard label="Oylik berildi" value={totalPaid} hint="Kassadan to'langan" tone="text-green-700" />
        <SummaryCard
          label="Hali berilmagan"
          value={totalRemaining}
          hint={totalRemaining === 0 ? "Hammaga to'liq berildi" : `${unpaidCount} ta xodimga berish kerak`}
          tone={totalRemaining === 0 ? 'text-green-700' : 'text-emerald-700'}
        />
      </div>

      {/* Qidiruv va ko'rinish */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <LuSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Xodim ismini yozing..." className="input-field pl-9 pr-9" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Tozalash">
              <LuX size={16} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{list.length} ta xodim</span>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            {[
              { id: 'cards', label: 'Kartalar', icon: LuLayoutGrid },
              { id: 'table', label: 'Jadval', icon: LuList },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                className={`flex items-center gap-1.5 px-3 h-8 rounded-md text-sm transition-colors cursor-pointer ${
                  viewMode === id ? 'bg-white text-slate-900 font-medium shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ro'yxat */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-72 bg-white border border-slate-200 rounded-xl animate-pulse" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="card text-center py-12">
          <LuWallet size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-base font-medium text-slate-900">{q ? `"${search}" ismli xodim topilmadi` : "Xodim yo'q"}</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {list.map(item => (
            <div key={item.id} className="card flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 font-semibold flex items-center justify-center flex-shrink-0">
                    {item.full_name?.[0] || 'X'}
                  </div>
                  <div className="min-w-0">
                    <Link
                      to={`/salary/${item.id}?y=${year}&m=${month}`}
                      className="block text-base font-semibold text-slate-900 truncate hover:text-emerald-700 hover:underline"
                      title="Har kungi to'liq ma'lumotni ko'rish"
                    >
                      {item.full_name}
                    </Link>
                    <p className="text-xs text-slate-500 truncate">
                      {item.worked_days} kun · {formatDuration(item.total_worked_seconds)}
                    </p>
                  </div>
                </div>
                <StatusBadge item={item} />
              </div>

              <div className="flex-1">
                <SalaryBreakdown item={item} compact />
              </div>

              <div className="mt-4 space-y-2">
                {perms.pay_salary && item.remaining_payable > 0 && (
                  <button onClick={() => setPaying(item)} className="btn-primary w-full">
                    <LuBanknote size={16} /> Pul berish
                  </button>
                )}
                <div className={`grid gap-2 ${perms.give_advance ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <button onClick={() => setReceiptId(item.id)} className="btn-secondary px-2" title="Chekni ko'rish">
                    <LuReceipt size={16} /> Chek
                  </button>
                  {perms.give_advance && (
                    <button onClick={() => setAdvancing(item)} className="btn-secondary px-2" title="Avans berish">
                      <LuHandCoins size={16} /> Avans
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head">Xodim</th>
                <th className="table-head text-right">Ishlab topdi</th>
                <th className="table-head text-right">Avans oldi</th>
                <th className="table-head text-right">Berildi</th>
                <th className="table-head text-right">Qoldi</th>
                <th className="table-head">Holat</th>
                <th className="table-head"></th>
              </tr>
            </thead>
            <tbody>
              {list.map(item => (
                <tr key={item.id} className="table-row">
                  <td className="table-cell">
                    <Link to={`/salary/${item.id}?y=${year}&m=${month}`} className="font-medium text-slate-900 hover:text-emerald-700 hover:underline">
                      {item.full_name}
                    </Link>
                    <p className="text-xs text-slate-500">{item.worked_days} kun · {formatDuration(item.total_worked_seconds)}</p>
                  </td>
                  <td className="table-cell text-right">{formatMoney(item.total_earned)}</td>
                  <td className="table-cell text-right text-red-600">{item.total_advances > 0 ? `−${formatMoney(item.total_advances)}` : '—'}</td>
                  <td className="table-cell text-right text-green-700">{item.paid_amount > 0 ? formatMoney(item.paid_amount) : '—'}</td>
                  <td className="table-cell text-right font-semibold text-slate-900">{formatMoney(item.remaining_payable)}</td>
                  <td className="table-cell"><StatusBadge item={item} /></td>
                  <td className="table-cell">
                    <div className="flex items-center justify-end gap-2">
                      {perms.pay_salary && item.remaining_payable > 0 && (
                        <button onClick={() => setPaying(item)} className="btn-primary h-9 px-3">
                          <LuBanknote size={16} /> Pul berish
                        </button>
                      )}
                      <button onClick={() => setReceiptId(item.id)} className="btn-secondary h-9 px-3" title="Chek">
                        <LuReceipt size={16} />
                      </button>
                      {perms.give_advance && (
                        <button onClick={() => setAdvancing(item)} className="btn-secondary h-9 px-3" title="Avans berish">
                          <LuHandCoins size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Chek */}
      {receipt && (
        <PayslipReceipt
          item={receipt}
          data={receipt.receipt}
          loading={false}
          month={month}
          year={year}
          onClose={() => setReceiptId(null)}
          onPay={perms.pay_salary ? () => setPaying(receipt) : null}
        />
      )}

      {advancing && (
        <PayDrawer
          advance
          row={advancing} year={year} month={month}
          onClose={() => setAdvancing(null)}
          onPaid={() => setReload(x => x + 1)}
        />
      )}

      {paying && (
        <PayDrawer
          row={paying} year={year} month={month}
          onClose={() => setPaying(null)}
          onPaid={() => setReload(x => x + 1)}
        />
      )}
    </div>
  )
}

function SummaryCard({ label, value, hint, tone = 'text-slate-900' }) {
  return (
    <div className="stat-card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-xl font-semibold truncate ${tone}`}>{formatMoney(value)}</p>
      {hint && <p className="text-xs text-slate-400 truncate">{hint}</p>}
    </div>
  )
}

function StatusBadge({ item }) {
  const remaining = getRemaining(item)
  if (remaining <= 0 && (item.net_payable || 0) > 0) {
    return <span className="badge-green flex-shrink-0"><LuCircleCheck size={12} /> Berildi</span>
  }
  if ((item.paid_amount || 0) > 0) return <span className="badge-yellow flex-shrink-0">Qisman berildi</span>
  if (remaining > 0) return <span className="badge-gray flex-shrink-0">Berilmagan</span>
  return <span className="badge-gray flex-shrink-0">Hisob yo'q</span>
}
