import './StatsCards.css';

interface StatsCardsProps {
  stats: { total_students: number; total_courses: number; low_attendance_count: number; critical_attendance_count: number } | null;
  filteredStats: {
    total_students: number;
    total_courses: number;
    low_attendance_count: number;
    critical_attendance_count: number;
    is_single_student: boolean;
    student_details?: { name: string; registration_no: string };
    total_courses_in_system: number;
    course_details?: { code: string; name: string };
    student_course_info?: string;
  } | null;
  search: string;
  course: string;
}

export default function StatsCards({ stats, filteredStats, search, course }: StatsCardsProps) {
  return (
    <div className="row mb-4">
      <div className="col-sm-6 col-md-3">
        <div className="card stats-card" data-stat="students">
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
      <div className="col-sm-6 col-md-3">
        <div className="card stats-card" data-stat="courses">
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
      <div className="col-sm-6 col-md-3">
        <div className="card stats-card" data-stat="low">
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
      <div className="col-sm-6 col-md-3">
        <div className="card stats-card" data-stat="critical">
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
  );
}
