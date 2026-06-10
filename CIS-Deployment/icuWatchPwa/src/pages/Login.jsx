import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const [name, setName] = useState('Dr. Demo');
  const [doctorId, setDoctorId] = useState('doctor-001');

  function handleLogin(e) {
    e.preventDefault();
    if (!name.trim() || !doctorId.trim()) return;
    localStorage.setItem('doctorName', name.trim());
    localStorage.setItem('doctorId', doctorId.trim());
    navigate('/patients');
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">🏥</div>
        <h1 className="login-title">ICU Alerts</h1>
        <p className="login-subtitle">Smartwatch alarm notifications POC</p>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="name">Doctor Name</label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dr. Demo"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="doctorId">Doctor ID</label>
            <input
              id="doctorId"
              type="text"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              placeholder="doctor-001"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
