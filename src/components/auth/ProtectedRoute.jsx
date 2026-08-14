import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const role = localStorage.getItem("role");
  
  if (role !== "ADMIN") {
    // Silently redirect non-admin users away from the admin dashboard to reader home
    return <Navigate to="/" replace />;
  }

  return children;
}
