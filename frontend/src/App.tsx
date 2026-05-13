import { useEffect, useState, useCallback } from 'react'
import type { Event, Registration, Stats, Page } from './types'
import {
  fetchStats,
  fetchEvents,
  fetchEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  fetchRegistrations,
  registerForEvent,
  cancelRegistration,
} from './api'

// ── Helpers ────────────────────────────────────────────────────────────────────

const CATEGORIES = ['Academic', 'Cultural', 'Sports', 'Technical', 'Workshop', 'Seminar', 'Social', 'Other']
const STATUSES = ['upcoming', 'ongoing', 'completed', 'cancelled'] as const
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Postgraduate', 'PhD']
const STATUS_COLORS: Record<string, string> = {
  upcoming: 'badge-upcoming',
  ongoing: 'badge-ongoing',
  completed: 'badge-completed',
  cancelled: 'badge-cancelled',
}
const CATEGORY_ICONS: Record<string, string> = {
  Academic: '📚', Cultural: '🎭', Sports: '⚽', Technical: '💻',
  Workshop: '🔧', Seminar: '🎤', Social: '🎉', Other: '📌',
}

function formatDate(d: string) {
  if (!d) return ''
  const dt = new Date(d)
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function spotsLeft(event: Event) {
  return event.capacity - (event.registered_count || 0)
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

function Sidebar({ page, onNav }: { page: Page; onNav: (p: Page) => void }) {
  const links: { id: Page; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
    { id: 'events', label: 'Events', icon: '📅' },
    { id: 'create', label: 'Create Event', icon: '➕' },
    { id: 'registrations', label: 'Registrations', icon: '📋' },
  ]
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-icon">🎓</span>
        <div>
          <p className="brand-title">EMS</p>
          <p className="brand-sub">College Event Manager</p>
        </div>
      </div>
      <nav className="sidebar-nav">
        {links.map(l => (
          <button
            key={l.id}
            className={`nav-item ${page === l.id || (page === 'event-detail' && l.id === 'events') ? 'nav-active' : ''}`}
            onClick={() => onNav(l.id)}
          >
            <span className="nav-icon">{l.icon}</span>
            <span>{l.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number | string; color: string }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-icon">{icon}</div>
      <div>
        <p className="stat-value">{value}</p>
        <p className="stat-label">{label}</p>
      </div>
    </div>
  )
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

function Dashboard({ stats, onNav, recentEvents }: { stats: Stats | null; onNav: (p: Page, id?: string) => void; recentEvents: Event[] }) {
  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome to the College Event Management System</p>
        </div>
        <button className="btn btn-primary" onClick={() => onNav('create')}>+ New Event</button>
      </div>

      {stats && (
        <div className="stats-grid">
          <StatCard icon="📅" label="Total Events" value={stats.total_events} color="stat-blue" />
          <StatCard icon="🚀" label="Upcoming" value={stats.upcoming} color="stat-green" />
          <StatCard icon="🔴" label="Ongoing" value={stats.ongoing} color="stat-orange" />
          <StatCard icon="✅" label="Completed" value={stats.completed} color="stat-purple" />
          <StatCard icon="👥" label="Registrations" value={stats.total_registrations} color="stat-teal" />
          <StatCard icon="🏷️" label="Categories" value={stats.categories.length} color="stat-pink" />
        </div>
      )}

      <div className="section-header">
        <h2 className="section-title">Recent Events</h2>
        <button className="btn btn-ghost" onClick={() => onNav('events')}>View all →</button>
      </div>
      <div className="events-grid">
        {recentEvents.slice(0, 6).map(e => (
          <EventCard key={e.id} event={e} onClick={() => onNav('event-detail', e.id)} />
        ))}
        {recentEvents.length === 0 && (
          <div className="empty-state">
            <p>🗓️</p>
            <p>No events yet. <button className="link-btn" onClick={() => onNav('create')}>Create one!</button></p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Event Card ─────────────────────────────────────────────────────────────────

function EventCard({ event, onClick }: { event: Event; onClick: () => void }) {
  const spots = spotsLeft(event)
  const pct = event.capacity > 0 ? Math.round((event.registered_count / event.capacity) * 100) : 0
  return (
    <div className="event-card" onClick={onClick}>
      <div className="event-card-header">
        <span className="event-category-icon">{CATEGORY_ICONS[event.category] || '📌'}</span>
        <span className={`badge ${STATUS_COLORS[event.status]}`}>{event.status}</span>
      </div>
      <h3 className="event-card-title">{event.title}</h3>
      <p className="event-card-desc">{event.description.slice(0, 90)}{event.description.length > 90 ? '…' : ''}</p>
      <div className="event-card-meta">
        <span>📅 {formatDate(event.date)}</span>
        <span>⏰ {event.time}</span>
        <span>📍 {event.venue}</span>
      </div>
      <div className="event-card-footer">
        <div className="capacity-bar-wrap">
          <div className="capacity-bar">
            <div className="capacity-fill" style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <span className="capacity-text">{spots > 0 ? `${spots} spots left` : 'Full'}</span>
        </div>
        {event.registration_fee > 0 && <span className="fee-badge">₹{event.registration_fee}</span>}
      </div>
    </div>
  )
}

// ── Events Page ────────────────────────────────────────────────────────────────

function EventsPage({ onNav, onDelete }: { onNav: (p: Page, id?: string) => void; onDelete: (id: string) => void }) {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState('date_asc')
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchEvents({ category: category || undefined, status: status || undefined, search: search || undefined, sort })
      setEvents(data)
    } finally {
      setLoading(false)
    }
  }, [category, status, search, sort])

  useEffect(() => { void load() }, [load])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event and all its registrations?')) return
    setDeleting(id)
    try {
      await deleteEvent(id)
      onDelete(id)
      setEvents(prev => prev.filter(e => e.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Events</h1>
          <p className="page-subtitle">{events.length} event{events.length !== 1 ? 's' : ''} found</p>
        </div>
        <button className="btn btn-primary" onClick={() => onNav('create')}>+ New Event</button>
      </div>

      <div className="filters-bar">
        <input
          className="filter-input"
          placeholder="🔍 Search events..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="filter-select" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="filter-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={sort} onChange={e => setSort(e.target.value)}>
          <option value="date_asc">Date ↑</option>
          <option value="date_desc">Date ↓</option>
          <option value="title_asc">Title A-Z</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <p>🔍</p>
          <p>No events match your filters.</p>
        </div>
      ) : (
        <div className="events-grid">
          {events.map(e => (
            <div key={e.id} className="event-card-wrap">
              <EventCard event={e} onClick={() => onNav('event-detail', e.id)} />
              <div className="event-card-actions">
                <button className="btn btn-sm btn-ghost" onClick={() => onNav('event-detail', e.id)}>View</button>
                <button
                  className="btn btn-sm btn-danger"
                  disabled={deleting === e.id}
                  onClick={() => handleDelete(e.id)}
                >{deleting === e.id ? '…' : 'Delete'}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Create / Edit Event Form ───────────────────────────────────────────────────

function EventForm({ initial, onSave, onCancel }: {
  initial?: Partial<Event>
  onSave: (data: any) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    category: initial?.category || 'Academic',
    date: initial?.date || '',
    time: initial?.time || '10:00',
    venue: initial?.venue || '',
    capacity: initial?.capacity?.toString() || '100',
    organizer: initial?.organizer || '',
    tags: initial?.tags?.join(', ') || '',
    registration_fee: initial?.registration_fee?.toString() || '0',
    status: initial?.status || 'upcoming',
    image_url: initial?.image_url || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onSave({
        ...form,
        capacity: parseInt(form.capacity) || 100,
        registration_fee: parseFloat(form.registration_fee) || 0,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      })
    } catch (err: any) {
      setError(err.message || 'Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <form className="event-form" onSubmit={handleSubmit}>
      {error && <div className="form-error">{error}</div>}
      <div className="form-grid">
        <div className="form-group form-full">
          <label>Event Title *</label>
          <input required value={form.title} onChange={set('title')} placeholder="e.g. Annual Tech Fest 2026" />
        </div>
        <div className="form-group form-full">
          <label>Description *</label>
          <textarea required rows={4} value={form.description} onChange={set('description')} placeholder="Describe the event..." />
        </div>
        <div className="form-group">
          <label>Category *</label>
          <select required value={form.category} onChange={set('category')}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Status</label>
          <select value={form.status} onChange={set('status')}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Date *</label>
          <input required type="date" value={form.date} onChange={set('date')} />
        </div>
        <div className="form-group">
          <label>Time *</label>
          <input required type="time" value={form.time} onChange={set('time')} />
        </div>
        <div className="form-group form-full">
          <label>Venue *</label>
          <input required value={form.venue} onChange={set('venue')} placeholder="e.g. Main Auditorium, Block A" />
        </div>
        <div className="form-group">
          <label>Organizer *</label>
          <input required value={form.organizer} onChange={set('organizer')} placeholder="e.g. CS Department" />
        </div>
        <div className="form-group">
          <label>Capacity *</label>
          <input required type="number" min="1" value={form.capacity} onChange={set('capacity')} />
        </div>
        <div className="form-group">
          <label>Registration Fee (₹)</label>
          <input type="number" min="0" step="0.01" value={form.registration_fee} onChange={set('registration_fee')} />
        </div>
        <div className="form-group">
          <label>Tags (comma separated)</label>
          <input value={form.tags} onChange={set('tags')} placeholder="e.g. hackathon, coding, prizes" />
        </div>
        <div className="form-group form-full">
          <label>Image URL (optional)</label>
          <input type="url" value={form.image_url} onChange={set('image_url')} placeholder="https://..." />
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : initial?.title ? 'Update Event' : 'Create Event'}
        </button>
      </div>
    </form>
  )
}

function CreatePage({ onCreated, onCancel }: { onCreated: (e: Event) => void; onCancel: () => void }) {
  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Create Event</h1>
          <p className="page-subtitle">Add a new event to the system</p>
        </div>
      </div>
      <div className="form-container">
        <EventForm
          onSave={async (data) => {
            const ev = await createEvent(data)
            onCreated(ev)
          }}
          onCancel={onCancel}
        />
      </div>
    </div>
  )
}

// ── Registration Modal ─────────────────────────────────────────────────────────

function RegistrationModal({ event, onClose, onDone }: { event: Event; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ student_name: '', student_email: '', student_id: '', department: '', year: '1st Year', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setSaving(true)
    setError('')
    try {
      await registerForEvent({ event_id: event.id, ...form })
      setSuccess(true)
      onDone()
    } catch (err: any) {
      setError(err.message || 'Registration failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Register for Event</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <p className="modal-subtitle">{event.title}</p>
        {success ? (
          <div className="success-state">
            <p>✅</p>
            <p className="success-msg">Registration confirmed!</p>
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="form-error">{error}</div>}
            <div className="form-grid">
              <div className="form-group form-full">
                <label>Full Name *</label>
                <input required value={form.student_name} onChange={set('student_name')} placeholder="Your full name" />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input required type="email" value={form.student_email} onChange={set('student_email')} placeholder="college@email.com" />
              </div>
              <div className="form-group">
                <label>Student ID *</label>
                <input required value={form.student_id} onChange={set('student_id')} placeholder="e.g. CS2023001" />
              </div>
              <div className="form-group">
                <label>Department *</label>
                <input required value={form.department} onChange={set('department')} placeholder="e.g. Computer Science" />
              </div>
              <div className="form-group">
                <label>Year *</label>
                <select required value={form.year} onChange={set('year')}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input type="tel" value={form.phone} onChange={set('phone')} placeholder="+91 XXXXX XXXXX" />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Registering…' : 'Confirm Registration'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Event Detail ───────────────────────────────────────────────────────────────

function EventDetail({ eventId, onBack, onEdited }: { eventId: string; onBack: () => void; onEdited: () => void }) {
  const [event, setEvent] = useState<Event | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [showReg, setShowReg] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ev, regs] = await Promise.all([fetchEvent(eventId), fetchRegistrations(eventId)])
      setEvent(ev)
      setRegistrations(regs)
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { void load() }, [load])

  const handleCancelReg = async (id: string) => {
    if (!confirm('Cancel this registration?')) return
    await cancelRegistration(id)
    setRegistrations(prev => prev.filter(r => r.id !== id))
    setEvent(prev => prev ? { ...prev, registered_count: Math.max(0, (prev.registered_count || 0) - 1) } : prev)
  }

  if (loading) return <div className="loading-state"><div className="spinner" /></div>
  if (!event) return <div className="page-content"><p>Event not found.</p></div>

  const pct = event.capacity > 0 ? Math.round(((event.registered_count || 0) / event.capacity) * 100) : 0

  if (editing) {
    return (
      <div className="page-content">
        <div className="page-header">
          <h1 className="page-title">Edit Event</h1>
        </div>
        <div className="form-container">
          <EventForm
            initial={event}
            onSave={async (data) => {
              const updated = await updateEvent(event.id, data)
              setEvent(updated)
              setEditing(false)
              onEdited()
            }}
            onCancel={() => setEditing(false)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <div className="detail-actions">
          <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>
          <button className="btn btn-primary" onClick={() => setShowReg(true)} disabled={spotsLeft(event) <= 0 || event.status === 'cancelled'}>
            Register
          </button>
        </div>
      </div>

      <div className="detail-hero">
        {event.image_url && <img className="detail-img" src={event.image_url} alt={event.title} />}
        <div className="detail-info">
          <div className="detail-badges">
            <span className={`badge ${STATUS_COLORS[event.status]}`}>{event.status}</span>
            <span className="badge badge-category">{CATEGORY_ICONS[event.category]} {event.category}</span>
          </div>
          <h1 className="detail-title">{event.title}</h1>
          <p className="detail-description">{event.description}</p>
          <div className="detail-meta-grid">
            <div className="detail-meta-item"><span className="meta-icon">📅</span><div><p className="meta-label">Date</p><p className="meta-value">{formatDate(event.date)}</p></div></div>
            <div className="detail-meta-item"><span className="meta-icon">⏰</span><div><p className="meta-label">Time</p><p className="meta-value">{event.time}</p></div></div>
            <div className="detail-meta-item"><span className="meta-icon">📍</span><div><p className="meta-label">Venue</p><p className="meta-value">{event.venue}</p></div></div>
            <div className="detail-meta-item"><span className="meta-icon">👤</span><div><p className="meta-label">Organizer</p><p className="meta-value">{event.organizer}</p></div></div>
            <div className="detail-meta-item"><span className="meta-icon">💰</span><div><p className="meta-label">Fee</p><p className="meta-value">{event.registration_fee > 0 ? `₹${event.registration_fee}` : 'Free'}</p></div></div>
            <div className="detail-meta-item">
              <span className="meta-icon">👥</span>
              <div>
                <p className="meta-label">Capacity ({pct}% filled)</p>
                <div className="capacity-bar large"><div className="capacity-fill" style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                <p className="meta-value">{event.registered_count}/{event.capacity}</p>
              </div>
            </div>
          </div>
          {event.tags.length > 0 && (
            <div className="tags-row">{event.tags.map(t => <span key={t} className="tag">{t}</span>)}</div>
          )}
        </div>
      </div>

      <div className="section-header">
        <h2 className="section-title">Registrations ({registrations.length})</h2>
      </div>
      {registrations.length === 0 ? (
        <div className="empty-state"><p>No registrations yet.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="reg-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Student ID</th><th>Department</th><th>Year</th><th>Registered</th><th>Action</th></tr>
            </thead>
            <tbody>
              {registrations.map(r => (
                <tr key={r.id}>
                  <td>{r.student_name}</td>
                  <td>{r.student_email}</td>
                  <td>{r.student_id}</td>
                  <td>{r.department}</td>
                  <td>{r.year}</td>
                  <td>{formatDateTime(r.created_at)}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => handleCancelReg(r.id)}>Cancel</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showReg && (
        <RegistrationModal
          event={event}
          onClose={() => setShowReg(false)}
          onDone={() => { void load(); setShowReg(false) }}
        />
      )}
    </div>
  )
}

// ── Registrations Page ─────────────────────────────────────────────────────────

function RegistrationsPage({ onNav }: { onNav: (p: Page, id?: string) => void }) {
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [regs, evs] = await Promise.all([fetchRegistrations(), fetchEvents()])
      setRegistrations(regs)
      setEvents(evs)
      setLoading(false)
    }
    void load()
  }, [])

  const eventMap = Object.fromEntries(events.map(e => [e.id, e]))

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this registration?')) return
    await cancelRegistration(id)
    setRegistrations(prev => prev.filter(r => r.id !== id))
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">All Registrations</h1>
          <p className="page-subtitle">{registrations.length} total registration{registrations.length !== 1 ? 's' : ''}</p>
        </div>
      </div>
      {loading ? (
        <div className="loading-state"><div className="spinner" /></div>
      ) : registrations.length === 0 ? (
        <div className="empty-state"><p>📋</p><p>No registrations yet.</p></div>
      ) : (
        <div className="table-wrap">
          <table className="reg-table">
            <thead>
              <tr><th>Student</th><th>Email</th><th>Event</th><th>Department</th><th>Year</th><th>Date</th><th>Action</th></tr>
            </thead>
            <tbody>
              {registrations.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.student_name}</strong><br /><small>{r.student_id}</small></td>
                  <td>{r.student_email}</td>
                  <td>
                    <button className="link-btn" onClick={() => onNav('event-detail', r.event_id)}>
                      {eventMap[r.event_id]?.title || r.event_id}
                    </button>
                  </td>
                  <td>{r.department}</td>
                  <td>{r.year}</td>
                  <td>{formatDateTime(r.created_at)}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => handleCancel(r.id)}>Cancel</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── App Root ───────────────────────────────────────────────────────────────────

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentEvents, setRecentEvents] = useState<Event[]>([])

  const loadDashboard = useCallback(async () => {
    try {
      const [s, evs] = await Promise.all([fetchStats(), fetchEvents({ sort: 'date_asc' })])
      setStats(s)
      setRecentEvents(evs)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => { void loadDashboard() }, [loadDashboard])

  const navigate = (p: Page, id?: string) => {
    if (id) setSelectedEventId(id)
    setPage(p)
  }

  return (
    <div className="app-layout">
      <Sidebar page={page} onNav={navigate} />
      <main className="main-area">
        {page === 'dashboard' && (
          <Dashboard stats={stats} onNav={navigate} recentEvents={recentEvents} />
        )}
        {page === 'events' && (
          <EventsPage onNav={navigate} onDelete={() => loadDashboard()} />
        )}
        {page === 'create' && (
          <CreatePage
            onCreated={(ev) => { void loadDashboard(); navigate('event-detail', ev.id) }}
            onCancel={() => navigate('events')}
          />
        )}
        {page === 'event-detail' && selectedEventId && (
          <EventDetail
            eventId={selectedEventId}
            onBack={() => navigate('events')}
            onEdited={() => void loadDashboard()}
          />
        )}
        {page === 'registrations' && (
          <RegistrationsPage onNav={navigate} />
        )}
      </main>
    </div>
  )
}

export default App
