import './AttendanceTable.css';

interface AttendanceTableProps {
  rows: Array<{
    id?: number;
    'S.No': number;
    'Registration No': string;
    'Student Name': string;
    'Course Code': string;
    'Course Name': string;
    'Attended Periods': number;
    'Conducted Periods': number;
    'Attendance %': number;
  }>;
  currentPage: number;
  perPage: number;
  isLoading: boolean;
  onDelete: (id?: number) => void;
}

export default function AttendanceTable({ rows, currentPage, perPage, isLoading, onDelete }: AttendanceTableProps) {
  return (
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
                  <td data-label="S.No">{(currentPage - 1) * perPage + idx + 1}</td>
                  <td data-label="Reg No">{r['Registration No']}</td>
                  <td data-label="Name">{r['Student Name']}</td>
                  <td data-label="Course">
                    <span className="badge bg-info">{r['Course Code']}</span><br />
                    <small className="text-muted">{r['Course Name']}</small>
                  </td>
                  <td data-label="Attended">{r['Attended Periods']}</td>
                  <td data-label="Total">{r['Conducted Periods']}</td>
                  <td data-label="Attendance %">
                    <span className={`percentage-badge ${pct < 65 ? 'badge-danger' : pct < 75 ? 'badge-warning' : 'badge-success'}`}>
                      {Math.round(pct)}%
                    </span>
                  </td>
                  <td data-label="Status">
                    {pct < 65 ? (
                      <span className="badge bg-danger"><i className="fas fa-ban me-1"></i>Critical</span>
                    ) : pct < 75 ? (
                      <span className="badge bg-warning"><i className="fas fa-exclamation me-1"></i>Low</span>
                    ) : (
                      <span className="badge bg-success"><i className="fas fa-check me-1"></i>Good</span>
                    )}
                  </td>
                  <td data-label="Action" className="text-center">
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
  );
}
