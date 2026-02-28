import { canReachSupabaseAuth, supabase } from './supabase';

export interface AttendanceQuery {
  course?: string;
  threshold?: number; // default 75
  search?: string;
  exclude_courses?: string[]; // array of course codes to exclude
  page?: number; // for pagination
  per_page?: number; // entries per page
}

// Compute API base: prefer env var; otherwise use production fallback when not on localhost
const frontendHost = typeof window !== 'undefined' ? window.location.hostname : '';
const isFrontendLocal = /^(localhost|127\.0\.0\.1)$/.test(frontendHost);
const DEFAULT_LOCAL_API = 'http://127.0.0.1:5000';
const DEFAULT_PROD_API = 'https://attendance-app-3a47.onrender.com';
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? (isFrontendLocal ? DEFAULT_LOCAL_API : DEFAULT_PROD_API);

// Warn in production if API base URL falls back to localhost
if (typeof window !== 'undefined') {
  const isApiLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\\d+)?/i.test(API_BASE);
  if (!isFrontendLocal && isApiLocal) {
    console.warn('[Attendance App] VITE_API_BASE_URL is not set; using localhost. Set it to your backend URL.');
  }
  if (!isFrontendLocal && API_BASE === DEFAULT_PROD_API && !import.meta.env.VITE_API_BASE_URL) {
    console.info('[Attendance App] Using default production API fallback:', DEFAULT_PROD_API);
  }
}

async function getSessionOrThrow() {
  try {
    const reachable = await canReachSupabaseAuth();
    if (!reachable) {
      throw new Error('Supabase auth endpoint unreachable');
    }

    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    return session;
  } catch (error) {
    console.error('[API] Supabase session retrieval failed:', error);
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // no-op: best effort cleanup
    }
    throw new Error('Authentication service is currently unreachable. Check your internet/VPN/firewall and try again.');
  }
}

// Helper to get auth headers
async function getAuthHeaders(): Promise<HeadersInit> {
  const session = await getSessionOrThrow();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  
  return headers;
}


export async function fetchAttendance(params: AttendanceQuery = {}) {
  const search = new URLSearchParams();
  if (params.course) search.set('course', params.course);
  if (typeof params.threshold === 'number') search.set('threshold', String(params.threshold));
  if (params.search) search.set('search', params.search);
  if (params.exclude_courses && params.exclude_courses.length > 0) {
    search.set('exclude_courses', params.exclude_courses.join(','));
  }
  if (typeof params.page === 'number') search.set('page', String(params.page));
  if (typeof params.per_page === 'number') search.set('per_page', String(params.per_page));
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/attendance?${search.toString()}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch attendance');
  return res.json();
}

export async function fetchStats() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/stats`, { headers });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchFilteredStats(params: AttendanceQuery = {}) {
  const search = new URLSearchParams();
  if (params.course) search.set('course', params.course);
  if (typeof params.threshold === 'number') search.set('threshold', String(params.threshold));
  if (params.search) search.set('search', params.search);
  if (params.exclude_courses && params.exclude_courses.length > 0) {
    search.set('exclude_courses', params.exclude_courses.join(','));
  }
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/filtered_stats?${search.toString()}`, { headers });
  if (!res.ok) throw new Error('Failed to fetch filtered stats');
  return res.json();
}

export async function fetchCourses() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/api/courses`, { headers });
  if (!res.ok) throw new Error('Failed to fetch courses');
  return res.json() as Promise<Array<{ code: string; name: string }>>;
}

export async function uploadFiles(files: File[]) {
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  const session = await getSessionOrThrow();
  const headers: HeadersInit = {};
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form, headers });
  if (!res.ok) throw new Error('Upload failed');
  // Prefer JSON payload for logs; fallback to text if not JSON
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  const text = await res.text();
  return { success: true, message: text } as any;
}

export async function deleteRecord(id: number) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/delete_record/${id}`, { method: 'DELETE', headers });
  if (!res.ok) throw new Error('Delete failed');
  return res.json();
}

export async function clearAllData() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}/clear_all_data`, { method: 'POST', headers });
  if (!res.ok) throw new Error('Clear failed');
  return res.json();
}

export async function exportExcel(params: AttendanceQuery = {}) {
  try {
    const session = await getSessionOrThrow();
    if (!session?.access_token) throw new Error('Not authenticated');
    
    const body: any = {};
    if (params.course) body.course = params.course;
    if (typeof params.threshold === 'number') body.threshold = params.threshold;
    if (params.search) body.search = params.search;
    if (params.exclude_courses && params.exclude_courses.length > 0) {
      body.exclude_courses = params.exclude_courses.join(',');
    }
    
    const res = await fetch(`${API_BASE}/export/excel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(body)
    });
    
    if (!res.ok) throw new Error('Export failed');
    
    // Get filename from Content-Disposition header
    const contentDisposition = res.headers.get('Content-Disposition');
    let filename = 'attendance.xlsx';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+?)"?$/);
      if (match) filename = match[1];
    }
    
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (err) {
    console.error('Excel export error:', err);
    throw err;
  }
}

export async function exportPdf(params: AttendanceQuery = {}) {
  try {
    const session = await getSessionOrThrow();
    if (!session?.access_token) throw new Error('Not authenticated');
    
    const body: any = {};
    if (params.course) body.course = params.course;
    if (typeof params.threshold === 'number') body.threshold = params.threshold;
    if (params.search) body.search = params.search;
    if (params.exclude_courses && params.exclude_courses.length > 0) {
      body.exclude_courses = params.exclude_courses.join(',');
    }
    
    const res = await fetch(`${API_BASE}/export/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(body)
    });
    
    if (!res.ok) throw new Error('Export failed');
    
    // Get filename from Content-Disposition header
    const contentDisposition = res.headers.get('Content-Disposition');
    let filename = 'attendance.pdf';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+?)"?$/);
      if (match) filename = match[1];
    }
    
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (err) {
    console.error('PDF export error:', err);
    throw err;
  }
}