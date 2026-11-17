import { Construction } from 'lucide-react'

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Construction size={48} className="text-[#AEAEB2] mb-4" />
      <h2 className="text-[22px] font-semibold text-[#1D1D1F] mb-2">{title}</h2>
      <p className="text-[15px] text-[#6E6E73]">Coming soon — check back later.</p>
    </div>
  )
}
