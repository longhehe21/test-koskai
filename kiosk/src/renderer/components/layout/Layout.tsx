import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { AiSidebar } from './AiSidebar';

export function Layout() {
  const location = useLocation();

  return (
    <div className="app-layout">
      <Header />
      <div className="kiosk-body">
        <AiSidebar />
        <main className="kiosk-content-panel">
          <div key={location.pathname} className="route-view panel-slide-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
