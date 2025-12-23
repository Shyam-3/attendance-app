import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Navbar from '../components/Navbar';
import { clearAllData, deleteRecord, exportExcel, exportPdf, fetchAttendance, fetchCourses, fetchFilteredStats, fetchStats } from '../lib/api';

interface AttendanceRow {
  id?: number;
  ['S.No']: number;
  ['Registration No']: string;
  ['Student Name']: string;
  ['Course Code']: string;
  ['Course Name']: string;
  ['Attended Periods']: number;
  ['Conducted Periods']: number;
  ['Attendance %']: number;
}

interface FilteredStats {
  total_students: number;
  total_courses: number;
  low_attendance_count: number;
  critical_attendance_count: number;
  is_single_student: boolean;
  student_details?: {
    name: string;
    registration_no: string;
  };
  total_courses_in_system: number;
  course_details?: {
    code: string;
    name: string;
  };
  student_course_info?: string;
}

export default function Dashboard() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [stats, setStats] = useState<{ total_students: number; total_courses: number; low_attendance_count: number; critical_attendance_count: number } | null>(null);
  const [filteredStats, setFilteredStats] = useState<FilteredStats | null>(null);
  const [courses, setCourses] = useState<Array<{ code: string; name: string }>>([]);
  const [course, setCourse] = useState<string>('');
  const [threshold, setThreshold] = useState<number>(75);
  const [search, setSearch] = useState<string>('');
  const [excludeCourses, setExcludeCourses] = useState<string[]>([]);
  const [courseDropdownOpen, setCourseDropdownOpen] = useState(false);
  const [excludeDropdownOpen, setExcludeDropdownOpen] = useState(false);
  const [thresholdDropdownOpen, setThresholdDropdownOpen] = useState(false);
  const [courseDropdownFixed, setCourseDropdownFixed] = useState(false);
  const [excludeDropdownFixed, setExcludeDropdownFixed] = useState(false);
  const [thresholdDropdownFixed, setThresholdDropdownFixed] = useState(false);
  const [courseJustSelected, setCourseJustSelected] = useState(false);
  const [thresholdJustSelected, setThresholdJustSelected] = useState(false);
  const [perPageDropdownOpen, setPerPageDropdownOpen] = useState(false);
  const [perPageDropdownFixed, setPerPageDropdownFixed] = useState(false);
  const [perPageJustSelected, setPerPageJustSelected] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(50);
  const [totalRecords, setTotalRecords] = useState(0);
  const courseDropdownRef = useRef(null);
  const excludeDropdownRef = useRef(null);
  const thresholdDropdownRef = useRef(null);
  const perPageDropdownRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const suppressPageLoadRef = useRef(false);
  const debounceTimerRef = useRef<number | null>(null);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title?: string;
    message?: ReactNode;
    confirmText?: string;
    destructive?: boolean;
    onConfirm?: (typed?: string) => void | Promise<void>;
  }>({ open: false });
  const [infoDialog, setInfoDialog] = useState<{ open: boolean; title?: string; message?: ReactNode }>({ open: false });

  // Filter changes: reset to page 1 and debounce loads
  useEffect(() => {
    suppressPageLoadRef.current = true; // prevent immediate page-change load
    setCurrentPage(1);

    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      load();
      loadFilteredStats();
    }, 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course, threshold, search, excludeCourses]);

  // When perPage changes, clamp currentPage to valid range and reload if page unchanged
  useEffect(() => {
    const newTotalPages = Math.max(1, Math.ceil(totalRecords / Math.max(1, perPage)));
    setCurrentPage(prev => {
      const next = Math.min(prev, newTotalPages);
      if (next === prev) {
        // page unchanged but perPage changed → reload data explicitly
        load();
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perPage, totalRecords]);

  // Load data when page changes
  useEffect(() => {
    if (suppressPageLoadRef.current) {
      // consume the suppression once
      suppressPageLoadRef.current = false;
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  useEffect(() => {
    // initial load
    Promise.all([load(), loadStats(), loadFilteredStats(), loadCourses()]).catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        courseDropdownFixed && courseDropdownRef.current && !(courseDropdownRef.current as any).contains(event.target)
      ) {
        setCourseDropdownOpen(false);
        setCourseDropdownFixed(false);
      }
      if (
        excludeDropdownFixed && excludeDropdownRef.current && !(excludeDropdownRef.current as any).contains(event.target)
      ) {
        setExcludeDropdownOpen(false);
        setExcludeDropdownFixed(false);
      }
      if (
        thresholdDropdownFixed && thresholdDropdownRef.current && !(thresholdDropdownRef.current as any).contains(event.target)
      ) {
        setThresholdDropdownOpen(false);
        setThresholdDropdownFixed(false);
      }
      if (
        perPageDropdownFixed && perPageDropdownRef.current && !(perPageDropdownRef.current as any).contains(event.target)
      ) {
        setPerPageDropdownOpen(false);
        setPerPageDropdownFixed(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [courseDropdownFixed, excludeDropdownFixed, thresholdDropdownFixed, perPageDropdownFixed]);

  async function load() {
    try {
      setIsLoading(true);
      const data = await fetchAttendance({ course, threshold, search, exclude_courses: excludeCourses, page: currentPage, per_page: perPage });
      
      // Handle both paginated and non-paginated responses
      if (data.records) {
        // Paginated response
        setRows(data.records);
        setTotalRecords(data.total || 0);
        console.log(`Loaded page ${data.page} of ${data.total_pages}, showing ${data.records.length} records out of ${data.total} total`);
      } else {
        // Non-paginated response (fallback for compatibility)
        setRows(Array.isArray(data) ? data : []);
        setTotalRecords(Array.isArray(data) ? data.length : 0);
      }
    } catch (e) {
      console.error('Error loading attendance data:', e);
      setRows([]);
      setTotalRecords(0);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadStats() {
    try { setStats(await fetchStats()); } catch { }
  }

  async function loadFilteredStats() {
    try {
      const data = await fetchFilteredStats({ course, threshold, search, exclude_courses: excludeCourses });
      setFilteredStats(data);
    } catch (e) {
      console.error(e);
    }
  }

  async function loadCourses() {
    try { setCourses(await fetchCourses()); } catch { }
  }

  // Handle course filter change - remove from exclude if selected
  function handleCourseChange(selectedCourse: string) {
    setCourse(selectedCourse);
    setCourseJustSelected(true);
    setCourseDropdownFixed(false);
    setCourseDropdownOpen(false);
    setTimeout(() => {
      setCourseJustSelected(false);
    }, 500);
    // Reset exclude courses if a specific course is selected (not "All Courses")
    if (selectedCourse) {
      setExcludeCourses([]);
    }
  }

  function handlePerPageChange(value: number) {
    setPerPage(value);
    setPerPageJustSelected(true);
    setPerPageDropdownFixed(false);
    setPerPageDropdownOpen(false);
    setTimeout(() => {
      setPerPageJustSelected(false);
    }, 300);
  }

  async function onDelete(recordId?: number) {
    if (!recordId) {
      setConfirmState({
        open: true,
        title: 'Delete Error',
        message: 'Missing record id.',
        destructive: false,
        onConfirm: () => setConfirmState({ open: false })
      });
      return;
    }
    setConfirmState({
      open: true,
      title: 'Confirm Delete',
      message: 'Are you sure you want to delete this record? This action cannot be undone.',
      destructive: true,
      onConfirm: async () => {
        setConfirmState({ open: false });
        await deleteRecord(recordId);
        await load();
        await loadFilteredStats();
        setInfoDialog({ open: true, title: 'Deleted', message: 'The record has been deleted successfully.' });
      }
    });
  }

  async function onClearAll() {
    setConfirmState({
      open: true,
      title: 'Clear All Data',
      message: (
        <span>
          This will permanently delete <strong>ALL</strong> attendance data.
          Please type <strong>DELETE</strong> to confirm.
        </span>
      ),
      confirmText: 'DELETE',
      destructive: true,
      onConfirm: async () => {
        setConfirmState({ open: false });
        try {
          await clearAllData();
          setExcludeCourses([]); // Reset exclude courses to default
          await Promise.all([load(), loadStats(), loadFilteredStats(), loadCourses()]);
          setInfoDialog({ open: true, title: 'Data Cleared', message: 'All attendance data has been removed successfully.' });
        } catch (error) {
          console.error('Error clearing data:', error);
          setInfoDialog({ open: true, title: 'Error', message: 'Failed to clear data. Please try again.' });
        }
      }
    });
  }

  return (
    <>
      <Navbar />
      <div className="dashboard">
        {/* Header */}
        <div className="dashboard-header">
          <div className="container">
            <div className="row align-items-center">
              <div className="col-md-8">
                <h1 className="mb-0"><i className="fas fa-chart-line me-3"></i>Attendance Dashboard</h1>
                <p className="mb-0 opacity-75">Monitor student attendance across all courses</p>
              </div>
              <div className="col-md-4 text-end">
              <button className="btn btn-warning me-2" id="clear-data-btn" title="Clear all attendance data from database" onClick={onClearAll}>
                <i className="fas fa-database me-2"></i>Clear Data
              </button>
              <a href="/upload" className="btn btn-light">
                <i className="fas fa-upload me-2"></i>Upload New Data
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="container py-4">

        {/* Statistics Cards */}
        <div className="row mb-4">
          <div className="col-md-3">
            <div className="card stats-card">
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <div>
                    <h6 className="card-title text-muted">
                      {search && filteredStats?.is_single_student ? 'Current Student' : 'Total Students'}
                    </h6>
                    {search && filteredStats?.is_single_student && filteredStats?.student_details ? (
                      <div className="student-info">
                        <div className="student-name"
                          title={filteredStats.student_details.name}>
                          {filteredStats.student_details.name}
                        </div>
                        <div className="student-reg"
                          title={filteredStats.student_details.registration_no}>
                          {filteredStats.student_details.registration_no}
                        </div>
                      </div>
                    ) : (
                      <h3 className="mb-0" id="total-students">{filteredStats?.total_students ?? 0}</h3>
                    )}
                  </div>
                  <div className="text-primary">
                    <i className={filteredStats?.is_single_student ? "fas fa-user fa-2x" : "fas fa-users fa-2x"}></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card stats-card">
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <div className="w-100">
                    <h6 className="card-title text-muted">Active Courses</h6>
                    <h3 className="mb-0 course-display" id="total-courses">
                      {stats?.total_students === 0 ? '0' : (
                        course && filteredStats?.course_details ? (
                          <div className="course-info">
                            <div className="course-code"
                              title={filteredStats.course_details.code}>
                              {filteredStats.course_details.code}
                            </div>
                            <div className="course-name"
                              title={filteredStats.course_details.name}>
                              {filteredStats.course_details.name}
                            </div>
                          </div>
                        ) : (
                          <span className="all-courses-display">
                            All Courses{' '}
                            <span className="course-count-bracket">
                              ({filteredStats?.total_courses ?? 0})
                            </span>
                          </span>
                        )
                      )}
                    </h3>
                  </div>
                  <div className="text-success">
                    <i className="fas fa-book fa-2x"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card stats-card">
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <div>
                    <h6 className="card-title text-muted">Students {'<'} 75%</h6>
                    <h3 className="mb-0 text-danger" id="low-attendance-count">
                      {filteredStats?.low_attendance_count ?? 0}
                    </h3>
                  </div>
                  <div className="text-danger">
                    <i className="fas fa-exclamation-triangle fa-2x"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card stats-card">
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <div>
                    <h6 className="card-title text-muted">Critical ({'<'} 65%)</h6>
                    <h3 className="mb-0 text-danger" id="critical-attendance-count">
                      {filteredStats?.critical_attendance_count ?? 0}
                    </h3>
                  </div>
                  <div className="text-danger">
                    <i className="fas fa-ban fa-2x"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="filter-section">
          <h5 className="mb-3"><i className="fas fa-filter me-2"></i>Filters</h5>
          {/* Single Row: Course, Exclude Courses, Threshold, Search, Clear Button */}
          <div className="row mb-4 align-items-end">
            <div className="col-lg col-md-6 col-sm-12 mb-3 mb-lg-0">
              <label className="form-label">Course</label>
              <div
                className="dropdown"
                ref={courseDropdownRef}
                onMouseEnter={() => !courseDropdownFixed && !courseJustSelected && setCourseDropdownOpen(true)}
                onMouseLeave={() => !courseDropdownFixed && !courseJustSelected && setCourseDropdownOpen(false)}
                style={{ position: 'relative' }}
              >
                <button
                  className="btn btn-outline-secondary dropdown-toggle w-100 text-start filter-dropdown-btn filter-dropdown-btn-custom"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded={courseDropdownOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCourseDropdownOpen(true);
                    setCourseDropdownFixed(f => !f);
                  }}
                >
                  <span className="filter-dropdown-span">
                    {course === '' ? 'All Courses' : courses.find(c => c.code === course)?.name || course}
                  </span>
                </button>
                <div
                  className={`dropdown-menu p-3 filter-dropdown-menu filter-dropdown-menu-custom${courseDropdownOpen ? ' show' : ''}`}
                >
                  <div
                    className="form-check filter-dropdown-check"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCourseChange('');
                    }}
                  >
                    <input
                      className="form-check-input"
                      type="radio"
                      name="courseFilter"
                      checked={course === ''}
                      onChange={() => {}}
                    />
                    <label
                      className="form-check-label filter-dropdown-label"
                    >
                      All Courses
                    </label>
                  </div>
                  {courses.map((c, index) => (
                    <div
                      key={c.code}
                      className={`form-check filter-dropdown-check${index === courses.length - 1 ? ' last' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCourseChange(c.code);
                      }}
                    >
                      <input
                        className="form-check-input"
                        type="radio"
                        name="courseFilter"
                        checked={course === c.code}
                        onChange={() => {}}
                      />
                      <label
                        className="form-check-label filter-dropdown-label"
                      >
                        {c.code} - {c.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="col-lg col-md-6 col-sm-12 mb-3 mb-lg-0">
              <label className="form-label">Exclude Courses</label>
              <div
                className="dropdown"
                ref={excludeDropdownRef}
                onMouseEnter={() => !excludeDropdownFixed && !course && setExcludeDropdownOpen(true)}
                onMouseLeave={() => !excludeDropdownFixed && setExcludeDropdownOpen(false)}
                onClick={() => {
                  if (!course) {
                    setExcludeDropdownOpen(true);
                    setExcludeDropdownFixed(f => !f);
                  }
                }}
                style={{ position: 'relative' }}
              >
                <button
                  className="btn btn-outline-secondary dropdown-toggle w-100 text-start filter-dropdown-btn filter-dropdown-btn-custom"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded={excludeDropdownOpen}
                  disabled={!!course}
                >
                  <span className="filter-dropdown-span">
                    {excludeCourses.length === 0 ? 'None' : `${excludeCourses.length} excluded`}
                  </span>
                </button>
                <div
                  className={`dropdown-menu p-3 filter-dropdown-menu filter-dropdown-menu-custom${excludeDropdownOpen ? ' show' : ''}`}
                >
                  {courses.filter(c => c.code !== course).length === 0 ? (
                    <div className="text-muted filter-dropdown-empty">No courses available</div>
                  ) : (
                    courses.filter(c => c.code !== course).map((c, index, array) => (
                      <div
                        key={c.code}
                        className={`form-check filter-dropdown-check${index === array.length - 1 ? ' last' : ''}`}
                      >
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={excludeCourses.includes(c.code)}
                          onChange={() => {
                            if (excludeCourses.includes(c.code)) {
                              setExcludeCourses(excludeCourses.filter(code => code !== c.code));
                            } else {
                              setExcludeCourses([...excludeCourses, c.code]);
                            }
                          }}
                        />
                        <label
                          className="form-check-label filter-dropdown-label"
                        >
                          {c.code} - {c.name}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="col-lg col-md-6 col-sm-12 mb-3 mb-lg-0">
              <label className="form-label">Threshold</label>
              <div
                className="dropdown"
                ref={thresholdDropdownRef}
                onMouseEnter={() => !thresholdDropdownFixed && !thresholdJustSelected && setThresholdDropdownOpen(true)}
                onMouseLeave={() => !thresholdDropdownFixed && !thresholdJustSelected && setThresholdDropdownOpen(false)}
                style={{ position: 'relative' }}
              >
                <button
                  className="btn btn-outline-secondary dropdown-toggle w-100 text-start filter-dropdown-btn filter-dropdown-btn-custom"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded={thresholdDropdownOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setThresholdDropdownOpen(true);
                    setThresholdDropdownFixed(f => !f);
                  }}
                >
                  <span className="filter-dropdown-span">
                    {threshold === 100 ? 'All Students' : `Below ${threshold}%`}
                  </span>
                </button>
                <div
                  className={`dropdown-menu p-3 filter-dropdown-menu filter-dropdown-menu-custom${thresholdDropdownOpen ? ' show' : ''}`}
                >
                  <div
                    className="form-check filter-dropdown-check"
                    onClick={(e) => {
                      e.stopPropagation();
                      setThreshold(75);
                      setThresholdDropdownOpen(false);
                      setThresholdDropdownFixed(false);
                      setThresholdJustSelected(true);
                      setTimeout(() => setThresholdJustSelected(false), 300);
                    }}
                  >
                    <input
                      className="form-check-input"
                      type="radio"
                      name="thresholdFilter"
                      checked={threshold === 75}
                      onChange={() => {}}
                    />
                    <label
                      className="form-check-label filter-dropdown-label"
                    >
                      Below 75%
                    </label>
                  </div>
                  <div
                    className="form-check filter-dropdown-check"
                    onClick={(e) => {
                      e.stopPropagation();
                      setThreshold(65);
                      setThresholdDropdownOpen(false);
                      setThresholdDropdownFixed(false);
                      setThresholdJustSelected(true);
                      setTimeout(() => setThresholdJustSelected(false), 300);
                    }}
                  >
                    <input
                      className="form-check-input"
                      type="radio"
                      name="thresholdFilter"
                      checked={threshold === 65}
                      onChange={() => {}}
                    />
                    <label
                      className="form-check-label filter-dropdown-label"
                    >
                      Below 65%
                    </label>
                  </div>
                  <div
                    className="form-check filter-dropdown-check last"
                    onClick={(e) => {
                      e.stopPropagation();
                      setThreshold(100);
                      setThresholdDropdownOpen(false);
                      setThresholdDropdownFixed(false);
                      setThresholdJustSelected(true);
                      setTimeout(() => setThresholdJustSelected(false), 300);
                    }}
                  >
                    <input
                      className="form-check-input"
                      type="radio"
                      name="thresholdFilter"
                      checked={threshold === 100}
                      onChange={() => {}}
                    />
                    <label
                      className="form-check-label filter-dropdown-label"
                    >
                      All Students
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-lg col-md-6 col-sm-12 mb-3 mb-lg-0">
              <label className="form-label">Search Student</label>
              <div className="search-box">
                <i className="fas fa-search"></i>
                <input
                  type="text"
                  className="form-control"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or registration number"
                  title="You can search by student name or registration number"
                  aria-label="Search by name or registration number"
                />
              </div>
            </div>

            <div className="col-lg-auto col-md-12 col-sm-12">
              <button
                className="btn btn-outline-secondary w-100 w-lg-auto"
                onClick={() => {
                  setCourse('');
                  setThreshold(75);
                  setSearch('');
                  setExcludeCourses([]);
                  setPerPage(50);
                  setCurrentPage(1);
                }}
                title="Clear all filters"
              >
                <i className="fas fa-times me-2"></i>Clear
              </button>
            </div>
          </div>
        </div>

        {/* No data in database message */}
        {(stats?.total_students ?? 0) === 0 && (
          <div id="no-data" className="text-center py-5">
            <div className="message-container">
              <i className="fas fa-database fa-4x text-muted mb-4"></i>
              <h4 className="text-muted mb-3">No Attendance Data Available</h4>
              <p className="text-muted mb-4">The database is empty. Please upload Excel files containing attendance data to get started.</p>
              <div className="d-flex justify-content-center">
                <a href="/upload" className="btn btn-primary btn-lg">
                  <i className="fas fa-upload me-2"></i>Upload Attendance Data
                </a>
              </div>
            </div>
          </div>
        )}

        {/* No backlog for current filters */}
        {rows.length === 0 && (stats?.total_students ?? 0) > 0 && (
          <div id="no-backlog" className="text-center py-5">
            <div className="message-container">
              <i className="fas fa-check-circle fa-4x text-success mb-4"></i>
              <h4 className="text-success mb-3">No Attendance Backlog Found</h4>
              <p className="text-muted mb-4">Great! No students found with attendance below the selected threshold for this course.</p>
              <div className="d-flex justify-content-center gap-3">
                <button className="btn btn-outline-primary" onClick={() => setThreshold(100)}>
                  <i className="fas fa-users me-2"></i>View All Students
                </button>
                <button className="btn btn-outline-secondary" onClick={() => { setCourse(''); setThreshold(75); setSearch(''); }}>
                  <i className="fas fa-times me-2"></i>Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="attendance-table">
            {isLoading && (
              <div className="mb-2 small text-muted d-flex align-items-center" aria-live="polite">
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Updating…
              </div>
            )}
            <div className="table-responsive">
              <table className="table table-hover mb-0" id="attendance-table">
                <thead className="table-dark">
                  <tr>
                    <th><i className="fas fa-hashtag me-1"></i>S.No</th>
                    <th><i className="fas fa-id-card me-1"></i>Registration No</th>
                    <th><i className="fas fa-user me-1"></i>Student Name</th>
                    <th><i className="fas fa-book me-1"></i>Course</th>
                    <th><i className="fas fa-calendar-check me-1"></i>Attended</th>
                    <th><i className="fas fa-calendar me-1"></i>Total</th>
                    <th><i className="fas fa-percentage me-1"></i>Attendance %</th>
                    <th><i className="fas fa-flag me-1"></i>Status</th>
                    <th className="text-center"><i className="fas fa-trash me-1"></i>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => {
                    const pct = r['Attendance %'];
                    const rowClass = pct < 65 ? 'critical-attendance' : pct < 75 ? 'low-attendance' : '';
                    return (
                      <tr key={idx} className={`attendance-row ${rowClass}`}>
                        <td>{(currentPage - 1) * perPage + idx + 1}</td>
                        <td>{r['Registration No']}</td>
                        <td>{r['Student Name']}</td>
                        <td>
                          <span className="badge bg-info">{r['Course Code']}</span><br />
                          <small className="text-muted">{r['Course Name']}</small>
                        </td>
                        <td>{r['Attended Periods']}</td>
                        <td>{r['Conducted Periods']}</td>
                        <td>
                          <span className={`percentage-badge ${pct < 65 ? 'badge-danger' : pct < 75 ? 'badge-warning' : 'badge-success'}`}>
                            {Math.round(pct)}%
                          </span>
                        </td>
                        <td>
                          {pct < 65 ? (
                            <span className="badge bg-danger"><i className="fas fa-ban me-1"></i>Critical</span>
                          ) : pct < 75 ? (
                            <span className="badge bg-warning"><i className="fas fa-exclamation me-1"></i>Low</span>
                          ) : (
                            <span className="badge bg-success"><i className="fas fa-check me-1"></i>Good</span>
                          )}
                        </td>
                        <td className="text-center">
                          <button className="btn btn-danger btn-sm delete-record" title="Delete this record" onClick={() => onDelete(r.id)}>
                            <i className="fas fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {rows.length > 0 && totalRecords > 0 && (
          <div className="row mt-4 mb-3">
            <div className="col-12">
              <nav aria-label="Page navigation">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="dropdown"
                      ref={perPageDropdownRef}
                      onMouseEnter={() => !perPageDropdownFixed && !perPageJustSelected && setPerPageDropdownOpen(true)}
                      onMouseLeave={() => !perPageDropdownFixed && !perPageJustSelected && setPerPageDropdownOpen(false)}
                      style={{ position: 'relative' }}
                    >
                      <button
                        className="btn btn-sm btn-outline-secondary dropdown-toggle"
                        type="button"
                        data-bs-toggle="dropdown"
                        aria-expanded={perPageDropdownOpen}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPerPageDropdownOpen(true);
                          setPerPageDropdownFixed(f => !f);
                        }}
                        style={{ minWidth: '90px' }}
                      >
                        {perPage} rows
                      </button>
                      <div
                        className={`dropdown-menu p-2${perPageDropdownOpen ? ' show' : ''}`}
                        style={{ minWidth: '90px' }}
                      >
                        {[50, 100, 200, 500].map((value) => (
                          <div
                            key={value}
                            className="dropdown-item cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePerPageChange(value);
                            }}
                            style={{ cursor: 'pointer', padding: '0.25rem 0.75rem' }}
                          >
                            {value} rows
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-muted small">
                      <strong>Showing {((currentPage - 1) * perPage) + 1} to {Math.min(currentPage * perPage, totalRecords)} of {totalRecords} records</strong>
                      {(() => {
                        const totalPages = Math.ceil(totalRecords / perPage);
                        return totalPages > 1 ? (
                          <span className="ms-2">
                            (Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>)
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <ul className="pagination pagination-sm mb-0">
                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        aria-label="First page"
                      >
                        <i className="fas fa-angle-double-left"></i>
                      </button>
                    </li>
                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        aria-label="Previous page"
                      >
                        <i className="fas fa-angle-left"></i>
                      </button>
                    </li>
                    
                    {(() => {
                      const totalPages = Math.ceil(totalRecords / perPage);
                      const pages = [];
                      const maxVisible = 3; // Max number of page buttons to show
                      
                      let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                      let endPage = Math.min(totalPages, startPage + maxVisible - 1);
                      
                      if (endPage - startPage < maxVisible - 1) {
                        startPage = Math.max(1, endPage - maxVisible + 1);
                      }
                      
                      if (startPage > 1) {
                        pages.push(
                          <li key="start-ellipsis" className="page-item disabled">
                            <span className="page-link">...</span>
                          </li>
                        );
                      }
                      
                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(
                          <li key={i} className={`page-item ${currentPage === i ? 'active' : ''}`}>
                            <button 
                              className="page-link" 
                              onClick={() => setCurrentPage(i)}
                            >
                              {i}
                            </button>
                          </li>
                        );
                      }
                      
                      if (endPage < totalPages) {
                        pages.push(
                          <li key="end-ellipsis" className="page-item disabled">
                            <span className="page-link">...</span>
                          </li>
                        );
                      }
                      
                      return pages;
                    })()}
                    
                    <li className={`page-item ${(() => {
                      const totalPages = Math.ceil(totalRecords / perPage);
                      return currentPage >= totalPages;
                    })() ? 'disabled' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={(() => {
                          const totalPages = Math.ceil(totalRecords / perPage);
                          return currentPage >= totalPages;
                        })()}
                        aria-label="Next page"
                      >
                        <i className="fas fa-angle-right"></i>
                      </button>
                    </li>
                    <li className={`page-item ${(() => {
                      const totalPages = Math.ceil(totalRecords / perPage);
                      return currentPage >= totalPages;
                    })() ? 'disabled' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => {
                          const totalPages = Math.ceil(totalRecords / perPage);
                          setCurrentPage(totalPages);
                        }}
                        disabled={(() => {
                          const totalPages = Math.ceil(totalRecords / perPage);
                          return currentPage >= totalPages;
                        })()}
                        aria-label="Last page"
                      >
                        <i className="fas fa-angle-double-right"></i>
                      </button>
                    </li>
                  </ul>
                </div>
              </nav>
            </div>
          </div>
        )}

        {/* Confirm Dialog */}
        <ConfirmDialog
          open={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          confirmText={confirmState.confirmText}
          destructive={confirmState.destructive}
          confirmButtonLabel={confirmState.confirmText ? 'Delete' : 'Confirm'}
          cancelButtonLabel="Cancel"
          onCancel={() => setConfirmState({ open: false })}
          onConfirm={(typed) => confirmState.onConfirm?.(typed)}
        />

        {/* Info Dialog for success messages */}
        <ConfirmDialog
          open={infoDialog.open}
          title={infoDialog.title}
          message={infoDialog.message}
          destructive={false}
          variant="info"
          onConfirm={() => setInfoDialog({ open: false })}
        />

        {/* Export buttons at bottom */}
        {rows.length > 0 && (
          <div className="row mt-4">
            <div className="col-md-12 text-center">
          <button className="btn btn-success me-2" onClick={() => {
            console.log('Export Excel - excludeCourses:', excludeCourses);
            exportExcel({ course, threshold, search, exclude_courses: excludeCourses });
          }}><i className="fas fa-file-excel me-2"></i>Export to Excel</button>
          <button className="btn btn-info" onClick={() => {
            console.log('Export PDF - excludeCourses:', excludeCourses);
            exportPdf({ course, threshold, search, exclude_courses: excludeCourses });
          }}><i className="fas fa-file-pdf me-2"></i>Export to PDF</button>
            </div>
          </div>
        )}

      </div>

      {/* Footer */}
      <footer className="mt-5 py-4 bg-dark text-white text-center">
        <div className="container">
          <p className="mb-0">&copy; {new Date().getFullYear()} Attendance Management System</p>
        </div>
      </footer>
      </div>
    </>
  );
}

// Inline ConfirmDialog to reduce file count
function ConfirmDialog({
  open,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmText,
  confirmButtonLabel,
  cancelButtonLabel = 'Cancel',
  destructive = false,
  hideCancel = false,
  variant = 'confirm',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  message?: ReactNode;
  confirmText?: string;
  confirmButtonLabel?: string;
  cancelButtonLabel?: string;
  destructive?: boolean;
  hideCancel?: boolean;
  variant?: 'confirm' | 'info';
  onConfirm: (typed?: string) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [typed, setTyped] = useState('');
  useEffect(() => { 
    if (!open) {
      setTyped(''); 
    } else {
      console.log('[ConfirmDialog] Opened:', { title, variant, destructive, confirmText, message });
    }
  }, [open, title, variant, destructive, confirmText, message]);
  if (!open) return null;
  const isInfo = variant === 'info';
  const computedConfirmLabel = confirmButtonLabel || (isInfo ? 'OK' : 'Confirm');
  const showCancel = !isInfo && !hideCancel && !!onCancel;

  const overlayStyle: CSSProperties = {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050,
  };
  const modalStyle: CSSProperties = {
    backgroundColor: '#fff', borderRadius: 8, width: 'min(520px, 92vw)', boxShadow: '0 10px 30px rgba(0,0,0,0.25)'
  };

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true">
      <div className="card shadow" style={modalStyle}>
        <div className="card-body">
          <div className="d-flex align-items-center mb-2" style={{ gap: 10 }}>
            <div className={`rounded-circle d-flex align-items-center justify-content-center ${isInfo ? 'bg-success' : (destructive ? 'bg-danger' : 'bg-primary')}`} style={{ width: 34, height: 34 }}>
              <i className={`fas ${isInfo ? 'fa-check' : 'fa-exclamation'} text-white`} aria-hidden="true"></i>
            </div>
            <h5 className="mb-0">{title}</h5>
          </div>
          <div className="mb-3 text-muted" style={{ lineHeight: 1.5 }}>
            {message}
          </div>
          {!isInfo && confirmText && (
            <div className="mb-3">
              <label htmlFor="confirmInput" className="form-label small mb-1">
                Type <strong>{confirmText}</strong> to continue
              </label>
              <input
                id="confirmInput"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={confirmText}
                className="form-control"
                autoFocus
              />
            </div>
          )}
          <div className="d-flex justify-content-end gap-2">
            {showCancel && (
              <button className="btn btn-outline-secondary" onClick={() => {
                console.log('[ConfirmDialog] Cancel clicked');
                onCancel?.();
              }}>{cancelButtonLabel}</button>
            )}
            <button
              className={`btn ${isInfo ? 'btn-success' : (destructive ? 'btn-danger' : 'btn-primary')}`}
              onClick={() => {
                console.log('[ConfirmDialog] Confirm clicked:', { typed, confirmText, variant });
                onConfirm(typed);
              }}
              disabled={!isInfo && !!confirmText && typed !== confirmText}
            >
              {computedConfirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
