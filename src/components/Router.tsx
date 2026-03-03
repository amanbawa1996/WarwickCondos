"use client";
import React, { useMemo } from "react";
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { ScrollToTop } from '@/lib/scroll-to-top';
import { Toaster } from '@/components/ui/toaster';
import { MemberProvider } from '@/integrations';
import ErrorPage from '@/integrations/errorHandlers/ErrorPage';
import SubmitRequestPage from '@/components/pages/SubmitRequestPage';
import DashboardPage from '@/components/pages/DashboardPage';
import AdminDashboardPage from '@/components/pages/AdminDashboardPage';
import StaffManagementPage from '@/components/pages/StaffManagementPage';
import WorkOrderDetailsPage from '@/components/pages/WorkOrderDetailsPage';
import ResidentHomePage from "@/components/pages/ResidentHomePage";
import PaymentPage from '@/components/pages/PaymentPage';
import ProfilePage from '@/components/pages/ProfilePage';
import PortalChoicePage from '@/components/pages/PortalChoicePage';
import UnifiedLoginPage from '@/components/pages/UnifiedLoginPage';
import { useMember } from "@/integrations";


function RequireAuth() {
  const { isAuthenticated, isLoading } = useMember();
  if (isLoading) return null; // or spinner
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function RequireAdmin() {
  const { isAuthenticated, isLoading, userRole } = useMember();
  if (isLoading) return null;
  if (!isAuthenticated) {
    console.log("Not Authenticated")
    return <Navigate to="/login" replace />;
  }
  if (userRole !== "admin") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}


// Layout component that includes ScrollToTop and Toaster
function Layout() {
  return (
    <>
      <ScrollToTop />
      <Toaster />
      <Outlet />
    </>
  );
}




// // Robust basename configuration that handles '/src' issue
// function getBasename() {
//   // In development/preview, the app might be served from /src
//   // In production, it should be served from /
//   // We detect the current pathname and adjust accordingly
  
//   if (typeof window === 'undefined') {
//     return '/';
//   }
  
//   const pathname = window.location.pathname;
//   //const base = import.meta.env.BASE_NAME;
  
//   console.log('🔧 getBasename() - Current pathname:', pathname);
//   // console.log('🔧 getBasename() - BASE_NAME:', base);
  
//   // If we're at /src or /src/, use /src as basename
//   // Otherwise use /
//   if (pathname.startsWith('/src/') || pathname === '/src') {
//     console.warn('⚠️ Detected /src path, using /src as basename');
//     return '/src';
//   }
  
//   console.warn('⚠️ Using / as basename');
//   return '/';
// }

export default function AppRouter() {
  // Debug: Log the basename being used
  const router = useMemo(() => createBrowserRouter([
    {
      path: "/",
      element: <Layout />,
      errorElement: <ErrorPage />,
      children: [
        {
          index: true,
          element: <Navigate to="/login" replace />,
        },
        {
          path: "login",
          element: <UnifiedLoginPage />,
        },
        {
          path: "portals",
          element: <PortalChoicePage />,
        },
        {element: <RequireAuth />, 
          children: [
            {
              path: "submit",
              element: <SubmitRequestPage />,
            },
            {
              path: "work-order/:id",
              element: <WorkOrderDetailsPage />,
            },
            {
              path: "payment",
              element: <PaymentPage />,
            },
            {
              path: "profile",
              element: <ProfilePage />,
            },
            {
              path: "dashboard",
              element: <DashboardPage />,
            },
            {
              path: "ResidentHomePage",
              element: <ResidentHomePage />,
            },
          ]
        },
        {
          path: "resident-login",
          element: <Navigate to="/login" replace />,
        },
        {
          path: "admin-login",
          element: <Navigate to="/login" replace />,
        },
        { element: <RequireAdmin />, children: [
            { path: "AdminDashboard", element: <AdminDashboardPage /> },
            { path: "staff-management", element: <StaffManagementPage /> },
          ]
        },
        
        {
          path: "*",
          element: <Navigate to="/" replace />,
        },
      ],
    },
  ]), []);
  return (
    <MemberProvider>
      <RouterProvider router={router} />
    </MemberProvider>
  );
}
