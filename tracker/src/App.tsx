import { Routes, Route, Navigate } from 'react-router-dom';
import { TrackingPage } from './TrackingPage';
import { HomePage } from './HomePage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/t/:code" element={<TrackingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
