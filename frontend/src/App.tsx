import { BrowserRouter, Routes, Route } from 'react-router-dom';
// import { BrowserRouter, Routes, Route, Link, NavLink } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      {/* <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
        <div className="container-fluid">
          <Link to="/" className="navbar-brand">Attendance</Link>
          <div className="navbar-nav">
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
            <NavLink to="/upload" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Upload</NavLink>
          </div>
        </div>
      </nav> */}
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/upload" element={<Upload />} />
      </Routes>
      {/* <footer className="mt-5 py-4 bg-dark text-white text-center">
        <div className="container">
          <p className="mb-0">© 2025 Attendance Management System</p>
        </div>
      </footer> */}
    </BrowserRouter>
  );
}
