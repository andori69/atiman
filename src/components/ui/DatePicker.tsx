// @ts-nocheck
import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'

const MO = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DN = ['Su','Mo','Tu','We','Th','Fr','Sa']

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export interface DatePickerProps {
  value: string
  onChange: (v: string) => void
  min?: string
  max?: string
  label?: string
  placeholder?: string
  /** 'light' = renter Apple style, 'glass' = landlord glassmorphism */
  variant?: 'light' | 'glass'
}

export function DatePicker({ value, onChange, min, max, label, placeholder = 'Select date', variant = 'light' }: DatePickerProps) {
  const today = todayStr()
  const parsed = value ? new Date(value + 'T12:00:00') : new Date()

  const isGlass = variant === 'glass'
  const triggerBg = isGlass ? 'rgba(255,255,255,0.18)' : '#F5F5F7'
  const triggerBgActive = isGlass ? 'rgba(108,92,231,0.1)' : 'rgba(0,113,227,0.07)'
  const triggerBorderActive = isGlass ? '1.5px solid rgba(108,92,231,0.4)' : '1.5px solid rgba(0,113,227,0.35)'
  const accent = isGlass ? '#6C5CE7' : '#0071E3'
  const accentBg = isGlass ? 'rgba(108,92,231,0.1)' : 'rgba(0,113,227,0.1)'
  const labelColor = isGlass ? '#94a3b8' : '#6E6E73'

  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(parsed.getFullYear())
  const [viewMonth, setViewMonth] = useState(parsed.getMonth())

  const days = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay()
    const dim = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: (number | null)[] = Array(firstDay).fill(null)
    for (let d = 1; d <= dim; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [viewYear, viewMonth])

  function ds(d: number) {
    return `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
  }

  function disabled(d: number) {
    const s = ds(d)
    return (!!min && s < min) || (!!max && s > max)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function formatDisplay(v: string) {
    if (!v) return ''
    const d = new Date(v + 'T12:00:00')
    return d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
  }

  return (
    <div>
      {label && (
        <label className="block text-[11px] font-semibold uppercase tracking-widest mb-2"
          style={{ color: labelColor }}>
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full h-11 rounded-xl px-4 flex items-center justify-between text-[14px] transition-all"
        style={{
          background: open ? triggerBgActive : triggerBg,
          border: open ? triggerBorderActive : '1.5px solid transparent',
          color: value ? '#1D1D1F' : '#AEAEB2',
        }}
      >
        <span className="font-medium">{value ? formatDisplay(value) : placeholder}</span>
        <Calendar size={15} style={{ color: open ? accent : '#AEAEB2', flexShrink: 0 }} />
      </button>

      {/* Calendar panel */}
      {open && (
        <div className="mt-2 rounded-2xl overflow-hidden"
          style={{
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.07)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
          }}>

          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <button type="button" onClick={prevMonth}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={{ background: '#F5F5F7' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#E8E8ED')}
              onMouseLeave={e => (e.currentTarget.style.background = '#F5F5F7')}>
              <ChevronLeft size={14} style={{ color: '#6E6E73' }} />
            </button>
            <span className="text-[14px] font-bold text-[#1D1D1F]">
              {MO[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth}
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={{ background: '#F5F5F7' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#E8E8ED')}
              onMouseLeave={e => (e.currentTarget.style.background = '#F5F5F7')}>
              <ChevronRight size={14} style={{ color: '#6E6E73' }} />
            </button>
          </div>

          <div className="p-3 pb-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DN.map(d => (
                <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wide py-1.5"
                  style={{ color: '#C7C7CC' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {days.map((d, i) => {
                if (!d) return <div key={`e-${i}`} />
                const s = ds(d)
                const isSelected = s === value
                const isToday = s === today
                const isDisabled = disabled(d)
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => { onChange(s); setOpen(false) }}
                    className="flex items-center justify-center h-9 w-full rounded-xl text-[13px] transition-all"
                    style={
                      isSelected ? {
                        background: accent,
                        color: '#fff',
                        fontWeight: 700,
                      } : isToday ? {
                        background: accentBg,
                        color: accent,
                        fontWeight: 700,
                      } : isDisabled ? {
                        color: '#D2D2D7',
                        cursor: 'not-allowed',
                      } : {
                        color: '#1D1D1F',
                        fontWeight: 500,
                      }
                    }
                    onMouseEnter={e => {
                      if (!isSelected && !isDisabled) e.currentTarget.style.background = 'rgba(0,0,0,0.05)'
                    }}
                    onMouseLeave={e => {
                      if (!isSelected && !isDisabled)
                        e.currentTarget.style.background = isToday ? 'rgba(0,113,227,0.1)' : ''
                    }}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
