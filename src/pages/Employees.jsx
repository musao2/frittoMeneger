import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { LuPlus, LuSearch, LuUsers, LuX, LuSave, LuCircleAlert, LuWandSparkles, LuCopy, LuCheck, LuEye, LuEyeOff } from 'react-icons/lu'
import {
  supabase, employeeFunctions, salaryRateFunctions, scheduleFunctions, trialFunctions,
  createSecondaryAuthClient, formatRate,
} from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../context/PermissionsContext'

const WEEK_DAYS = [
  { key: 'Mon', label: 'Du' }, { key: 'Tue', label: 'Se' }, { key: 'Wed', label: 'Chor' },
  { key: 'Thu', label: 'Pay' }, { key: 'Fri', label: 'Ju' }, { key: 'Sat', label: 'Sha' }, { key: 'Sun', label: 'Yak' },
]
const STATUS = {
  active:   { label: 'Ishlayapti', cls: 'badge-green' },
  trial:    { label: 'Sinovda',    cls: 'badge-yellow' },
  inactive: { label: "Bo'shagan",  cls: 'badge-gray' },
  rejected: { label: 'Rad etilgan', cls: 'badge-gray' },
}
const today = () => new Date().toISOString().split('T')[0]
const EMPTY = {
  email: '', password: '', full_name: '', phone: '', position: '', branch_id: '', branch: 'Asosiy',
  hire_date: today(), salary_type: 'hourly', hourly_rate: '', monthly_salary: '', shift_start: '09:00', shift_end: '18:00',
  work_days: WEEK_DAYS.map(d => d.key), is_trial: false, trial_days: 5,
}

function generatePassword() {
  const n = crypto.getRandomValues(new Uint32Array(2))
  const letters = 'abcdefghjkmnpqrstuvwxyz'
  return `Fritto-${1000 + (n[0] % 9000)}-${letters[n[1] % 23]}${letters[(n[1] >>> 8) % 23]}`
}

const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('') || '?'

export default function Employees() {
  const { perms } = usePermissions()
  const [employees, setEmployees] = useState([])
  const [branches, setBranches]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [showForm, setShowForm]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [emps, br] = await Promise.all([
        employeeFunctions.getAll(),
        supabase.from('branches').select('id, name, is_active').order('created_at'),
      ])
      setEmployees(emps)
      setBranches(br.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const branchName = (e) => branches.find(b => b.id === e.branch_id)?.name || e.branch || '—'
  const q = search.trim().toLowerCase()
  const list = employees.filter(e => !q || [e.full_name, e.phone, e.position, branchName(e)].some(v => (v || '').toLowerCase().includes(q)))
  const working = employees.filter(e => e.status === 'active' || e.status === 'trial').length

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Xodimlar</h1>
          <p className="page-subtitle">Jami {employees.length} ta · {working} ta ishlayapti</p>
        </div>
        {perms.add_employees && (
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <LuPlus size={16} /> Xodim qo'shish
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <LuSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ism, telefon yoki lavozim..." className="input-field pl-9" />
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-white border border-slate-200 rounded-xl animate-pulse" />)}</div>
      ) : list.length === 0 ? (
        <div className="card text-center py-12">
          <LuUsers size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-base font-medium text-slate-900">{q ? 'Xodim topilmadi' : "Hali xodim qo'shilmagan"}</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-head">Xodim</th>
                <th className="table-head">Lavozim</th>
                <th className="table-head hidden md:table-cell">Ish vaqti</th>
                {perms.view_salary && <th className="table-head text-right">Maosh</th>}
                <th className="table-head">Holat</th>
              </tr>
            </thead>
            <tbody>
              {list.map(e => {
                const rate = e.salary_rates?.find(r => !r.effective_to)
                const sch = (e.work_schedules || [])[0]
                const st = STATUS[e.status] || STATUS.active
                return (
                  <tr key={e.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-700 text-sm font-semibold flex items-center justify-center flex-shrink-0">
                          {initials(e.full_name)}
                        </div>
                        <div className="min-w-0">
                          {(perms.view_salary || perms.pay_salary || perms.give_advance)
                            ? <Link to={`/salary/${e.id}`} className="block font-medium text-slate-900 truncate max-w-56 hover:text-emerald-700 hover:underline">{e.full_name}</Link>
                            : <p className="font-medium text-slate-900 truncate max-w-56">{e.full_name}</p>}
                          <p className="text-xs text-slate-500">{e.phone || "Telefon yo'q"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <p className="text-slate-900">{e.position || '—'}</p>
                      <p className="text-xs text-slate-500">{branchName(e)}</p>
                    </td>
                    <td className="table-cell hidden md:table-cell">
                      {sch ? `${sch.shift_start?.slice(0, 5)} — ${sch.shift_end?.slice(0, 5)}` : '—'}
                    </td>
                    {perms.view_salary && <td className="table-cell text-right">{formatRate(rate)}</td>}
                    <td className="table-cell"><span className={st.cls}>{st.label}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <AddEmployee branches={branches} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />
      )}
    </div>
  )
}

function AddEmployee({ branches, onClose, onSaved }) {
  const { user } = useAuth()
  const first = branches.find(b => b.is_active) || branches[0]
  const [f, setF] = useState({ ...EMPTY, branch_id: first?.id || '', branch: first?.name || EMPTY.branch })
  const [show, setShow]   = useState(false)
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const [done, setDone]   = useState(null) // muvaffaqiyatli qo'shilgach: { email, password }
  const [copied, setCopied] = useState(false)

  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  const save = async (e) => {
    e.preventDefault()
    setError('')
    if (!f.full_name.trim() || !f.position.trim() || !f.hire_date) return setError('Ism, lavozim va ishga kirgan sana majburiy')
    if (!f.email.includes('@')) return setError("Email noto'g'ri")
    if (f.password.length < 6) return setError("Parol kamida 6 ta belgi bo'lsin")
    if (!f.work_days.length) return setError('Kamida bitta ish kuni tanlang')

    setBusy(true)
    try {
      // 1) Kirish hisobi (menejerning o'z sessiyasi uzilmasligi uchun alohida klient)
      const { data: su, error: suErr } = await createSecondaryAuthClient().auth.signUp({
        email: f.email.trim(), password: f.password,
        options: { data: { role: 'employee', full_name: f.full_name.trim() } },
      })
      if (suErr) throw suErr
      const userId = su.user?.id

      // 2) Xodim
      const emp = await employeeFunctions.create({
        user_id: userId || null,
        full_name: f.full_name.trim(),
        phone: f.phone.trim(),
        position: f.position.trim(),
        branch: f.branch,
        branch_id: f.branch_id || null,
        hire_date: f.hire_date,
        status: f.is_trial ? 'trial' : 'active',
        confirmed_at: f.is_trial ? null : new Date().toISOString(),
        notes: JSON.stringify({ user_notes: '', allowed_late_minutes: 10, schedule_mode: 'same' }),
      })

      // 3) Parol nusxasi (admin keyin ko'ra oladi), stavka, ish jadvali, sinov
      if (userId) await supabase.rpc('admin_store_password', { p_user_id: userId, p_password: f.password })
      if (f.salary_type === 'monthly' ? f.monthly_salary : f.hourly_rate) {
        await salaryRateFunctions.set(emp.id, parseFloat(f.hourly_rate) || 0, f.hire_date, user.id,
          { monthlySalary: f.salary_type === 'monthly' ? parseFloat(f.monthly_salary) : 0 })
      }
      await scheduleFunctions.upsert(emp.id, [{
        shift_start: f.shift_start, shift_end: f.shift_end, branch: f.branch, work_days: f.work_days,
      }])
      if (f.is_trial) await trialFunctions.assignTrial(emp.id, f.trial_days, f.hire_date)

      setDone({ name: f.full_name.trim(), email: f.email.trim(), password: f.password })
    } catch (err) {
      setError(err.message?.includes('already registered') ? "Bu email bilan hisob allaqachon bor" : err.message)
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${done.name}\nEmail: ${done.email}\nParol: ${done.password}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ahamiyatsiz */ }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !busy && (done ? onSaved() : onClose())}>
      <form onSubmit={save} className="drawer-panel">
        <div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-base font-semibold text-slate-900">Yangi xodim</h2>
          <button type="button" onClick={() => done ? onSaved() : onClose()} className="p-2 -mr-2 text-slate-400 hover:text-slate-900 cursor-pointer" aria-label="Yopish">
            <LuX size={20} />
          </button>
        </div>

        {done ? (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-md mx-auto p-6 space-y-5 text-center">
              <div className="w-16 h-16 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto"><LuCheck size={32} /></div>
              <p className="text-lg font-semibold text-slate-900">{done.name} qo'shildi</p>
              <div className="text-left border border-slate-200 rounded-lg divide-y divide-slate-100">
                <div className="flex justify-between gap-3 px-4 py-2.5 text-sm"><span className="text-slate-500">Email</span><span className="text-slate-900 break-all">{done.email}</span></div>
                <div className="flex justify-between gap-3 px-4 py-2.5 text-sm"><span className="text-slate-500">Parol</span><span className="font-mono text-slate-900">{done.password}</span></div>
              </div>
              <button type="button" onClick={copy} className="btn-secondary w-full">
                {copied ? <LuCheck size={16} /> : <LuCopy size={16} />} {copied ? 'Nusxalandi' : 'Email va parolni nusxalash'}
              </button>
              <p className="text-xs text-slate-500">Xodim birinchi marta kirganda telefoni admin tomonidan tasdiqlanadi.</p>
              <button type="button" onClick={onSaved} className="btn-primary w-full">Tayyor</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-xl mx-auto p-6 space-y-7">
                {error && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                    <LuCircleAlert size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <Section title="Tizimga kirish" hint="Xodim shu email va parol bilan o'z sahifasiga kiradi">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Email *"><input type="email" value={f.email} onChange={e => set('email', e.target.value)} className="input-field" placeholder="ism@fritto.uz" /></Field>
                    <Field label="Parol *">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input type={show ? 'text' : 'password'} value={f.password} onChange={e => set('password', e.target.value)} className="input-field pr-10" placeholder="Kamida 6 belgi" autoComplete="new-password" />
                          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Parolni ko'rsatish">
                            {show ? <LuEyeOff size={16} /> : <LuEye size={16} />}
                          </button>
                        </div>
                        <button type="button" onClick={() => { set('password', generatePassword()); setShow(true) }} className="btn-secondary px-3" title="Parol yaratish"><LuWandSparkles size={16} /></button>
                      </div>
                    </Field>
                  </div>
                </Section>

                <Section title="Shaxsiy ma'lumot">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Ism va familiya *"><input value={f.full_name} onChange={e => set('full_name', e.target.value)} className="input-field" placeholder="Abdullayev Azizbek" /></Field>
                    <Field label="Telefon"><input value={f.phone} onChange={e => set('phone', e.target.value)} className="input-field" placeholder="+998 90 123 45 67" /></Field>
                  </div>
                </Section>

                <Section title="Ish va maosh">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Lavozim *"><input value={f.position} onChange={e => set('position', e.target.value)} className="input-field" placeholder="Oshpaz, kassir..." /></Field>
                    <Field label="Filial">
                      {branches.length ? (
                        <select value={f.branch_id} onChange={e => { const b = branches.find(x => x.id === e.target.value); setF(x => ({ ...x, branch_id: e.target.value, branch: b?.name || x.branch })) }} className="input-field">
                          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      ) : (
                        <input value={f.branch} onChange={e => set('branch', e.target.value)} className="input-field" />
                      )}
                    </Field>
                    <Field label="Ishga kirgan sana *"><input type="date" value={f.hire_date} onChange={e => set('hire_date', e.target.value)} className="input-field" /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {[['hourly', 'Soatbay', 'Ishlagan soatiga qarab'], ['monthly', 'Oylik', 'Belgilangan summa']].map(([v, t, d]) => (
                      <button key={v} type="button" onClick={() => set('salary_type', v)}
                        className={`text-left rounded-lg border px-3 py-2.5 cursor-pointer ${f.salary_type === v ? 'border-emerald-600 bg-emerald-50' : 'border-slate-300 hover:border-slate-400'}`}>
                        <p className="text-sm font-medium text-slate-900">{t}</p>
                        <p className="text-xs text-slate-500">{d}</p>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3">
                    {f.salary_type === 'monthly'
                      ? <Field label="Oylik maosh (so'm)"><input type="number" value={f.monthly_salary} onChange={e => set('monthly_salary', e.target.value)} className="input-field" placeholder="5000000" /></Field>
                      : <Field label="Bir soatlik maosh (so'm)"><input type="number" value={f.hourly_rate} onChange={e => set('hourly_rate', e.target.value)} className="input-field" placeholder="25000" /></Field>}
                    <p className="text-xs text-slate-500 mt-2">
                      Ixtiyoriy. Maosh yozilsa — xodim o'z oyligini ilovada ko'radi. Bo'sh qoldirilsa — faqat ishlagan vaqtini ko'radi, oylikni admin hisoblab aytadi.
                    </p>
                  </div>
                </Section>

                <Section title="Ish vaqti">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Keladi"><input type="time" value={f.shift_start} onChange={e => set('shift_start', e.target.value)} className="input-field" /></Field>
                    <Field label="Ketadi"><input type="time" value={f.shift_end} onChange={e => set('shift_end', e.target.value)} className="input-field" /></Field>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {WEEK_DAYS.map(d => {
                      const on = f.work_days.includes(d.key)
                      return (
                        <button
                          key={d.key} type="button"
                          onClick={() => set('work_days', on ? f.work_days.filter(k => k !== d.key) : WEEK_DAYS.map(w => w.key).filter(k => k === d.key || f.work_days.includes(k)))}
                          className={`h-10 rounded-lg border text-sm cursor-pointer ${on ? 'border-emerald-600 bg-emerald-50 text-emerald-800 font-medium' : 'border-slate-300 text-slate-400'}`}
                        >
                          {d.label}
                        </button>
                      )
                    })}
                  </div>
                </Section>

                <Section title="Sinov muddati">
                  <label className="flex items-center justify-between gap-4 cursor-pointer">
                    <span className="text-sm text-slate-900">Avval sinab ko'rish</span>
                    <input type="checkbox" checked={f.is_trial} onChange={e => set('is_trial', e.target.checked)} className="w-5 h-5 accent-[#FCA914]" />
                  </label>
                  {f.is_trial && (
                    <select value={f.trial_days} onChange={e => set('trial_days', parseInt(e.target.value))} className="input-field">
                      {[3, 5, 7, 10, 14, 30].map(d => <option key={d} value={d}>{d} kun</option>)}
                    </select>
                  )}
                </Section>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex gap-2 flex-shrink-0">
              <button type="button" onClick={onClose} disabled={busy} className="btn-secondary">Bekor qilish</button>
              <button type="submit" disabled={busy} className="btn-primary flex-1">
                {busy ? <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" /> : <LuSave size={16} />}
                Xodimni qo'shish
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}

function Section({ title, hint, children }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  )
}
