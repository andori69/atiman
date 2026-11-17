// @ts-nocheck
import { useEffect, useRef, useState } from 'react'
import { QrCode, X, CreditCard, Check } from 'lucide-react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'

const GLASS = {
  background: 'rgba(255,255,255,0.22)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.45)',
  borderRadius: 16,
  boxShadow: '0 8px 32px rgba(108,92,231,0.06), 0 1px 1px rgba(255,255,255,0.5) inset',
}

const LABEL = 'block text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5'
const INPUT = 'w-full h-11 rounded-xl px-4 text-[15px] text-[#1e1b4b] outline-none transition-all'
const INPUT_STYLE = { background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.7)' }

type ScannedTenant = {
  id: string; name: string; room_number: string | null
  per_person_rent: number; month_year: string
}

const METHODS = ['Cash', 'GCash', 'Bank Transfer', 'Other']

function currentMonthYear() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
function formatMonthYear(mk: string) {
  const [year, month] = mk.split('-')
  return `${MONTH_NAMES[parseInt(month) - 1]} ${year}`
}

function LogPaymentModal({ tenant, onClose, onSaved }: {
  tenant: ScannedTenant; onClose: () => void; onSaved: () => void
}) {
  const [method, setMethod] = useState('Cash')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function handleConfirm() {
    setSaving(true)
    await supabase.from('payments').insert({
      tenant_id: tenant.id,
      amount: tenant.per_person_rent,
      month_year: tenant.month_year,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_method: method.toLowerCase().replace(' ', '_'),
      status: 'confirmed',
    })
    setDone(true)
    setSaving(false)
    setTimeout(() => { onSaved(); onClose() }, 1200)
  }

  const modalStyle = {
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(14px)',
    WebkitBackdropFilter: 'blur(14px)',
    border: '1px solid rgba(255,255,255,0.7)',
    borderRadius: 20,
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
        <div className="relative w-full max-w-sm p-8 text-center" style={modalStyle}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(52,199,89,0.15)' }}>
            <Check size={32} className="text-green-600" />
          </div>
          <p className="text-[18px] font-semibold text-[#1e1b4b]">Payment Logged!</p>
          <p className="text-[14px] text-slate-400 mt-1">{formatCurrency(tenant.per_person_rent)} · {tenant.name}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md" style={modalStyle}>
        <div className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.5)' }}>
          <div>
            <h2 className="text-[18px] font-semibold text-[#1e1b4b]">Log Payment</h2>
            <p className="text-[13px] text-slate-400 mt-0.5">{tenant.name} · Room {tenant.room_number ?? '—'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400"
            style={{ background: 'rgba(0,0,0,0.05)' }}><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 rounded-xl text-center"
            style={{ background: 'rgba(108,92,231,0.06)', border: '1px solid rgba(108,92,231,0.15)' }}>
            <p className="text-[12px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
              {formatMonthYear(tenant.month_year)}
            </p>
            <p className="text-[32px] font-bold text-[#6C5CE7] tabular-nums">
              {formatCurrency(tenant.per_person_rent)}
            </p>
          </div>

          <div>
            <label className={LABEL}>Payment Method</label>
            <div className="flex flex-wrap gap-2">
              {METHODS.map(m => (
                <button key={m} type="button" onClick={() => setMethod(m)}
                  className="px-3 py-1.5 rounded-full text-[13px] font-medium transition-all"
                  style={method === m
                    ? { background: 'rgba(108,92,231,0.15)', color: '#6C5CE7', border: '1px solid rgba(108,92,231,0.3)' }
                    : { background: 'rgba(255,255,255,0.5)', color: '#64748b', border: '1px solid rgba(255,255,255,0.7)' }}>
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-xl font-medium text-[15px] text-[#1e1b4b]"
              style={{ background: 'rgba(0,0,0,0.06)' }}>Cancel</button>
            <button onClick={handleConfirm} disabled={saving}
              className="flex-1 h-11 rounded-xl font-medium text-[15px] text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'rgba(52,199,89,0.85)', boxShadow: '0 4px 12px rgba(52,199,89,0.3)' }}>
              <CreditCard size={15} />
              {saving ? 'Saving…' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Scanner() {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const [scanned, setScanned] = useState<ScannedTenant | null>(null)
  const [scanning, setScanning] = useState(true)
  const [manualCode, setManualCode] = useState('')
  const [lookupError, setLookupError] = useState('')
  const [showManual, setShowManual] = useState(false)

  const SOLO_DISCOUNT = 500
  function perPerson(rent: number, occ: number) { return occ <= 1 ? rent - SOLO_DISCOUNT : rent / occ }

  useEffect(() => {
    if (!scanning) return
    const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 220 }, false)
    scanner.render(
      async (decodedText) => {
        scanner.clear()
        setScanning(false)
        await lookupTenant(decodedText)
      },
      () => {}
    )
    scannerRef.current = scanner
    return () => { scanner.clear().catch(() => {}) }
  }, [scanning])

  async function lookupTenant(qrCode: string) {
    setLookupError('')
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, name, occupants, room:rooms(room_number, rent_amount)')
      .eq('qr_code', qrCode)
      .eq('is_active', true)
      .maybeSingle()

    if (!tenant) { setLookupError('No active renter found for this QR code.'); setScanning(false); return }

    const rent = (tenant.room as any)?.rent_amount ?? 0
    const occ = tenant.occupants ?? 1
    if (typeof window !== 'undefined' && navigator.vibrate) navigator.vibrate(100)

    setScanned({
      id: tenant.id,
      name: tenant.name,
      room_number: (tenant.room as any)?.room_number ?? null,
      per_person_rent: perPerson(rent, occ),
      month_year: currentMonthYear(),
    })
  }

  async function handleManualLookup() {
    if (!manualCode.trim()) return
    setLookupError('')
    await lookupTenant(manualCode.trim())
  }

  function reset() {
    setScanned(null)
    setLookupError('')
    setManualCode('')
    setShowManual(false)
    setScanning(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1e1b4b]">QR Scanner</h1>
        <p className="text-[15px] text-slate-400 mt-0.5">Scan a renter's QR code to log a payment instantly</p>
      </div>

      <div style={GLASS} className="overflow-hidden">
        {scanning ? (
          <div className="p-6">
            <div id="qr-reader" className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden" />
            <p className="text-[13px] text-slate-400 text-center mt-4">
              Point camera at a renter's QR code
            </p>
            <div className="text-center mt-4">
              <button onClick={() => { setScanning(false); setShowManual(true) }}
                className="text-[13px] font-medium underline underline-offset-2"
                style={{ color: '#6C5CE7' }}>
                Enter code manually instead
              </button>
            </div>
          </div>
        ) : showManual && !scanned ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <QrCode size={18} className="text-slate-400" />
              <p className="text-[15px] font-semibold text-[#1e1b4b]">Enter QR Code Manually</p>
            </div>
            {lookupError && (
              <div className="p-3 bg-red-50 rounded-xl text-sm text-red-600">{lookupError}</div>
            )}
            <div>
              <label className={LABEL}>QR Code / Tenant ID</label>
              <input value={manualCode} onChange={e => setManualCode(e.target.value)}
                placeholder="ATIMAN-XXXXXXXX…"
                onKeyDown={e => e.key === 'Enter' && handleManualLookup()}
                className={INPUT} style={INPUT_STYLE} />
            </div>
            <div className="flex gap-3">
              <button onClick={reset}
                className="flex-1 h-11 rounded-xl font-medium text-[14px] text-[#1e1b4b]"
                style={{ background: 'rgba(0,0,0,0.06)' }}>
                Use Camera
              </button>
              <button onClick={handleManualLookup} disabled={!manualCode.trim()}
                className="flex-1 h-11 rounded-xl font-medium text-[14px] text-white disabled:opacity-40"
                style={{ background: 'rgba(108,92,231,0.85)', boxShadow: '0 4px 12px rgba(108,92,231,0.3)' }}>
                Look Up
              </button>
            </div>
          </div>
        ) : lookupError && !scanned ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(255,59,48,0.1)' }}>
              <QrCode size={24} className="text-red-500" />
            </div>
            <p className="text-[15px] font-semibold text-[#1e1b4b] mb-1">Not Found</p>
            <p className="text-[13px] text-slate-400 mb-5">{lookupError}</p>
            <button onClick={reset}
              className="h-11 px-6 rounded-xl font-medium text-[14px] text-white"
              style={{ background: 'rgba(108,92,231,0.85)', boxShadow: '0 4px 12px rgba(108,92,231,0.3)' }}>
              Scan Again
            </button>
          </div>
        ) : null}
      </div>

      {scanned && (
        <LogPaymentModal
          tenant={scanned}
          onClose={reset}
          onSaved={reset}
        />
      )}
    </div>
  )
}
