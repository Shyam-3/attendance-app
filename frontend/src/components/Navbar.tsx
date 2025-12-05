import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container-fluid">
        <Link to="/" className="navbar-brand">
          <i className="fas fa-graduation-cap me-2"></i>
          Attendance Tracker
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <Link
                to="/"
                className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
              >
                <i className="fas fa-dashboard me-1"></i>
                Dashboard
              </Link>
            </li>
            <li className="nav-item">
              <Link
                to="/upload"
                className={`nav-link ${location.pathname === '/upload' ? 'active' : ''}`}
              >
                <i className="fas fa-upload me-1"></i>
                Upload
              </Link>
            </li>
          </ul>
          <div className="d-flex align-items-center">
            <span className="navbar-text me-3">
              <i className="fas fa-user-circle me-1"></i>
              {user?.email}
            </span>
            <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>
              <i className="fas fa-sign-out-alt me-1"></i>
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
