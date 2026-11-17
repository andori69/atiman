export interface ReceiptData {
  type: 'rent' | 'electricity'
  receiptNumber: string
  boardingHouseName: string
  landlordName: string
  address: string
  phone: string
  renterName: string
  roomNumber: string
  amount: number
  paymentDate: string
  period: string
}

function fmt(n: number) {
  return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

export function downloadReceiptJpg(data: ReceiptData) {
  const W = 480
  const FONT = '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif'
  const ACCENT = data.type === 'rent' ? '#6C5CE7' : '#f59e0b'

  // First pass on an oversized canvas to measure height
  const c = document.createElement('canvas')
  c.width = W
  c.height = 900
  const ctx = c.getContext('2d')!

  /* ── Background ── */
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, c.height)

  /* ── Top accent bar ── */
  ctx.fillStyle = ACCENT
  ctx.fillRect(0, 0, W, 5)

  let y = 30

  /* ── Header: logo + title + badge ── */
  // Logo circle
  ctx.fillStyle = data.type === 'rent' ? 'rgba(108,92,231,0.1)' : 'rgba(245,158,11,0.1)'
  ctx.beginPath(); ctx.arc(44, y + 14, 20, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = ACCENT
  ctx.font = `bold 14px ${FONT}`; ctx.textAlign = 'center'
  ctx.fillText('A', 44, y + 20)

  ctx.fillStyle = '#1e1b4b'; ctx.font = `bold 18px ${FONT}`; ctx.textAlign = 'left'
  ctx.fillText('ATIMAN', 74, y + 11)
  ctx.fillStyle = '#94a3b8'; ctx.font = `10px ${FONT}`
  ctx.fillText('Boarding House Management', 74, y + 26)

  // Receipt type badge
  const badge = data.type === 'rent' ? 'RENT RECEIPT' : 'ELECTRICITY RECEIPT'
  ctx.fillStyle = ACCENT
  rr(ctx, W - 148, y - 2, 128, 30, 8); ctx.fill()
  ctx.fillStyle = '#ffffff'; ctx.font = `bold 9px ${FONT}`; ctx.textAlign = 'center'
  ctx.fillText(badge, W - 84, y + 17)

  y += 52

  /* ── Divider ── */
  ctx.strokeStyle = '#e8e8ed'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(W - 24, y); ctx.stroke()
  y += 20

  /* ── Boarding house info ── */
  ctx.fillStyle = '#94a3b8'; ctx.font = `9px ${FONT}`; ctx.textAlign = 'left'
  ctx.fillText('ISSUED BY', 24, y); y += 16
  ctx.fillStyle = '#1e1b4b'; ctx.font = `bold 15px ${FONT}`
  ctx.fillText(data.boardingHouseName || 'Boarding House', 24, y); y += 19
  ctx.fillStyle = '#64748b'; ctx.font = `12px ${FONT}`
  if (data.address) { ctx.fillText(data.address, 24, y); y += 16 }
  if (data.phone) { ctx.fillText(data.phone, 24, y); y += 16 }
  ctx.fillText(`Landlord: ${data.landlordName}`, 24, y); y += 22

  /* ── Divider ── */
  ctx.strokeStyle = '#e8e8ed'
  ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(W - 24, y); ctx.stroke()
  y += 18

  /* ── Renter info ── */
  ctx.fillStyle = '#94a3b8'; ctx.font = `9px ${FONT}`; ctx.textAlign = 'left'
  ctx.fillText('BILLED TO', 24, y); y += 16
  ctx.fillStyle = '#1e1b4b'; ctx.font = `bold 14px ${FONT}`
  ctx.fillText(data.renterName, 24, y); y += 17
  ctx.fillStyle = '#64748b'; ctx.font = `12px ${FONT}`
  ctx.fillText(`Room ${data.roomNumber}`, 24, y); y += 24

  /* ── Divider ── */
  ctx.strokeStyle = '#e8e8ed'
  ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(W - 24, y); ctx.stroke()
  y += 18

  /* ── Payment detail rows ── */
  function row(label: string, value: string) {
    ctx.fillStyle = '#94a3b8'; ctx.font = `10px ${FONT}`; ctx.textAlign = 'left'
    ctx.fillText(label, 24, y)
    ctx.fillStyle = '#1e1b4b'; ctx.font = `12px ${FONT}`; ctx.textAlign = 'right'
    ctx.fillText(value, W - 24, y)
    y += 22
  }
  row('Payment Type', data.type === 'rent' ? 'Rent Payment' : 'Electricity Payment')
  row('Period', data.period)
  row('Date', data.paymentDate)
  row('Receipt No.', `#${data.receiptNumber}`)
  y += 10

  /* ── Amount box ── */
  ctx.fillStyle = data.type === 'rent' ? 'rgba(108,92,231,0.07)' : 'rgba(245,158,11,0.07)'
  rr(ctx, 24, y, W - 48, 78, 14); ctx.fill()
  ctx.fillStyle = '#94a3b8'; ctx.font = `9px ${FONT}`; ctx.textAlign = 'center'
  ctx.fillText('AMOUNT PAID', W / 2, y + 21)
  ctx.fillStyle = ACCENT; ctx.font = `bold 36px ${FONT}`; ctx.textAlign = 'center'
  ctx.fillText(fmt(data.amount), W / 2, y + 60)
  y += 94

  /* ── Paid badge ── */
  ctx.fillStyle = 'rgba(22,163,74,0.1)'
  rr(ctx, W / 2 - 46, y, 92, 28, 14); ctx.fill()
  ctx.fillStyle = '#16a34a'; ctx.font = `bold 11px ${FONT}`; ctx.textAlign = 'center'
  ctx.fillText('✓  PAID', W / 2, y + 18)
  y += 46

  /* ── Dashed separator ── */
  ctx.strokeStyle = '#d4d4d8'; ctx.lineWidth = 1
  ctx.setLineDash([5, 5])
  ctx.beginPath(); ctx.moveTo(24, y); ctx.lineTo(W - 24, y); ctx.stroke()
  ctx.setLineDash([])
  y += 18

  /* ── Footer ── */
  ctx.fillStyle = '#94a3b8'; ctx.font = `9px ${FONT}`; ctx.textAlign = 'center'
  ctx.fillText('This receipt was generated by ATIMAN Boarding House Management System', W / 2, y)
  y += 14
  ctx.fillText(`Generated ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}`, W / 2, y)
  y += 28

  /* ── Trim to actual content height ── */
  const out = document.createElement('canvas')
  out.width = W; out.height = y
  out.getContext('2d')!.drawImage(c, 0, 0)

  const link = document.createElement('a')
  link.href = out.toDataURL('image/jpeg', 0.93)
  link.download = `ATIMAN-Receipt-${data.receiptNumber}.jpg`
  link.click()
}
