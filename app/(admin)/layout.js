"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { verifyAdminRole } from "@/lib/adminAuth";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (isMounted) {
          setAuthenticated(false);
          setLoading(false);
          router.replace("/login");
        }
        return;
      }

      // Verify Firestore users document has role == "admin"
      const verification = await verifyAdminRole(user.uid, user.email || "");

      if (!isMounted) return;

      if (verification.isAdmin) {
        setAuthenticated(true);
        setLoading(false);
      } else {
        setAuthenticated(false);
        setLoading(false);
        const errParam = verification.error?.includes("No user account record")
          ? "no-record"
          : "no-admin";
        router.replace(`/login?error=${errParam}`);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Verifying admin session...</p>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div style={styles.layout}>
      {/* Mobile Backdrop Overlay */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Left Navigation Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Area: Topbar + Dynamic Page Content */}
      <div style={styles.mainWrapper}>
        <Topbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="admin-content" style={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}

const styles = {
  layout: {
    display: "flex",
    minHeight: "100vh",
    maxWidth: "100vw",
    overflowX: "hidden",
    backgroundColor: "#121212",
    color: "#FFFFFF",
    position: "relative",
  },
  mainWrapper: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    backgroundColor: "#121212",
    maxWidth: "100%",
    overflowX: "hidden",
  },
  content: {
    flex: 1,
    padding: "32px",
    backgroundColor: "#121212",
    maxWidth: "100%",
    boxSizing: "border-box",
  },
  loadingScreen: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#121212",
    gap: "16px",
  },
  spinner: {
    width: "36px",
    height: "36px",
    border: "3px solid #282828",
    borderTopColor: "#00B4D8",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    color: "#9E9E9E",
    fontSize: "13px",
    letterSpacing: "0.4px",
  },
};
