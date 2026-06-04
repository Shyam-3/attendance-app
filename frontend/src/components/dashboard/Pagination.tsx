import './Pagination.css';

interface PaginationProps {
  currentPage: number;
  setCurrentPage: (page: number | ((prev: number) => number)) => void;
  totalRecords: number;
  perPage: number;
  perPageDropdownOpen: boolean;
  setPerPageDropdownOpen: (open: boolean) => void;
  perPageDropdownFixed: boolean;
  setPerPageDropdownFixed: (fixed: boolean | ((prev: boolean) => boolean)) => void;
  perPageJustSelected: boolean;
  perPageDropdownRef: React.RefObject<HTMLDivElement | null>;
  handlePerPageChange: (value: number) => void;
}

export default function Pagination({
  currentPage,
  setCurrentPage,
  totalRecords,
  perPage,
  perPageDropdownOpen,
  setPerPageDropdownOpen,
  perPageDropdownFixed,
  setPerPageDropdownFixed,
  perPageJustSelected,
  perPageDropdownRef,
  handlePerPageChange,
}: PaginationProps) {
  return (
    <div className="row mt-4 mb-3">
      <div className="col-12">
        <nav aria-label="Page navigation">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <div className="d-flex align-items-center gap-3">
              <div
                className={`dropdown ${perPageDropdownOpen ? 'is-open' : ''}`}
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
  );
}
