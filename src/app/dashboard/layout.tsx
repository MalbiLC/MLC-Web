import Sidebar from '@/components/layout/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-container">
      <Sidebar />
      <main className="page-main">
        {children}
      </main>
    </div>
  )
}
