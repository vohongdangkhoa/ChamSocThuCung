import { useEffect } from "react";
import { vietHoaLoiNhap, xoaLoiNhap } from "./thong-bao-bieu-mau";
import { AuthProvider, useAuth } from "./xac-thuc";
import { AuthPages } from "./trang-dang-nhap";
import { CustomerPortal } from "./cong-khach-hang";
import { AdminPortal, StaffPortal, VetPortal } from "./cong-van-hanh";

function LoadingScreen() {
  return (
    <main className="loading-screen" aria-live="polite">
      <div className="brand-mark">✦</div>
      <p>PetNoVa đang chuẩn bị không gian cho bạn…</p>
    </main>
  );
}

function AccessError({ error, onRetry, onLogout }) {
  return (
    <main className="access-error">
      <div className="error-card">
        <span className="error-icon">!</span>
        <h1>Chưa thể mở PetNoVa</h1>
        <p>{error}</p>
        <div className="button-row">
          <button className="button button-primary" onClick={onRetry}>
            Thử lại
          </button>
          <button className="button button-secondary" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </div>
    </main>
  );
}

function RolePortal() {
  const { user, profile, loading, error, refreshProfile, logout } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <AuthPages />;
  if (!profile) {
    return (
      <AccessError
        error={error || "Không tìm thấy hồ sơ PetNoVa của tài khoản này."}
        onRetry={refreshProfile}
        onLogout={logout}
      />
    );
  }

  const portalProps = { user: profile, firebaseUser: user, onLogout: logout };
  switch (String(profile.role || "").toUpperCase()) {
    case "ADMIN":
      return <AdminPortal {...portalProps} />;
    case "STAFF":
      return <StaffPortal {...portalProps} />;
    case "VET":
      return <VetPortal {...portalProps} />;
    case "CUSTOMER":
    default:
      return <CustomerPortal {...portalProps} />;
  }
}

export default function App() {
  useEffect(() => {
    document.addEventListener("invalid", vietHoaLoiNhap, true);
    document.addEventListener("input", xoaLoiNhap, true);
    document.addEventListener("change", xoaLoiNhap, true);
    return () => {
      document.removeEventListener("invalid", vietHoaLoiNhap, true);
      document.removeEventListener("input", xoaLoiNhap, true);
      document.removeEventListener("change", xoaLoiNhap, true);
    };
  }, []);
  return (
    <AuthProvider>
      <RolePortal />
    </AuthProvider>
  );
}
