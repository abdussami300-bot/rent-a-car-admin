"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { verifyAdminRole } from "@/lib/adminAuth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // If already authenticated, verify role before redirecting to dashboard
  useEffect(() => {
    // Check if redirected with an access error in URL
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const errParam = params.get("error");
      if (errParam === "no-admin") {
        setError("You do not have admin access.");
      } else if (errParam === "no-record") {
        setError("Access denied. No user account record exists in the system.");
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const verification = await verifyAdminRole(user.uid, user.email || "");
        if (verification.isAdmin) {
          router.replace("/dashboard");
        } else {
          setError(verification.error || "You do not have admin access.");
          setCheckingAuth(false);
        }
      } else {
        setCheckingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter both email and password.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      
      // Verify Firestore admin role (uid == currentUser.uid)
      const verification = await verifyAdminRole(userCredential.user.uid, userCredential.user.email || email.trim());

      if (!verification.isAdmin) {
        setError(verification.error || "You do not have admin access.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      let message = "Failed to sign in. Please verify your credentials.";
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/user-not-found" ||
        err.code === "auth/wrong-password"
      ) {
        message = "Invalid email or password.";
      } else if (err.code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      } else if (err.code === "auth/user-disabled") {
        message = "This admin account has been disabled.";
      } else if (err.code === "auth/too-many-requests") {
        message = "Too many failed attempts. Please try again later.";
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Checking authentication...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Brand Header */}
        <div style={styles.brandSection}>
          <div style={styles.logoBox}>
            <img
              src="/sayyarah-icon.png"
              alt="Sayyarah Logo"
              style={styles.logoImg}
            />
          </div>
          <div style={styles.tagBadge}>SAYYARAH PORTAL</div>
          <h1 style={styles.title}>Admin Console</h1>
          <p style={styles.subtitle}>Sign in with your admin credentials to access operations</p>
        </div>

        {/* Error Notification */}
        {error && (
          <div style={styles.errorBox} role="alert">
            <span style={styles.errorIcon}>⚠️</span>
            <span style={styles.errorText}>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="admin-email" style={styles.label}>
              Email Address
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@sayyarah.com"
              required
              autoComplete="email"
              disabled={loading}
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="admin-password" style={styles.label}>
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              disabled={loading}
              style={styles.input}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
          >
            {loading ? (
              <span style={styles.buttonContent}>
                <span style={styles.buttonSpinner} />
                Signing In...
              </span>
            ) : (
              "Sign In to Dashboard"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#121212",
    padding: "20px",
    boxSizing: "border-box",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    width: "100%",
    maxWidth: "420px",
    backgroundColor: "#1E1E1E",
    border: "1px solid #282828",
    borderRadius: "16px",
    padding: "36px 32px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.45)",
    boxSizing: "border-box",
  },
  brandSection: {
    textAlign: "center",
    marginBottom: "28px",
  },
  logoBox: {
    width: "64px",
    height: "64px",
    borderRadius: "16px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "14px",
    boxShadow: "0 4px 16px rgba(0, 180, 216, 0.35)",
    overflow: "hidden",
  },
  logoImg: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  tagBadge: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "6px",
    backgroundColor: "rgba(0, 180, 216, 0.12)",
    border: "1px solid rgba(0, 180, 216, 0.35)",
    color: "#00E5FF",
    fontSize: "11px",
    fontWeight: "bold",
    letterSpacing: "0.8px",
    marginBottom: "10px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "800",
    color: "#FFFFFF",
    margin: "0 0 6px 0",
    letterSpacing: "-0.5px",
  },
  subtitle: {
    fontSize: "13px",
    color: "#9E9E9E",
    margin: 0,
    lineHeight: "1.5",
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    borderRadius: "10px",
    padding: "12px 14px",
    marginBottom: "20px",
  },
  errorIcon: {
    fontSize: "16px",
    flexShrink: 0,
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: "13px",
    lineHeight: "1.4",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#E0E0E0",
    letterSpacing: "0.3px",
  },
  input: {
    width: "100%",
    padding: "12px 14px",
    backgroundColor: "#141414",
    border: "1px solid #333333",
    borderRadius: "10px",
    color: "#FFFFFF",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s ease",
  },
  button: {
    marginTop: "8px",
    padding: "13px",
    backgroundColor: "#00B4D8",
    border: "none",
    borderRadius: "10px",
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "background-color 0.2s ease, transform 0.1s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
  },
  buttonContent: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  buttonSpinner: {
    width: "14px",
    height: "14px",
    border: "2px solid rgba(255, 255, 255, 0.3)",
    borderTopColor: "#FFFFFF",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    display: "inline-block",
  },
  loadingContainer: {
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
  },
};
