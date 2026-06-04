import './FilterBar.css';

interface FilterBarProps {
  courses: Array<{ code: string; name: string }>;
  course: string;
  setCourse: (course: string) => void;
  threshold: number;
  setThreshold: (threshold: number) => void;
  search: string;
  setSearch: (search: string) => void;
  excludeCourses: string[];
  setExcludeCourses: (courses: string[]) => void;
  setPerPage: (perPage: number) => void;
  setCurrentPage: (page: number) => void;
  // Dropdown state
  courseDropdownOpen: boolean;
  setCourseDropdownOpen: (open: boolean) => void;
  excludeDropdownOpen: boolean;
  setExcludeDropdownOpen: (open: boolean) => void;
  thresholdDropdownOpen: boolean;
  setThresholdDropdownOpen: (open: boolean) => void;
  courseDropdownFixed: boolean;
  setCourseDropdownFixed: (fixed: boolean | ((prev: boolean) => boolean)) => void;
  excludeDropdownFixed: boolean;
  setExcludeDropdownFixed: (fixed: boolean | ((prev: boolean) => boolean)) => void;
  thresholdDropdownFixed: boolean;
  setThresholdDropdownFixed: (fixed: boolean | ((prev: boolean) => boolean)) => void;
  courseJustSelected: boolean;
  thresholdJustSelected: boolean;
  setThresholdJustSelected: (val: boolean) => void;
  courseDropdownRef: React.RefObject<HTMLDivElement | null>;
  excludeDropdownRef: React.RefObject<HTMLDivElement | null>;
  thresholdDropdownRef: React.RefObject<HTMLDivElement | null>;
  handleCourseChange: (course: string) => void;
}

export default function FilterBar({
  courses,
  course,
  setCourse,
  threshold,
  setThreshold,
  search,
  setSearch,
  excludeCourses,
  setExcludeCourses,
  setPerPage,
  setCurrentPage,
  courseDropdownOpen,
  setCourseDropdownOpen,
  excludeDropdownOpen,
  setExcludeDropdownOpen,
  thresholdDropdownOpen,
  setThresholdDropdownOpen,
  courseDropdownFixed,
  setCourseDropdownFixed,
  excludeDropdownFixed,
  setExcludeDropdownFixed,
  thresholdDropdownFixed,
  setThresholdDropdownFixed,
  courseJustSelected,
  thresholdJustSelected,
  setThresholdJustSelected,
  courseDropdownRef,
  excludeDropdownRef,
  thresholdDropdownRef,
  handleCourseChange,
}: FilterBarProps) {
  return (
    <div className="filter-section">
      <h5 className="mb-3"><i className="fas fa-filter me-2"></i>Filters</h5>
      {/* Single Row: Course, Exclude Courses, Threshold, Search, Clear Button */}
      <div className="row mb-4 align-items-end">
        <div className="col-lg col-md-6 col-sm-12 mb-3 mb-lg-0">
          <label className="form-label">Course</label>
          <div
            className={`dropdown ${courseDropdownOpen ? 'is-open' : ''}`}
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
            className={`dropdown ${excludeDropdownOpen ? 'is-open' : ''}`}
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
            className={`dropdown ${thresholdDropdownOpen ? 'is-open' : ''}`}
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
  );
}
