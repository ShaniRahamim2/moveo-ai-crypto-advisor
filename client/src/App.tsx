import { Route, Routes } from 'react-router-dom';
import { ConnectivityPage } from './pages/ConnectivityPage';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<ConnectivityPage />} />
      <Route path="*" element={<ConnectivityPage />} />
    </Routes>
  );
}
