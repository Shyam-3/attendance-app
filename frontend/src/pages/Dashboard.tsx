import { useEffect, useRef, useState, type ReactNode } from 'react';
import Navbar from '../components/Navbar';
import ConfirmDialog from '../components/ConfirmDialog';
import StatsCards from '../components/dashboard/StatsCards';
import FilterBar from '../components/dashboard/FilterBar';
import AttendanceTable from '../components/dashboard/AttendanceTable';
import PaginationBar from '../components/dashboard/Pagination';
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
  const [errorDialog, setErrorDialog] = useState<{ open: boolean; title?: string; message?: ReactNode }>({ open: false });

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
      setErrorDialog({
        open: true,
        title: 'Delete Error',
        message: 'Missing record id.',
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
        try {
          await deleteRecord(recordId);
          await load();
          await loadFilteredStats();
          setInfoDialog({ open: true, title: 'Deleted', message: 'The record has been deleted successfully.' });
        } catch (error) {
          console.error('Error deleting record:', error);
          setErrorDialog({ open: true, title: 'Delete Failed', message: 'Failed to delete the record. Please check your connection and try again.' });
        }
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
          setErrorDialog({ open: true, title: 'Clear Failed', message: 'Failed to clear data. Please check your connection and try again.' });
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
              <div className="col-md-4 text-end dashboard-header-actions">
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
        <StatsCards
          stats={stats}
          filteredStats={filteredStats}
          search={search}
          course={course}
        />

        {/* Filters Section */}
        <FilterBar
          courses={courses}
          course={course}
          setCourse={setCourse}
          threshold={threshold}
          setThreshold={setThreshold}
          search={search}
          setSearch={setSearch}
          excludeCourses={excludeCourses}
          setExcludeCourses={setExcludeCourses}
          setPerPage={setPerPage}
          setCurrentPage={setCurrentPage}
          courseDropdownOpen={courseDropdownOpen}
          setCourseDropdownOpen={setCourseDropdownOpen}
          excludeDropdownOpen={excludeDropdownOpen}
          setExcludeDropdownOpen={setExcludeDropdownOpen}
          thresholdDropdownOpen={thresholdDropdownOpen}
          setThresholdDropdownOpen={setThresholdDropdownOpen}
          courseDropdownFixed={courseDropdownFixed}
          setCourseDropdownFixed={setCourseDropdownFixed}
          excludeDropdownFixed={excludeDropdownFixed}
          setExcludeDropdownFixed={setExcludeDropdownFixed}
          thresholdDropdownFixed={thresholdDropdownFixed}
          setThresholdDropdownFixed={setThresholdDropdownFixed}
          courseJustSelected={courseJustSelected}
          thresholdJustSelected={thresholdJustSelected}
          setThresholdJustSelected={setThresholdJustSelected}
          courseDropdownRef={courseDropdownRef}
          excludeDropdownRef={excludeDropdownRef}
          thresholdDropdownRef={thresholdDropdownRef}
          handleCourseChange={handleCourseChange}
        />

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

        {/* Attendance Table */}
        {rows.length > 0 && (
          <AttendanceTable
            rows={rows}
            currentPage={currentPage}
            perPage={perPage}
            isLoading={isLoading}
            onDelete={onDelete}
          />
        )}

        {/* Pagination */}
        {rows.length > 0 && totalRecords > 0 && (
          <PaginationBar
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalRecords={totalRecords}
            perPage={perPage}
            perPageDropdownOpen={perPageDropdownOpen}
            setPerPageDropdownOpen={setPerPageDropdownOpen}
            perPageDropdownFixed={perPageDropdownFixed}
            setPerPageDropdownFixed={setPerPageDropdownFixed}
            perPageJustSelected={perPageJustSelected}
            perPageDropdownRef={perPageDropdownRef}
            handlePerPageChange={handlePerPageChange}
          />
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

        {/* Error Dialog for error messages */}
        <ConfirmDialog
          open={errorDialog.open}
          title={errorDialog.title}
          message={errorDialog.message}
          destructive={false}
          variant="error"
          onConfirm={() => setErrorDialog({ open: false })}
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
