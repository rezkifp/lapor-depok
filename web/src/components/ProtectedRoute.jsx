import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../lib/auth";

export default function ProtectedRoute({ roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <p className="text-sm text-muted">Memuat akun...</p>
      </div>
    );
  }

  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/masuk?next=${encodeURIComponent(next)}`} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === "warga" ? "/" : "/admin"} replace />;
  }

  return <Outlet />;
}

export function RoleGate({ roles }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) return <Navigate to="/admin" replace />;
  return <Outlet />;
}
