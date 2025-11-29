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
const DEFAULT_PROD_API = 'https://attendance-tracker-0zdg.onrender.com';
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
  const res = await fetch(`${API_BASE}/api/attendance?${search.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch attendance');
  return res.json();
}

export async function fetchStats() {
  const res = await fetch(`${API_BASE}/api/stats`);
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
  const res = await fetch(`${API_BASE}/api/filtered_stats?${search.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch filtered stats');
  return res.json();
}

export async function fetchCourses() {
  const res = await fetch(`${API_BASE}/api/courses`);
  if (!res.ok) throw new Error('Failed to fetch courses');
  return res.json() as Promise<Array<{ code: string; name: string }>>;
}

export async function uploadFiles(files: File[]) {
  const form = new FormData();
  files.forEach(f => form.append('files', f));
  const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form });
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
  const res = await fetch(`${API_BASE}/delete_record/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
  return res.json();
}

export async function clearAllData() {
  const res = await fetch(`${API_BASE}/clear_all_data`, { method: 'POST' });
  if (!res.ok) throw new Error('Clear failed');
  return res.json();
}

export function exportExcel(params: AttendanceQuery = {}) {
  const search = new URLSearchParams();
  if (params.course) search.set('course', params.course);
  if (typeof params.threshold === 'number') search.set('threshold', String(params.threshold));
  if (params.search) search.set('search', params.search);
  if (params.exclude_courses && params.exclude_courses.length > 0) {
    search.set('exclude_courses', params.exclude_courses.join(','));
  }
  window.location.href = `${API_BASE}/export/excel?${search.toString()}`;
}

export function exportPdf(params: AttendanceQuery = {}) {
  const search = new URLSearchParams();
  if (params.course) search.set('course', params.course);
  if (typeof params.threshold === 'number') search.set('threshold', String(params.threshold));
  if (params.search) search.set('search', params.search);
  if (params.exclude_courses && params.exclude_courses.length > 0) {
    search.set('exclude_courses', params.exclude_courses.join(','));
  }
  window.location.href = `${API_BASE}/export/pdf?${search.toString()}`;
}