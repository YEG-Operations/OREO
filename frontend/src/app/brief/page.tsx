'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { BriefFormData } from '@/lib/types'

const TIPOLOGIE_EVENTO = [
  'Convention', 'Riunione', 'Incentive', 'Lancio Prodotto', 'Gala Dinner',
  'Team Building', 'Conferenza', 'Workshop', 'Evento Ibrido', 'Altro'
]
const SETUP_SALA = ['Teatro', 'Banquet', 'Classroom', 'Cabaret', 'Standing', 'Boardroom', 'U-Shape']
const AV_OPTIONS = ['Proiettore', 'LED Wall', 'Audio', 'Microfoni', 'Regia video', 'Streaming', 'Traduzione simultanea']
const TIPOLOGIE_LOCATION = ['Qualsiasi', 'Hotel con sale', 'Museo', 'Teatro', 'Loft/Industriale', 'Palazzo storico', 'Rooftop', 'Spazio congressi', 'Ristorante con sala privata', 'Esterno/Giardino']
const TRASPORTI_TIPO = ['Transfer aeroporto', 'Bus navetta', 'Auto blu/NCC', 'Noleggio bus giornaliero', 'Transfer stazione']
const ENTERTAINMENT_TIPO = ['DJ', 'Band/Musica live', 'Speaker/Motivatore', 'Sportivo/Testimonial', 'Show/Spettacolo', 'Animazione', 'Team building ludico']

const initialForm: BriefFormData = {
  nome_referente: '', cognome_referente: '', email: '', telefono: '', azienda: '',
  nome_evento: '', tipologia_evento: '', data_inizio: '', orario_inizio: '09:00',
  data_fine: '', orario_fine: '18:00', citta: '', sede_indicata: '',
  numero_partecipanti: 50, budget_totale: 0, budget_flessibile: false, agenda: '',
  hotel_attivo: false, hotel_checkin: '', hotel_checkout: '', camere_singole: 0,
  camere_doppie: 0, hotel_stelle_minime: 4, hotel_note: '',
  location_attiva: false, location_setup: 'Teatro', location_av: [],
  location_tipologia: 'Qualsiasi', location_note: '',
  catering_attivo: false, coffee_break_num: 0, pranzo_num: 0, cena_num: 0,
  aperitivo_num: 0, esigenze_alimentari: '', catering_note: '',
  trasporti_attivi: false, trasporti_tipo: [], trasporti_note: '',
  entertainment_attivo: false, entertainment_tipo: '', entertainment_note: '',
  teambuilding_attivo: false, teambuilding_note: '',
  segreteria: false, app_evento: false, note_generali: '',
}

export default function BriefPage() {
  const router = useRouter()
  const [form, setForm] = useState<BriefFormData>(initialForm)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = <K extends keyof BriefFormData>(key: K, value: BriefFormData[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const toggleArray = (key: 'location_av' | 'trasporti_tipo', value: string) => {
    setForm(prev => {
      const arr = prev[key] as string[]
      return { ...prev, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] }
    })
  }

  const submit = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.progetto_id) {
        router.push(`/dashboard/${data.progetto_id}`)
      } else {
        setError(data.error || 'Errore nella creazione del progetto')
      }
    } catch {
      setError('Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  const steps = ['Referente', 'Evento', 'Componenti', 'Dettagli', 'Riepilogo']

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Nuovo Brief Evento</h1>
      <p className="text-gray-600 mb-8">Compila tutti i dettagli per ricevere proposte personalizzate dai nostri fornitori.</p>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <button key={s} onClick={() => setStep(i)} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              i <= step ? 'bg-yeg-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>{i + 1}</div>
            <span className={`text-sm hidden sm:block ${i <= step ? 'text-yeg-500 font-medium' : 'text-gray-400'}`}>{s}</span>
            {i < steps.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-yeg-500' : 'bg-gray-200'}`} />}
          </button>
        ))}
      </div>

      <div className="card">
        {/* Step 0: Referente */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-4">Dati Referente</h2>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Nome *</label><input className="input" value={form.nome_referente} onChange={e => set('nome_referente', e.target.value)} /></div>
              <div><label className="label">Cognome *</label><input className="input" value={form.cognome_referente} onChange={e => set('cognome_referente', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Email *</label><input type="email" className="input" value={form.email} onChange={e => set('email', e.target.value)} /></div>
              <div><label className="label">Telefono</label><input className="input" value={form.telefono} onChange={e => set('telefono', e.target.value)} /></div>
            </div>
            <div><label className="label">Azienda *</label><input className="input" value={form.azienda} onChange={e => set('azienda', e.target.value)} /></div>
          </div>
        )}

        {/* Step 1: Evento */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-4">Dettagli Evento</h2>
            <div><label className="label">Nome Evento *</label><input className="input" value={form.nome_evento} onChange={e => set('nome_evento', e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Tipologia *</label>
                <select className="input" value={form.tipologia_evento} onChange={e => set('tipologia_evento', e.target.value)}>
                  <option value="">Seleziona...</option>
                  {TIPOLOGIE_EVENTO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Citta *</label>
                <input className="input" value={form.citta} onChange={e => set('citta', e.target.value)} placeholder="es. Milano" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Data Inizio *</label><input type="date" className="input" value={form.data_inizio} onChange={e => set('data_inizio', e.target.value)} /></div>
              <div><label className="label">Orario Inizio</label><input type="time" className="input" value={form.orario_inizio} onChange={e => set('orario_inizio', e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Data Fine *</label><input type="date" className="input" value={form.data_fine} onChange={e => set('data_fine', e.target.value)} /></div>
              <div><label className="label">Orario Fine</label><input type="time" className="input" value={form.orario_fine} onChange={e => set('orario_fine', e.target.value)} /></div>
            </div>
            <div><label className="label">Sede indicata dal cliente (opzionale)</label><input className="input" value={form.sede_indicata} onChange={e => set('sede_indicata', e.target.value)} placeholder="Se il cliente ha gia' una sede in mente" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Numero Partecipanti *</label><input type="number" className="input" value={form.numero_partecipanti} onChange={e => set('numero_partecipanti', parseInt(e.target.value) || 0)} /></div>
              <div>
                <label className="label">Budget Totale (EUR)</label>
                <input type="number" className="input" value={form.budget_totale || ''} onChange={e => set('budget_totale', parseFloat(e.target.value) || 0)} placeholder="0 = da definire" />
                <label className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                  <input type="checkbox" checked={form.budget_flessibile} onChange={e => set('budget_flessibile', e.target.checked)} className="rounded" />
                  Budget flessibile
                </label>
              </div>
            </div>
            <div>
              <label className="label">Agenda / Programma</label>
              <textarea className="input min-h-[120px]" value={form.agenda} onChange={e => set('agenda', e.target.value)}
                placeholder="Es:&#10;Giorno 1: Arrivo, Welcome coffee, Plenaria, Pranzo, Workshop, Cena&#10;Giorno 2: Colazione, Team building, Pranzo, Plenaria, Chiusura" />
            </div>
          </div>
        )}

        {/* Step 2: Componenti */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-4">Componenti Richieste</h2>
            <p className="text-sm text-gray-500 mb-4">Seleziona i servizi necessari per l&apos;evento. Potrai aggiungere dettagli nello step successivo.</p>

            {[
              { key: 'hotel_attivo' as const, label: 'Hotel / Alloggio', desc: 'Pernottamento per i partecipanti' },
              { key: 'location_attiva' as const, label: 'Location / Venue', desc: 'Sala meeting, convention, evento' },
              { key: 'catering_attivo' as const, label: 'Catering / F&B', desc: 'Coffee break, pranzi, cene, aperitivi' },
              { key: 'trasporti_attivi' as const, label: 'Trasporti', desc: 'Transfer, bus, navette, NCC' },
              { key: 'entertainment_attivo' as const, label: 'Entertainment / Guest', desc: 'DJ, speaker, show, testimonial' },
              { key: 'teambuilding_attivo' as const, label: 'Team Building', desc: 'Attivita di gruppo, esperienze' },
            ].map(item => (
              <label key={item.key} className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                form[item.key] ? 'border-yeg-500 bg-yeg-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                <input
                  type="checkbox"
                  checked={form[item.key] as boolean}
                  onChange={e => set(item.key, e.target.checked)}
                  className="w-5 h-5 rounded text-yeg-500 focus:ring-yeg-500"
                />
                <div>
                  <div className="font-medium text-gray-900">{item.label}</div>
                  <div className="text-sm text-gray-500">{item.desc}</div>
                </div>
              </label>
            ))}

            <div className="border-t pt-4 mt-4">
              <h3 className="font-medium text-gray-900 mb-3">Servizi aggiuntivi</h3>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.segreteria} onChange={e => set('segreteria', e.target.checked)} className="rounded" />
                  Segreteria organizzativa
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.app_evento} onChange={e => set('app_evento', e.target.checked)} className="rounded" />
                  App evento
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Dettagli componenti attive */}
        {step === 3 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold mb-4">Dettagli Componenti</h2>

            {form.hotel_attivo && (
              <div className="p-4 bg-blue-50 rounded-lg space-y-3">
                <h3 className="font-semibold text-blue-900">Hotel</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Check-in</label><input type="date" className="input" value={form.hotel_checkin} onChange={e => set('hotel_checkin', e.target.value)} /></div>
                  <div><label className="label">Check-out</label><input type="date" className="input" value={form.hotel_checkout} onChange={e => set('hotel_checkout', e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="label">Singole</label><input type="number" className="input" value={form.camere_singole} onChange={e => set('camere_singole', parseInt(e.target.value) || 0)} /></div>
                  <div><label className="label">Doppie</label><input type="number" className="input" value={form.camere_doppie} onChange={e => set('camere_doppie', parseInt(e.target.value) || 0)} /></div>
                  <div>
                    <label className="label">Stelle minime</label>
                    <select className="input" value={form.hotel_stelle_minime} onChange={e => set('hotel_stelle_minime', parseInt(e.target.value))}>
                      {[3,4,5].map(s => <option key={s} value={s}>{s} stelle</option>)}
                    </select>
                  </div>
                </div>
                <div><label className="label">Note hotel</label><input className="input" value={form.hotel_note} onChange={e => set('hotel_note', e.target.value)} placeholder="Preferenze, esigenze particolari..." /></div>
              </div>
            )}

            {form.location_attiva && (
              <div className="p-4 bg-purple-50 rounded-lg space-y-3">
                <h3 className="font-semibold text-purple-900">Location</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Setup sala</label>
                    <select className="input" value={form.location_setup} onChange={e => set('location_setup', e.target.value)}>
                      {SETUP_SALA.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Tipologia preferita</label>
                    <select className="input" value={form.location_tipologia} onChange={e => set('location_tipologia', e.target.value)}>
                      {TIPOLOGIE_LOCATION.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Dotazioni AV richieste</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {AV_OPTIONS.map(av => (
                      <button key={av} type="button" onClick={() => toggleArray('location_av', av)}
                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                          form.location_av.includes(av) ? 'bg-purple-500 text-white border-purple-500' : 'border-gray-300 hover:border-purple-300'
                        }`}>{av}</button>
                    ))}
                  </div>
                </div>
                <div><label className="label">Note location</label><input className="input" value={form.location_note} onChange={e => set('location_note', e.target.value)} /></div>
              </div>
            )}

            {form.catering_attivo && (
              <div className="p-4 bg-orange-50 rounded-lg space-y-3">
                <h3 className="font-semibold text-orange-900">Catering / F&B</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div><label className="label">Coffee Break</label><input type="number" className="input" min="0" value={form.coffee_break_num} onChange={e => set('coffee_break_num', parseInt(e.target.value) || 0)} placeholder="N. servizi" /></div>
                  <div><label className="label">Pranzi</label><input type="number" className="input" min="0" value={form.pranzo_num} onChange={e => set('pranzo_num', parseInt(e.target.value) || 0)} /></div>
                  <div><label className="label">Cene</label><input type="number" className="input" min="0" value={form.cena_num} onChange={e => set('cena_num', parseInt(e.target.value) || 0)} /></div>
                  <div><label className="label">Aperitivi</label><input type="number" className="input" min="0" value={form.aperitivo_num} onChange={e => set('aperitivo_num', parseInt(e.target.value) || 0)} /></div>
                </div>
                <div><label className="label">Esigenze alimentari</label><input className="input" value={form.esigenze_alimentari} onChange={e => set('esigenze_alimentari', e.target.value)} placeholder="Vegetariano, vegano, halal, allergie..." /></div>
                <div><label className="label">Note catering</label><input className="input" value={form.catering_note} onChange={e => set('catering_note', e.target.value)} /></div>
              </div>
            )}

            {form.trasporti_attivi && (
              <div className="p-4 bg-green-50 rounded-lg space-y-3">
                <h3 className="font-semibold text-green-900">Trasporti</h3>
                <div>
                  <label className="label">Tipo trasporti</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {TRASPORTI_TIPO.map(t => (
                      <button key={t} type="button" onClick={() => toggleArray('trasporti_tipo', t)}
                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                          form.trasporti_tipo.includes(t) ? 'bg-green-500 text-white border-green-500' : 'border-gray-300 hover:border-green-300'
                        }`}>{t}</button>
                    ))}
                  </div>
                </div>
                <div><label className="label">Note trasporti</label><input className="input" value={form.trasporti_note} onChange={e => set('trasporti_note', e.target.value)} placeholder="Tratte, orari, esigenze..." /></div>
              </div>
            )}

            {form.entertainment_attivo && (
              <div className="p-4 bg-pink-50 rounded-lg space-y-3">
                <h3 className="font-semibold text-pink-900">Entertainment</h3>
                <div>
                  <label className="label">Tipo</label>
                  <select className="input" value={form.entertainment_tipo} onChange={e => set('entertainment_tipo', e.target.value)}>
                    <option value="">Seleziona...</option>
                    {ENTERTAINMENT_TIPO.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="label">Note entertainment</label><textarea className="input" value={form.entertainment_note} onChange={e => set('entertainment_note', e.target.value)} placeholder="Descrivi l'intrattenimento desiderato..." /></div>
              </div>
            )}

            {form.teambuilding_attivo && (
              <div className="p-4 bg-teal-50 rounded-lg space-y-3">
                <h3 className="font-semibold text-teal-900">Team Building</h3>
                <div><label className="label">Descrizione attivita desiderata</label><textarea className="input" value={form.teambuilding_note} onChange={e => set('teambuilding_note', e.target.value)} placeholder="Tipo di attivita, obiettivi, indoor/outdoor..." /></div>
              </div>
            )}

            {!form.hotel_attivo && !form.location_attiva && !form.catering_attivo &&
             !form.trasporti_attivi && !form.entertainment_attivo && !form.teambuilding_attivo && (
              <p className="text-gray-500 text-center py-8">Nessuna componente selezionata. Torna allo step precedente per attivare i servizi necessari.</p>
            )}

            <div>
              <label className="label">Note generali</label>
              <textarea className="input min-h-[80px]" value={form.note_generali} onChange={e => set('note_generali', e.target.value)} placeholder="Qualsiasi altra informazione utile..." />
            </div>
          </div>
        )}

        {/* Step 4: Riepilogo */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-4">Riepilogo Brief</h2>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p><span className="text-gray-500">Referente:</span> <strong>{form.nome_referente} {form.cognome_referente}</strong></p>
                <p><span className="text-gray-500">Azienda:</span> <strong>{form.azienda}</strong></p>
                <p><span className="text-gray-500">Email:</span> {form.email}</p>
              </div>
              <div className="space-y-2">
                <p><span className="text-gray-500">Evento:</span> <strong>{form.nome_evento}</strong></p>
                <p><span className="text-gray-500">Tipo:</span> {form.tipologia_evento}</p>
                <p><span className="text-gray-500">Citta:</span> <strong>{form.citta}</strong></p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
              <p><span className="text-gray-500">Date:</span> {form.data_inizio} - {form.data_fine}</p>
              <p><span className="text-gray-500">Partecipanti:</span> <strong>{form.numero_partecipanti}</strong></p>
              <p><span className="text-gray-500">Budget:</span> <strong>{form.budget_totale ? `${form.budget_totale.toLocaleString('it-IT')} EUR` : 'Da definire'}</strong>{form.budget_flessibile ? ' (flessibile)' : ''}</p>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-gray-500 mb-2">Componenti richieste:</p>
              <div className="flex flex-wrap gap-2">
                {form.hotel_attivo && <span className="badge bg-blue-100 text-blue-800">Hotel ({form.camere_singole + form.camere_doppie} camere)</span>}
                {form.location_attiva && <span className="badge bg-purple-100 text-purple-800">Location ({form.location_setup})</span>}
                {form.catering_attivo && <span className="badge bg-orange-100 text-orange-800">Catering ({form.coffee_break_num + form.pranzo_num + form.cena_num + form.aperitivo_num} servizi)</span>}
                {form.trasporti_attivi && <span className="badge bg-green-100 text-green-800">Trasporti</span>}
                {form.entertainment_attivo && <span className="badge bg-pink-100 text-pink-800">Entertainment</span>}
                {form.teambuilding_attivo && <span className="badge bg-teal-100 text-teal-800">Team Building</span>}
                {form.segreteria && <span className="badge bg-gray-100 text-gray-800">Segreteria</span>}
                {form.app_evento && <span className="badge bg-gray-100 text-gray-800">App evento</span>}
              </div>
            </div>

            {form.agenda && (
              <div className="border-t pt-4">
                <p className="text-sm text-gray-500 mb-1">Agenda:</p>
                <pre className="text-sm bg-gray-50 p-3 rounded-lg whitespace-pre-wrap">{form.agenda}</pre>
              </div>
            )}

            {error && <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className="btn-ghost disabled:opacity-30">
            Indietro
          </button>
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} className="btn-primary">
              Avanti
            </button>
          ) : (
            <button onClick={submit} disabled={loading} className="btn-primary">
              {loading ? 'Invio in corso...' : 'Invia Brief e Genera Proposte'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
