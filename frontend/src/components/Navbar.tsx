import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <nav className="navbar navbar-expand-lg app-navbar">
      <div className="container-fluid">
        <Link to="/" className="navbar-brand">
          <i className="fas fa-graduation-cap me-2"></i>
          Attendance Tracker
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-expanded={isMenuOpen}
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className={`collapse navbar-collapse ${isMenuOpen ? 'show' : ''}`} id="navbarNav">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <Link
                to="/"
                className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <i className="fas fa-dashboard me-1"></i>
                Dashboard
              </Link>
            </li>
            <li className="nav-item">
              <Link
                to="/upload"
                className={`nav-link ${location.pathname === '/upload' ? 'active' : ''}`}
                onClick={() => setIsMenuOpen(false)}
              >
                <i className="fas fa-upload me-1"></i>
                Upload
              </Link>
            </li>
          </ul>
          <div className="d-flex align-items-center">
            <span className="navbar-text text-secondary me-3">
              <i className="fas fa-user-circle me-1"></i>
              {user?.user_metadata?.name || user?.email}
            </span>
            <button className="btn btn-outline-secondary btn-sm" onClick={handleLogout}>
              <i className="fas fa-sign-out-alt me-1"></i>
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
