export type EventStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface Event {
  id: string;
  title: string;
  description: string;
  category: string;
  date: string;
  time: string;
  venue: string;
  capacity: number;
  registered_count: number;
  image_url?: string | null;
  organizer: string;
  tags: string[];
  registration_fee: number;
  status: EventStatus;
  created_at: string;
}

export interface Registration {
  id: string;
  event_id: string;
  student_name: string;
  student_email: string;
  student_id: string;
  department: string;
  year: string;
  phone?: string;
  status: string;
  created_at: string;
}

export interface Stats {
  total_events: number;
  upcoming: number;
  ongoing: number;
  completed: number;
  total_registrations: number;
  categories: string[];
}

export type Page = 'dashboard' | 'events' | 'create' | 'registrations' | 'event-detail';
