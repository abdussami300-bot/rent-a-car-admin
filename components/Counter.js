"use client";

import { useState, useEffect } from "react";

export default function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log("Counter component loaded");
  }, []);

  useEffect(() => {
    console.log("Count changed:", count);
  }, [count]);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <div style={styles.badge}>CLIENT COMPONENT DEMO</div>
        <h3 style={styles.title}>Interactive Counter</h3>
        <p style={styles.subtitle}>
          This component uses React <code>useState</code> to track local state in the browser.
        </p>
      </div>

      <div style={styles.counterBox}>
        {/* Decrease Button */}
        <button
          onClick={() => setCount((prev) => prev - 1)}
          style={styles.button}
          aria-label="Decrease counter"
        >
          − 1
        </button>

        {/* Counter Display */}
        <div style={styles.valueDisplay}>
          <span style={styles.value}>{count}</span>
          <span style={styles.valueLabel}>Current Count</span>
        </div>

        {/* Increase Button */}
        <button
          onClick={() => setCount((prev) => prev + 1)}
          style={{ ...styles.button, ...styles.buttonPrimary }}
          aria-label="Increase counter"
        >
          + 1
        </button>
      </div>
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: "#1E1E1E",
    border: "1px solid #282828",
    borderRadius: "14px",
    padding: "22px",
    marginTop: "24px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.25)",
  },
  header: {
    marginBottom: "18px",
  },
  badge: {
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: "6px",
    backgroundColor: "rgba(0, 180, 216, 0.15)",
    border: "1px solid rgba(0, 180, 216, 0.4)",
    color: "#00E5FF",
    fontSize: "11px",
    fontWeight: "bold",
    letterSpacing: "0.5px",
    marginBottom: "8px",
  },
  title: {
    fontSize: "16px",
    fontWeight: "bold",
    color: "#FFFFFF",
    margin: "0 0 4px 0",
  },
  subtitle: {
    fontSize: "13px",
    color: "#9E9E9E",
    margin: 0,
  },
  counterBox: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    backgroundColor: "#141414",
    border: "1px solid #242424",
    borderRadius: "12px",
    padding: "16px 20px",
    maxWidth: "380px",
  },
  valueDisplay: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    fontSize: "32px",
    fontWeight: "900",
    color: "#00E5FF",
    lineHeight: 1.1,
  },
  valueLabel: {
    fontSize: "11px",
    color: "#757575",
    marginTop: "2px",
  },
  button: {
    padding: "10px 18px",
    borderRadius: "8px",
    backgroundColor: "#222222",
    border: "1px solid #333333",
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "all 0.15s ease",
    userSelect: "none",
  },
  buttonPrimary: {
    backgroundColor: "rgba(0, 180, 216, 0.2)",
    border: "1px solid rgba(0, 180, 216, 0.5)",
    color: "#00E5FF",
  },
};
