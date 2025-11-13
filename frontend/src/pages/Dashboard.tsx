import { useEffect, useRef, useState } from 'react';
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
  const courseDropdownRef = useRef(null);
  const excludeDropdownRef = useRef(null);
  const thresholdDropdownRef = useRef(null);

  // Real-time filtering: reload when filters change
  useEffect(() => {
    load();
    loadFilteredStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course, threshold, search, excludeCourses]);

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
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [courseDropdownFixed, excludeDropdownFixed, thresholdDropdownFixed]);

  async function load() {
    try {
      const data = await fetchAttendance({ course, threshold, search, exclude_courses: excludeCourses });
      setRows(data);
    } catch (e) {
      console.error(e);
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

  async function onDelete(recordId?: number) {
    if (!recordId) {
      alert('Missing record id.');
      return;
    }
    if (!confirm('Are you sure you want to delete this record?')) return;
    await deleteRecord(recordId);
    await load();
    await loadFilteredStats();
  }

  async function onClearAll() {
    if (!confirm('This will delete ALL data. Type DELETE in the next prompt to confirm.')) return;
    const confirmText = prompt('Type "DELETE" to confirm (case sensitive):');
    if (confirmText !== 'DELETE') return;

    try {
      await clearAllData();
      setExcludeCourses([]); // Reset exclude courses to default
      // Reload all data to reflect the cleared state
      await Promise.all([
        load(),
        loadStats(),
        loadFilteredStats(),
        loadCourses()
      ]);
      alert('All data has been cleared successfully!');
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('Failed to clear data. Please try again.');
    }
  }

  return (
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
          <div className="row mb-4">
            <div className="col-md-3">
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

            <div className="col-md-3">
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

            <div className="col-md-3">
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

            <div className="col-md-2">
              <label className="form-label">Search Student</label>
              <div className="search-box">
                <i className="fas fa-search"></i>
                <input
                  type="text"
                  className="form-control"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or reg..."
                  title="You can search by student name or registration number"
                  aria-label="Search by name or registration number"
                />
              </div>
            </div>

            <div className="col-md-1 d-flex align-items-end">
              <button
                className="btn btn-outline-secondary w-100"
                onClick={() => {
                  setCourse('');
                  setThreshold(75);
                  setSearch('');
                  setExcludeCourses([]);
                }}
                title="Clear all filters"
              >
                Clear
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
                        <td>{idx + 1}</td>
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
          <p className="mb-0">&copy; 2025 Attendance Management System</p>
        </div>
      </footer>
    </div>
  );
}
