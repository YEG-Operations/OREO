import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'YEG Event Planner',
  description: 'Piattaforma di gestione eventi e fornitori YEG',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <a href="/" className="flex items-center gap-3">
                <div className="w-8 h-8 bg-yeg-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">Y</span>
                </div>
                <span className="font-semibold text-lg text-gray-900">YEG Event Planner</span>
              </a>
              <div className="flex items-center gap-6">
                <a href="/brief" className="text-sm font-medium text-gray-600 hover:text-yeg-500 transition-colors">
                  Nuovo Brief
                </a>
                <a href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-yeg-500 transition-colors">
                  Dashboard
                </a>
              </div>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  )
}
