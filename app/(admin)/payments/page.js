"use client";

import { useState, useEffect, useMemo } from "react";
import {
  fetchBookings,
  subscribeBookings,
  updateBookingPaymentStatus,
} from "@/lib/bookingsService";

export default function PaymentsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all"); // 'all' | 'paid' | 'pending'
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectPayment, setInspectPayment] = useState(null);
  const [actionAlert, setActionAlert] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  // Subscribe to real-time bookings
  useEffect(() => {
    setLoading(true);
    setError("");
    const unsubscribe = subscribeBookings(
      (data) => {
        setBookings(data);
        setLoading(false);
      },
      (err) => {
        console.error("Real-time payments error:", err);
        setError("Failed to fetch payments data from Firestore.");
        setLoading(false);
      }
    );

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let pendingRevenue = 0;
    let paidCount = 0;
    let pendingCount = 0;

    bookings.forEach((b) => {
      const price = Number(b.totalPrice || 0);
      const isPaid = (b.paymentStatus || "").toLowerCase() === "paid";
      if (isPaid) {
        totalRevenue += price;
        paidCount++;
      } else {
        pendingRevenue += price;
        pendingCount++;
      }
    });

    return {
      totalRevenue,
      pendingRevenue,
      paidCount,
      pendingCount,
      totalCount: bookings.length,
    };
  }, [bookings]);

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return bookings.filter((b) => {
      const p = (b.paymentStatus || "").toLowerCase();
      if (paymentFilter === "paid" && p !== "paid") return false;
      if (paymentFilter === "pending" && p === "paid") return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const bId = (b.id || "").toLowerCase();
      const cName = (b.customerName || "").toLowerCase();
      const cEmail = (b.customerEmail || "").toLowerCase();
      const carName = (b.carName || "").toLowerCase();
      const pMethod = (b.paymentMethod || "").toLowerCase();

      return (
        bId.includes(q) ||
        cName.includes(q) ||
        cEmail.includes(q) ||
        carName.includes(q) ||
        pMethod.includes(q)
      );
    });
  }, [bookings, paymentFilter, searchQuery]);

  const handleTogglePaymentStatus = async (booking, newStatus) => {
    setProcessingId(booking.id);
    setActionAlert(null);
    try {
      await updateBookingPaymentStatus(booking.id, newStatus);
      setActionAlert({
        type: "success",
        text: `Booking #${booking.id.slice(0, 8)} payment status marked as "${newStatus}".`,
      });
      if (inspectPayment?.id === booking.id) {
        setInspectPayment((prev) => ({ ...prev, paymentStatus: newStatus }));
      }
    } catch (err) {
      console.error("Payment status update error:", err);
      setActionAlert({
        type: "error",
        text: `Failed to update payment status: ${err.message}`,
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.titleRow}>
            <h1 style={styles.title}>Payment & Transactions</h1>
            <div style={styles.liveBadge}>
              <span style={styles.liveDot}></span>
              LIVE SYNC
            </div>
          </div>
          <p style={styles.subtitle}>
            Audit customer payments, security deposits, and settlement status.
          </p>
        </div>
      </div>

      {/* Alert Banner */}
      {actionAlert && (
        <div
          style={{
            ...styles.alertBanner,
            backgroundColor: actionAlert.type === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
            borderColor: actionAlert.type === "success" ? "#10B981" : "#EF4444",
            color: actionAlert.type === "success" ? "#34D399" : "#F87171",
          }}
        >
          <span>{actionAlert.text}</span>
          <button onClick={() => setActionAlert(null)} style={styles.alertCloseBtn}>
            ✕
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <div style={styles.kpiIconWrapper("#10B981")}>💰</div>
          <div>
            <div style={styles.kpiLabel}>COLLECTED REVENUE</div>
            <div style={styles.kpiValue}>
              PKR {loading ? "..." : metrics.totalRevenue.toLocaleString()}
            </div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiIconWrapper("#F59E0B")}>⏳</div>
          <div>
            <div style={styles.kpiLabel}>PENDING / UNPAID</div>
            <div style={styles.kpiValue}>
              PKR {loading ? "..." : metrics.pendingRevenue.toLocaleString()}
            </div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiIconWrapper("#00B4D8")}>💳</div>
          <div>
            <div style={styles.kpiLabel}>PAID TRANSACTIONS</div>
            <div style={styles.kpiValue}>{loading ? "..." : metrics.paidCount}</div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiIconWrapper("#EF4444")}>⚠️</div>
          <div>
            <div style={styles.kpiLabel}>PENDING TRANSACTIONS</div>
            <div style={styles.kpiValue}>{loading ? "..." : metrics.pendingCount}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div style={styles.controlsCard}>
        <div style={styles.tabContainer}>
          <button
            onClick={() => setPaymentFilter("all")}
            style={paymentFilter === "all" ? styles.tabActive : styles.tabInactive}
          >
            All Transactions ({metrics.totalCount})
          </button>
          <button
            onClick={() => setPaymentFilter("paid")}
            style={paymentFilter === "paid" ? styles.tabActive : styles.tabInactive}
          >
            Paid ({metrics.paidCount})
          </button>
          <button
            onClick={() => setPaymentFilter("pending")}
            style={paymentFilter === "pending" ? styles.tabActive : styles.tabInactive}
          >
            Pending / Unpaid ({metrics.pendingCount})
          </button>
        </div>

        <div style={styles.searchBox}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search by customer, car, ID or payment method..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableCard}>
        {loading && bookings.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.spinner}></div>
            <p style={{ marginTop: "16px", color: "#94A3B8" }}>Loading payment records...</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: "40px" }}>💳</div>
            <h3 style={{ color: "#F8FAFC", marginTop: "12px", fontSize: "18px" }}>No Transactions Found</h3>
          </div>
        ) : (
          <div style={styles.tableResponsive}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={styles.th}>BOOKING</th>
                  <th style={styles.th}>CUSTOMER</th>
                  <th style={styles.th}>VEHICLE</th>
                  <th style={styles.th}>PAYMENT METHOD</th>
                  <th style={styles.th}>AMOUNT</th>
                  <th style={styles.th}>STATUS</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((item) => {
                  const isPaid = (item.paymentStatus || "").toLowerCase() === "paid";
                  return (
                    <tr key={item.id} style={styles.tableRow}>
                      <td style={styles.td}>
                        <div style={styles.bookingId}>#{item.id.slice(0, 8)}...</div>
                        <div style={styles.subText}>{item.pickupDate || "Recent"}</div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.customerName}>{item.customerName}</div>
                        <div style={styles.subText}>{item.customerPhone || item.customerEmail}</div>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.carTitle}>{item.carName}</div>
                        <div style={styles.carSub}>{item.carPlate || item.carBrand}</div>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.methodBadge}>
                          {item.paymentMethod || "Cash on Pickup"}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <div style={styles.priceText}>
                          PKR {Number(item.totalPrice || 0).toLocaleString()}
                        </div>
                        <div style={styles.subText}>
                          Deposit: PKR {Number(item.securityDeposit || 15000).toLocaleString()}
                        </div>
                      </td>
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            backgroundColor: isPaid ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                            color: isPaid ? "#10B981" : "#F59E0B",
                            border: isPaid ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(245, 158, 11, 0.4)",
                          }}
                        >
                          {isPaid ? "Paid" : "Pending"}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <div style={styles.actionBtnGroup}>
                          <button
                            onClick={() =>
                              handleTogglePaymentStatus(item, isPaid ? "Pending" : "Paid")
                            }
                            disabled={processingId === item.id}
                            style={{
                              ...styles.actionToggleBtn,
                              backgroundColor: isPaid ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                              color: isPaid ? "#F59E0B" : "#10B981",
                              borderColor: isPaid ? "rgba(245, 158, 11, 0.4)" : "rgba(16, 185, 129, 0.4)",
                            }}
                          >
                            {processingId === item.id
                              ? "Updating..."
                              : isPaid
                              ? "Mark Unpaid"
                              : "✓ Mark Paid"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "32px",
    maxWidth: "1400px",
    margin: "0 auto",
    color: "#E2E8F0",
    fontFamily: "'Inter', sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "28px",
    flexWrap: "wrap",
    gap: "16px",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    flexWrap: "wrap",
  },
  title: {
    fontSize: "28px",
    fontWeight: "800",
    color: "#F8FAFC",
    letterSpacing: "-0.02em",
    margin: 0,
  },
  subtitle: {
    fontSize: "14px",
    color: "#94A3B8",
    marginTop: "6px",
    marginBottom: 0,
  },
  liveBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    fontWeight: "700",
    color: "#10B981",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    padding: "3px 10px",
    borderRadius: "12px",
    letterSpacing: "0.05em",
  },
  liveDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    backgroundColor: "#10B981",
    boxShadow: "0 0 8px #10B981",
  },
  alertBanner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 18px",
    borderRadius: "8px",
    borderWidth: "1px",
    borderStyle: "solid",
    marginBottom: "24px",
    fontSize: "14px",
    fontWeight: "500",
  },
  alertCloseBtn: {
    background: "transparent",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    fontSize: "16px",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
    marginBottom: "24px",
  },
  kpiCard: {
    backgroundColor: "#1E293B",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "18px 20px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  kpiIconWrapper: (color) => ({
    width: "44px",
    height: "44px",
    borderRadius: "10px",
    backgroundColor: `${color}1A`,
    border: `1px solid ${color}40`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
  }),
  kpiLabel: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: "0.05em",
  },
  kpiValue: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#F8FAFC",
    marginTop: "2px",
  },
  controlsCard: {
    backgroundColor: "#1E293B",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "18px",
    marginBottom: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  tabContainer: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    borderBottom: "1px solid #334155",
    paddingBottom: "12px",
  },
  tabActive: {
    backgroundColor: "#00B4D8",
    color: "#0F172A",
    border: "none",
    padding: "8px 16px",
    borderRadius: "6px",
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer",
  },
  tabInactive: {
    backgroundColor: "transparent",
    color: "#94A3B8",
    border: "1px solid #334155",
    padding: "8px 16px",
    borderRadius: "6px",
    fontWeight: "500",
    fontSize: "13px",
    cursor: "pointer",
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "#0F172A",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "8px 14px",
  },
  searchIcon: {
    fontSize: "14px",
    marginRight: "10px",
    color: "#64748B",
  },
  searchInput: {
    backgroundColor: "transparent",
    border: "none",
    color: "#F8FAFC",
    outline: "none",
    fontSize: "13px",
    width: "100%",
  },
  tableCard: {
    backgroundColor: "#1E293B",
    border: "1px solid #334155",
    borderRadius: "12px",
    overflow: "hidden",
  },
  tableResponsive: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
  },
  tableHeaderRow: {
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderBottom: "1px solid #334155",
  },
  th: {
    padding: "14px 18px",
    fontSize: "11px",
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: "0.05em",
  },
  tableRow: {
    borderBottom: "1px solid #293548",
  },
  td: {
    padding: "16px 18px",
    fontSize: "13px",
    verticalAlign: "middle",
  },
  bookingId: {
    fontFamily: "monospace",
    fontWeight: "700",
    color: "#00B4D8",
  },
  subText: {
    fontSize: "11px",
    color: "#94A3B8",
    marginTop: "2px",
  },
  customerName: {
    fontWeight: "600",
    color: "#F8FAFC",
  },
  carTitle: {
    fontWeight: "600",
    color: "#F8FAFC",
  },
  carSub: {
    fontSize: "11px",
    color: "#94A3B8",
  },
  methodBadge: {
    backgroundColor: "rgba(148, 163, 184, 0.12)",
    color: "#E2E8F0",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "12px",
  },
  priceText: {
    fontWeight: "700",
    color: "#00B4D8",
    fontSize: "14px",
  },
  badge: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "capitalize",
  },
  actionBtnGroup: {
    display: "flex",
    justifyContent: "flex-end",
  },
  actionToggleBtn: {
    borderWidth: "1px",
    borderStyle: "solid",
    padding: "7px 14px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  emptyState: {
    padding: "60px 20px",
    textAlign: "center",
  },
  spinner: {
    width: "36px",
    height: "36px",
    margin: "0 auto",
    border: "3px solid #334155",
    borderTopColor: "#00B4D8",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
};
