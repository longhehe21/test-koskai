import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@components/layout/Layout';
import LoginPage from '@pages/LoginPage';
import ScanGuidePage from '@pages/ScanGuidePage';

// Lazy-load non-entry pages để giảm initial bundle (~20-30%).
// Login + ScanGuide eager vì user luôn đi qua 2 page này trước.
const CccdVerifyPage = lazy(() => import('@pages/CccdVerifyPage'));
const VneidLoginPage = lazy(() => import('@pages/VneidLoginPage'));
const ServicesPage = lazy(() => import('@pages/ServicesPage'));
const CuTruPage = lazy(() => import('@pages/CuTruPage'));
const XacDinhDoiTuongPage = lazy(() => import('@pages/XacDinhDoiTuongPage'));
const ScanTaiLieuPage = lazy(() => import('@pages/ScanTaiLieuPage'));
const TaoKhaiBaoTamVangPage = lazy(() => import('@pages/TaoKhaiBaoTamVangPage'));
const TaoHoSoThuongTruPage = lazy(() => import('@pages/TaoHoSoThuongTruPage'));
const TaoThongBaoLuuTruPage = lazy(() => import('@pages/TaoThongBaoLuuTruPage'));
const XemTruocHoSoPage = lazy(() => import('@pages/XemTruocHoSoPage'));
const HoSoCuaToiPage = lazy(() => import('@pages/HoSoCuaToiPage'));
const TamTruHoSoPage = lazy(() => import('@pages/TamTruHoSoPage'));
const NopHoSoThanhCongPage = lazy(() => import('@pages/NopHoSoThanhCongPage'));
const HoKhauTruongHopPage = lazy(() => import('@pages/HoKhauTruongHopPage'));
const HoKhauSinhSongPage = lazy(() => import('@pages/HoKhauSinhSongPage'));

function RouteFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div
        className="h-10 w-10 animate-spin rounded-full"
        style={{ border: '3px solid #e5e7eb', borderTopColor: '#2563eb' }}
      />
    </div>
  );
}

function withSuspense(node: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{node}</Suspense>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<LoginPage />} />
        <Route path="login" element={<Navigate to="/" replace />} />
        <Route path="scan-guide" element={<ScanGuidePage />} />
        <Route path="cccd-verify" element={withSuspense(<CccdVerifyPage />)} />
        <Route path="vneid-login" element={withSuspense(<VneidLoginPage />)} />
        <Route path="services" element={withSuspense(<ServicesPage />)} />
        <Route path="cu-tru" element={withSuspense(<CuTruPage />)} />
        <Route path="xac-dinh-doi-tuong" element={withSuspense(<XacDinhDoiTuongPage />)} />
        <Route path="scan-tai-lieu" element={withSuspense(<ScanTaiLieuPage />)} />
        <Route path="scan-tam-vang" element={withSuspense(<ScanTaiLieuPage />)} />
        <Route path="scan-luu-tru" element={withSuspense(<ScanTaiLieuPage />)} />
        <Route path="scan-tam-tru" element={withSuspense(<ScanTaiLieuPage />)} />
        <Route path="scan-ho-khau" element={withSuspense(<ScanTaiLieuPage />)} />
        <Route path="tao-khai-bao-tam-vang" element={withSuspense(<TaoKhaiBaoTamVangPage />)} />
        <Route path="tao-ho-so-thuong-tru" element={withSuspense(<TaoHoSoThuongTruPage />)} />
        <Route path="tao-thong-bao-luu-tru" element={withSuspense(<TaoThongBaoLuuTruPage />)} />
        <Route path="xem-truoc-ho-so" element={withSuspense(<XemTruocHoSoPage />)} />
        <Route path="xem-truoc-tam-vang" element={withSuspense(<XemTruocHoSoPage />)} />
        <Route path="xem-truoc-luu-tru" element={withSuspense(<XemTruocHoSoPage />)} />
        <Route path="xem-truoc-tam-tru" element={withSuspense(<XemTruocHoSoPage />)} />
        <Route path="xem-truoc-ho-khau" element={withSuspense(<XemTruocHoSoPage />)} />
        <Route path="ho-so-cua-toi" element={withSuspense(<HoSoCuaToiPage />)} />
        <Route path="tam-tru-ho-so" element={withSuspense(<TamTruHoSoPage />)} />
        <Route path="nop-ho-so-thanh-cong" element={withSuspense(<NopHoSoThanhCongPage />)} />
        <Route path="ho-khau-truong-hop" element={withSuspense(<HoKhauTruongHopPage />)} />
        <Route path="ho-khau-sinh-song" element={withSuspense(<HoKhauSinhSongPage />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
