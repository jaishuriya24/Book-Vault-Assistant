import { createBrowserRouter } from "react-router-dom";

/* AUTH */
import SignIn from "../screens/auth/SignIn";
import SignUp from "../screens/auth/SignUp";
import OTPVerify from "../screens/auth/OTPVerify";
import FaceLogin from "../screens/auth/FaceLogin";
import AdminSignIn from "../screens/auth/AdminSignIn";
import ProtectedRoute from "../components/auth/ProtectedRoute";

/* ADMIN */
import AdminDashboard from "../components/home/AdminDashboard";

/* FUTURE SCREENS (placeholders for now) */
const Placeholder = ({ title }) => (
  <div className="p-10 text-xl">{title}</div>
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <SignIn />,
  },
  {
    path: "/signin",
    element: <SignIn />,
  },
  {
    path: "/facelogin",
    element: <FaceLogin />,
  },
  {
    path: "/face-login",
    element: <FaceLogin />,
  },
  {
    path: "/signup",
    element: <SignUp />,
  },
  {
    path: "/otp",
    element: <OTPVerify />,
  },

  /* HIDDEN ADMIN PORTAL */
  {
    path: "/admin-login",
    element: <AdminSignIn />,
  },

  /* CORE APP */
  {
    path: "/library",
    element: <Placeholder title="Library - My Collections" />,
  },
  {
    path: "/folder/:id",
    element: <Placeholder title="Folder Detail" />,
  },
  {
    path: "/book/:id",
    element: <Placeholder title="Book Detail" />,
  },

  /* DISCOVERY */
  {
    path: "/search",
    element: <Placeholder title="Search Home" />,
  },

  /* OCR PIPELINE */
  {
    path: "/add-book",
    element: <Placeholder title="Add Book" />,
  },

  /* READER */
  {
    path: "/reader/:id",
    element: <Placeholder title="Reader Screen" />,
  },

  /* USER */
  {
    path: "/profile",
    element: <Placeholder title="Profile" />,
  },
  {
    path: "/settings",
    element: <Placeholder title="Settings" />,
  },

  /* PROTECTED ADMIN DASHBOARD */
  {
    path: "/admin-dashboard",
    element: (
      <ProtectedRoute>
        <AdminDashboard />
      </ProtectedRoute>
    ),
  },
]);