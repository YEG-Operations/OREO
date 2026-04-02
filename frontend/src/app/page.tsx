'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        <div className="w-16 h-16 bg-yeg-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-white font-bold text-2xl">Y</span>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          YEG Event Planner
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Piattaforma di gestione brief eventi e matching fornitori intelligente.
          Compila il brief, ricevi proposte AI, seleziona e invia al cliente.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/brief" className="btn-primary text-lg px-8 py-3">
            Nuovo Brief
          </Link>
          <Link href="/dashboard" className="btn-secondary text-lg px-8 py-3">
            Dashboard
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mt-16">
        <div className="card text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">1. Brief</h3>
          <p className="text-sm text-gray-600">Il cliente compila il brief con tutte le esigenze dell&apos;evento</p>
        </div>
        <div className="card text-center">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">2. AI Matching</h3>
          <p className="text-sm text-gray-600">L&apos;AI analizza il brief e propone fornitori dal DB YEG e dal web</p>
        </div>
        <div className="card text-center">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">3. Proposta</h3>
          <p className="text-sm text-gray-600">Rivedi, modifica e invia la proposta finale al cliente</p>
        </div>
      </div>
    </div>
  )
}
