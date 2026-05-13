import { Event, Registration, Stats, EventStatus } from './types';

const BASE = '/api';

export async function fetchStats(): Promise<Stats> {
  const res = await fetch(`${BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchEvents(params?: {
  category?: string;
  status?: string;
  search?: string;
  sort?: string;
}): Promise<Event[]> {
  const q = new URLSearchParams();
  if (params?.category) q.set('category', params.category);
  if (params?.status) q.set('status', params.status);
  if (params?.search) q.set('search', params.search);
  if (params?.sort) q.set('sort', params.sort);
  const res = await fetch(`${BASE}/events?${q}`);
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

export async function fetchEvent(id: string): Promise<Event> {
  const res = await fetch(`${BASE}/events/${id}`);
  if (!res.ok) throw new Error('Event not found');
  return res.json();
}

export async function createEvent(data: Omit<Event, 'id' | 'created_at' | 'registered_count'>): Promise<Event> {
  const res = await fetch(`${BASE}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).detail || 'Failed to create event');
  }
  return res.json();
}

export async function updateEvent(id: string, data: Partial<Event>): Promise<Event> {
  const res = await fetch(`${BASE}/events/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update event');
  return res.json();
}

export async function deleteEvent(id: string): Promise<void> {
  const res = await fetch(`${BASE}/events/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete event');
}

export async function fetchRegistrations(eventId?: string): Promise<Registration[]> {
  const q = eventId ? `?event_id=${eventId}` : '';
  const res = await fetch(`${BASE}/registrations${q}`);
  if (!res.ok) throw new Error('Failed to fetch registrations');
  return res.json();
}

export async function registerForEvent(data: {
  event_id: string;
  student_name: string;
  student_email: string;
  student_id: string;
  department: string;
  year: string;
  phone?: string;
}): Promise<Registration> {
  const res = await fetch(`${BASE}/registrations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).detail || 'Registration failed');
  }
  return res.json();
}

export async function cancelRegistration(id: string): Promise<void> {
  const res = await fetch(`${BASE}/registrations/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to cancel registration');
}
