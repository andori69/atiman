// @ts-nocheck
import { useState } from 'react'
import { Clock } from 'lucide-react'

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
const MINUTES = [0, 15, 30, 45]

function parseValue(v: string): { hour: number; minute: number; ampm: 'AM' | 'PM' } {
  if (!v) return { hour: 8, minute: 0, ampm: 'AM' }
  const [h, m] = v.split(':').map(Number)
  return {
    ampm: h >= 12 ? 'PM' : 'AM',
    hour: h % 12 || 12,
    minute: m,
  }
}

function buildValue(hour: number, minute: number, ampm: 'AM' | 'PM') {
  const h24 = ampm === 'AM' ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12)
  return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function formatDisplay(v: string) {
  if (!v) return ''
  const { hour, minute, ampm } = parseValue(v)
  return `${hour}:${String(minute).padStart(2, '0')} ${ampm}`
}

export interface TimePickerProps {
  value: string
  onChange: (v: string) => void
  label?: string
  placeholder?: string
  variant?: 'light' | 'glass'
}

export function TimePicker({ value, onChange, label, placeholder = 'Select time', variant = 'light' }: TimePickerProps) {
  const [open, setOpen] = useState(false)

  const isGlass = variant === 'glass'
  const accent = isGlass ? '#6C5CE7' : '#0071E3'
  const triggerBg = isGlass ? 'rgba(255,255,255,0.18)' : '#F5F5F7'
  const triggerBgActive = isGlass ? 'rgba(108,92,231,0.1)' : 'rgba(0,113,227,0.07)'
  const triggerBorderActive = isGlass ? '1.5px solid rgba(108,92,231,0.4)' : '1.5px solid rgba(0,113,227,0.35)'
  const labelColor = isGlass ? '#94a3b8' : '#6E6E73'
  const cellBg = isGlass ? 'rgba(255,255,255,0.25)' : '#F5F5F7'
  const cellBgHover = isGlass ? 'rgba(255,255,255,0.4)' : '#E8E8ED'
  const doneBg = isGlass ? 'rgba(108,92,231,0.1)' : 'rgba(0,113,227,0.1)'
  const doneBgHover = isGlass ? 'rgba(108,92,231,0.18)' : 'rgba(0,113,227,0.16)'

  const { hour, minute, ampm } = parseValue(value)

  function setHour(h: number) {
    onChange(buildValue(h, minute, ampm))
  }
  function setMinute(m: number) {
    onChange(buildValue(hour, m, ampm))
  }
  function setAmPm(ap: 'AM' | 'PM') {
    onChange(buildValue(hour, minute, ap))
  }

  const BTN = (active: boolean) => ({
    background: active ? accent : cellBg,
    color: active ? '#fff' : '#1D1D1F',
    fontWeight: active ? 700 : 500,
    transition: 'all 0.15s ease',
  })

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
        <Clock size={15} style={{ color: open ? accent : '#AEAEB2', flexShrink: 0 }} />
      </button>

      {/* Time panel */}
      {open && (
        <div className="mt-2 rounded-2xl p-4 space-y-4"
          style={{
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.07)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
          }}>

          {/* Hours */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5"
              style={{ color: '#AEAEB2' }}>Hour</p>
            <div className="grid grid-cols-6 gap-1.5">
              {HOURS.map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHour(h)}
                  className="h-9 rounded-xl text-[13px] transition-all"
                  style={BTN(hour === h)}
                  onMouseEnter={e => { if (hour !== h) e.currentTarget.style.background = cellBgHover }}
                  onMouseLeave={e => { if (hour !== h) e.currentTarget.style.background = cellBg }}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Minutes */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5"
              style={{ color: '#AEAEB2' }}>Minute</p>
            <div className="grid grid-cols-4 gap-1.5">
              {MINUTES.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinute(m)}
                  className="h-9 rounded-xl text-[13px] transition-all"
                  style={BTN(minute === m)}
                  onMouseEnter={e => { if (minute !== m) e.currentTarget.style.background = cellBgHover }}
                  onMouseLeave={e => { if (minute !== m) e.currentTarget.style.background = cellBg }}
                >
                  :{String(m).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>

          {/* AM / PM */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5"
              style={{ color: '#AEAEB2' }}>Period</p>
            <div className="grid grid-cols-2 gap-2">
              {(['AM', 'PM'] as const).map(ap => (
                <button
                  key={ap}
                  type="button"
                  onClick={() => setAmPm(ap)}
                  className="h-11 rounded-xl text-[15px] transition-all"
                  style={BTN(ampm === ap)}
                  onMouseEnter={e => { if (ampm !== ap) e.currentTarget.style.background = cellBgHover }}
                  onMouseLeave={e => { if (ampm !== ap) e.currentTarget.style.background = cellBg }}
                >
                  {ap}
                </button>
              ))}
            </div>
          </div>

          {/* Done */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full h-10 rounded-xl text-[14px] font-semibold transition-all"
            style={{ background: doneBg, color: accent }}
            onMouseEnter={e => (e.currentTarget.style.background = doneBgHover)}
            onMouseLeave={e => (e.currentTarget.style.background = doneBg)}
          >
            Done
          </button>
        </div>
      )}
    </div>
  )
}
