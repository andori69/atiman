// @ts-nocheck
import { useEffect, useRef } from 'react'

interface ModalProps {
  onClose: () => void
  children: React.ReactNode
  maxWidth?: string
  /** 'sheet' = bottom-sheet on mobile, centered on desktop (default) */
  variant?: 'default' | 'sheet'
}

export function Modal({ onClose, children, maxWidth = 'max-w-lg', variant = 'sheet' }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ willChange: 'opacity' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className={`relative w-full ${maxWidth} flex flex-col`}
        style={{
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.6)',
          borderRadius: '20px 20px 20px 20px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.18)',
          maxHeight: '92vh',
          overflowY: 'auto',
        }}
      >
        {/* Drag indicator on mobile */}
        <div className="w-10 h-1 rounded-full mx-auto mt-3 sm:hidden flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.1)' }} />
        {children}
      </div>
    </div>
  )
}

export function ModalHeader({ title, subtitle, onClose }: {
  title: string
  subtitle?: string
  onClose: () => void
}) {
  return (
    <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0"
      style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
      <div>
        <h2 className="text-[18px] font-bold text-[#1D1D1F]">{title}</h2>
        {subtitle && <p className="text-[13px] text-[#6E6E73] mt-0.5">{subtitle}</p>}
      </div>
      <button
        onClick={onClose}
        className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
        style={{ background: 'rgba(0,0,0,0.06)' }}
      >
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M1 1L12 12M12 1L1 12" stroke="#6E6E73" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
