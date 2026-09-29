"use client";

import { useState, useEffect, useMemo } from "react";
import {
  fetchBookings,
  subscribeBookings,
  updateBookingStatus,
  updateBookingPaymentStatus,
} from "@/lib/bookingsService";

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Inspect Modal
  const [inspectBooking, setInspectBooking] = useState(null);
  const [actionAlert, setActionAlert] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  // Status Change Confirmation Modal
  const [statusActionPrompt, setStatusActionPrompt] = useState(null); // { booking, newStatus, field: 'status' | 'paymentStatus' }

  // Load bookings manually
  const loadBookings = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchBookings();
      setBookings(data);
    } catch (err) {
      console.error("Error loading bookings from Firestore:", err);
      setError(err.message || "Failed to load bookings from Firestore.");
    } finally {
      setLoading(false);
    }
  };

  // Real-time Firestore subscription
  useEffect(() => {
    setLoading(true);
    setError("");
    const unsubscribe = subscribeBookings(
      (data) => {
        setBookings(data);
        setLoading(false);
      },
      (err) => {
        console.error("Error subscribing to bookings in real-time:", err);
        setError(err.message || "Failed to load bookings from Firestore in real-time.");
        setLoading(false);
      }
    );

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

  // Compute status counts
  const counts = useMemo(() => {
    let confirmed = 0;
    let inProgress = 0;
    let completed = 0;
    let cancelled = 0;
    let pending = 0;

    bookings.forEach((b) => {
      const s = (b.status || "").toLowerCase();
      if (s === "confirmed") confirmed++;
      else if (s === "in progress" || s === "inprogress" || s === "active") inProgress++;
      else if (s === "completed") completed++;
      else if (s === "cancelled" || s === "rejected") cancelled++;
      else pending++;
    });

    return {
      all: bookings.length,
      confirmed,
      inProgress,
      completed,
      cancelled,
      pending,
    };
  }, [bookings]);

  // Filtered Bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const s = (b.status || "").toLowerCase();
      let matchesStatus = true;
      if (statusFilter === "confirmed") matchesStatus = s === "confirmed";
      else if (statusFilter === "in progress") matchesStatus = s === "in progress" || s === "inprogress" || s === "active";
      else if (statusFilter === "completed") matchesStatus = s === "completed";
      else if (statusFilter === "cancelled") matchesStatus = s === "cancelled" || s === "rejected";
      else if (statusFilter === "pending") matchesStatus = s === "pending" || (!["confirmed", "completed", "cancelled", "rejected", "in progress", "inprogress", "active"].includes(s));

      if (!matchesStatus) return false;

      // Payment filter
      const p = (b.paymentStatus || "").toLowerCase();
      let matchesPayment = true;
      if (paymentFilter === "paid") matchesPayment = p === "paid";
      else if (paymentFilter === "pending") matchesPayment = p === "pending" || p === "unpaid" || !p;

      if (!matchesPayment) return false;

      // Search Query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const bId = (b.id || "").toLowerCase();
      const cName = (b.customerName || "").toLowerCase();
      const cEmail = (b.customerEmail || "").toLowerCase();
      const cPhone = (b.customerPhone || "").toLowerCase();
      const carName = (b.carName || "").toLowerCase();
      const carBrand = (b.carBrand || "").toLowerCase();
      const plate = (b.carPlate || "").toLowerCase();

      return (
        bId.includes(q) ||
        cName.includes(q) ||
        cEmail.includes(q) ||
        cPhone.includes(q) ||
        carName.includes(q) ||
        carBrand.includes(q) ||
        plate.includes(q)
      );
    });
  }, [bookings, statusFilter, paymentFilter, searchQuery]);

  // Status update execution
  const executeStatusChange = async () => {
    if (!statusActionPrompt?.booking?.id || processingId) return;
    const { booking, newStatus, field } = statusActionPrompt;
    setProcessingId(booking.id);
    setActionAlert(null);

    try {
      if (field === "paymentStatus") {
        await updateBookingPaymentStatus(booking.id, newStatus);
        setActionAlert({
          type: "success",
          text: `Payment status for booking #${booking.id.slice(0, 8)} updated to "${newStatus}".`,
        });
        if (inspectBooking?.id === booking.id) {
          setInspectBooking((prev) => ({ ...prev, paymentStatus: newStatus }));
        }
      } else {
        await updateBookingStatus(booking.id, newStatus);
        setActionAlert({
          type: "success",
          text: `Reservation status for booking #${booking.id.slice(0, 8)} updated to "${newStatus}".`,
        });
        if (inspectBooking?.id === booking.id) {
          setInspectBooking((prev) => ({ ...prev, status: newStatus }));
        }
      }
      setStatusActionPrompt(null);
    } catch (err) {
      console.error("Failed to update status:", err);
      setActionAlert({
        type: "error",
        text: `Error updating status: ${err.message || "Failed to update Firestore."}`,
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Helper for Status Badge styling
  const getStatusBadge = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "confirmed") {
      return { bg: "rgba(0, 180, 216, 0.15)", color: "#00B4D8", border: "1px solid rgba(0, 180, 216, 0.4)", label: "Confirmed" };
    }
    if (s === "in progress" || s === "inprogress" || s === "active") {
      return { bg: "rgba(79, 70, 229, 0.15)", color: "#818CF8", border: "1px solid rgba(79, 70, 229, 0.4)", label: "In Progress" };
    }
    if (s === "completed") {
      return { bg: "rgba(16, 185, 129, 0.15)", color: "#10B981", border: "1px solid rgba(16, 185, 129, 0.4)", label: "Completed" };
    }
    if (s === "cancelled" || s === "rejected") {
      return { bg: "rgba(239, 68, 68, 0.15)", color: "#EF4444", border: "1px solid rgba(239, 68, 68, 0.4)", label: "Cancelled" };
    }
    return { bg: "rgba(245, 158, 11, 0.15)", color: "#F59E0B", border: "1px solid rgba(245, 158, 11, 0.4)", label: status || "Pending" };
  };

  // Helper for Payment Badge styling
  const getPaymentBadge = (paymentStatus) => {
    const p = (paymentStatus || "").toLowerCase();
    if (p === "paid") {
      return { bg: "rgba(16, 185, 129, 0.15)", color: "#10B981", border: "1px solid rgba(16, 185, 129, 0.4)", label: "Paid" };
    }
    return { bg: "rgba(245, 158, 11, 0.15)", color: "#F59E0B", border: "1px solid rgba(245, 158, 11, 0.4)", label: paymentStatus || "Pending" };
  };

  return (
    <div style={styles.container}>
      {/* 1. Header with live status and refresh button */}
      <div style={styles.header}>
        <div>
          <div style={styles.titleRow}>
            <h1 style={styles.title}>Bookings & Reservations</h1>
            <div style={styles.liveBadge}>
              <span style={styles.liveDot}></span>
              LIVE SYNC
            </div>
          </div>
          <p style={styles.subtitle}>
            Monitor, inspect, and update customer vehicle reservations in real-time across Pakistan.
          </p>
        </div>
        <button
          onClick={loadBookings}
          disabled={loading}
          style={styles.refreshButton}
          title="Refresh Bookings list"
        >
          {loading ? "Refreshing..." : "🔄 Refresh"}
        </button>
      </div>

      {/* 2. Alert Notification Banner */}
      {actionAlert && (
        <div
          style={{
            ...styles.alertBanner,
            backgroundColor: actionAlert.type === "success" ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
            borderColor: actionAlert.type === "success" ? "#10B981" : "#EF4444",
            color: actionAlert.type === "success" ? "#34D399" : "#F87171",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span>{actionAlert.type === "success" ? "✓" : "⚠️"}</span>
            <span>{actionAlert.text}</span>
          </div>
          <button
            onClick={() => setActionAlert(null)}
            style={styles.alertCloseBtn}
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. KPI Metrics Overview */}
      <div style={styles.kpiGrid}>
        <div style={styles.kpiCard}>
          <div style={styles.kpiIconWrapper("#00B4D8")}>📅</div>
          <div>
            <div style={styles.kpiLabel}>TOTAL BOOKINGS</div>
            <div style={styles.kpiValue}>{loading ? "..." : counts.all}</div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiIconWrapper("#38BDF8")}>✅</div>
          <div>
            <div style={styles.kpiLabel}>CONFIRMED</div>
            <div style={styles.kpiValue}>{loading ? "..." : counts.confirmed}</div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiIconWrapper("#818CF8")}>🚗</div>
          <div>
            <div style={styles.kpiLabel}>IN PROGRESS</div>
            <div style={styles.kpiValue}>{loading ? "..." : counts.inProgress}</div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiIconWrapper("#10B981")}>🏁</div>
          <div>
            <div style={styles.kpiLabel}>COMPLETED</div>
            <div style={styles.kpiValue}>{loading ? "..." : counts.completed}</div>
          </div>
        </div>

        <div style={styles.kpiCard}>
          <div style={styles.kpiIconWrapper("#EF4444")}>❌</div>
          <div>
            <div style={styles.kpiLabel}>CANCELLED</div>
            <div style={styles.kpiValue}>{loading ? "..." : counts.cancelled}</div>
          </div>
        </div>
      </div>

      {/* 4. Controls: Filter Tabs & Search Bar */}
      <div style={styles.controlsCard}>
        {/* Status Filter Tabs */}
        <div style={styles.tabContainer}>
          <button
            onClick={() => setStatusFilter("all")}
            style={statusFilter === "all" ? styles.tabActive : styles.tabInactive}
          >
            All Bookings ({counts.all})
          </button>
          <button
            onClick={() => setStatusFilter("confirmed")}
            style={statusFilter === "confirmed" ? styles.tabActive : styles.tabInactive}
          >
            Confirmed ({counts.confirmed})
          </button>
          <button
            onClick={() => setStatusFilter("in progress")}
            style={statusFilter === "in progress" ? styles.tabActive : styles.tabInactive}
          >
            In Progress ({counts.inProgress})
          </button>
          <button
            onClick={() => setStatusFilter("completed")}
            style={statusFilter === "completed" ? styles.tabActive : styles.tabInactive}
          >
            Completed ({counts.completed})
          </button>
          <button
            onClick={() => setStatusFilter("pending")}
            style={statusFilter === "pending" ? styles.tabActive : styles.tabInactive}
          >
            Pending ({counts.pending})
          </button>
          <button
            onClick={() => setStatusFilter("cancelled")}
            style={statusFilter === "cancelled" ? styles.tabActive : styles.tabInactive}
          >
            Cancelled ({counts.cancelled})
          </button>
        </div>

        {/* Search & Secondary Filter Row */}
        <div style={styles.filterRow}>
          <div style={styles.searchBox}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search by ID, customer name, email, car model, plate number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={styles.clearSearchBtn}
              >
                ✕
              </button>
            )}
          </div>

          <div style={styles.secondaryFilterGroup}>
            <label style={styles.filterLabel}>Payment:</label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              style={styles.selectFilter}
            >
              <option value="all">All Payments</option>
              <option value="paid">Paid Only</option>
              <option value="pending">Pending / Unpaid</option>
            </select>
          </div>
        </div>
      </div>

      {/* 5. Bookings Table / List */}
      <div style={styles.tableCard}>
        {loading && bookings.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.spinner}></div>
            <p style={{ marginTop: "16px", color: "#94A3B8" }}>Loading bookings from Firestore...</p>
          </div>
        ) : error ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: "36px" }}>⚠️</div>
            <p style={{ color: "#EF4444", marginTop: "12px", fontWeight: "600" }}>{error}</p>
            <button onClick={loadBookings} style={styles.retryButton}>
              Retry Load
            </button>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={{ fontSize: "40px" }}>📭</div>
            <h3 style={{ color: "#F8FAFC", marginTop: "12px", fontSize: "18px" }}>No Bookings Found</h3>
            <p style={{ color: "#94A3B8", marginTop: "4px", fontSize: "14px" }}>
              {searchQuery
                ? `No reservations match "${searchQuery}".`
                : "No reservations found for the selected status filter."}
            </p>
          </div>
        ) : (
          <div style={styles.tableResponsive}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeaderRow}>
                  <th style={styles.th}>BOOKING ID</th>
                  <th style={styles.th}>VEHICLE</th>
                  <th style={styles.th}>CUSTOMER</th>
                  <th style={styles.th}>SCHEDULE</th>
                  <th style={styles.th}>AMOUNT</th>
                  <th style={styles.th}>PAYMENT</th>
                  <th style={styles.th}>STATUS</th>
                  <th style={{ ...styles.th, textAlign: "right" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((booking) => {
                  const statusBadge = getStatusBadge(booking.status);
                  const paymentBadge = getPaymentBadge(booking.paymentStatus);

                  return (
                    <tr key={booking.id} style={styles.tableRow}>
                      {/* ID & Date */}
                      <td style={styles.td}>
                        <div style={styles.bookingId}>
                          #{booking.id.slice(0, 8)}...
                        </div>
                        <div style={styles.subText}>
                          {booking.rentalModeOption || "Self-Drive"}
                        </div>
                      </td>

                      {/* Vehicle Details */}
                      <td style={styles.td}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {booking.carImage ? (
                            <img
                              src={booking.carImage}
                              alt={booking.carName}
                              style={styles.carThumb}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div style={styles.carThumbPlaceholder}>🚗</div>
                          )}
                          <div>
                            <div style={styles.carTitle}>{booking.carName}</div>
                            <div style={styles.carSub}>
                              {booking.carBrand} • {booking.carPlate || "Unregistered Plate"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Customer Details */}
                      <td style={styles.td}>
                        <div style={styles.customerName}>{booking.customerName}</div>
                        <div style={styles.subText}>{booking.customerPhone || booking.customerEmail}</div>
                      </td>

                      {/* Dates & Duration */}
                      <td style={styles.td}>
                        <div style={styles.dateRange}>
                          {booking.pickupDate || "N/A"} → {booking.returnDate || "N/A"}
                        </div>
                        <div style={styles.subText}>
                          {booking.days || 1} {booking.days === 1 ? "day" : "days"} duration
                        </div>
                      </td>

                      {/* Price & Deposit */}
                      <td style={styles.td}>
                        <div style={styles.priceText}>
                          PKR {Number(booking.totalPrice || 0).toLocaleString()}
                        </div>
                        <div style={styles.depositText}>
                          Deposit: PKR {Number(booking.securityDeposit || 15000).toLocaleString()}
                        </div>
                      </td>

                      {/* Payment Status Badge */}
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            backgroundColor: paymentBadge.bg,
                            color: paymentBadge.color,
                            border: paymentBadge.border,
                          }}
                        >
                          {paymentBadge.label}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td style={styles.td}>
                        <span
                          style={{
                            ...styles.badge,
                            backgroundColor: statusBadge.bg,
                            color: statusBadge.color,
                            border: statusBadge.border,
                          }}
                        >
                          {statusBadge.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ ...styles.td, textAlign: "right" }}>
                        <div style={styles.actionBtnGroup}>
                          <button
                            onClick={() => setInspectBooking(booking)}
                            style={styles.inspectBtn}
                            title="Inspect full reservation details"
                          >
                            👁️ View Details
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

      {/* 6. Comprehensive Booking Inspection Modal */}
      {inspectBooking && (
        <div style={styles.modalOverlay} onClick={() => setInspectBooking(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={styles.modalHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "24px" }}>📋</span>
                <div>
                  <h2 style={styles.modalTitle}>Reservation Details</h2>
                  <span style={styles.modalSub}>
                    ID: #{inspectBooking.id} • Created:{" "}
                    {inspectBooking.createdAt?.toDate?.()
                      ? inspectBooking.createdAt.toDate().toLocaleDateString("en-PK", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "Recent"}
                  </span>
                </div>
              </div>
              <button onClick={() => setInspectBooking(null)} style={styles.modalCloseBtn}>
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={styles.modalBody}>
              {/* Quick Status Bar */}
              <div style={styles.modalStatusBar}>
                <div>
                  <span style={styles.modalStatusLabel}>Booking Status: </span>
                  <span
                    style={{
                      ...styles.badge,
                      ...getStatusBadge(inspectBooking.status),
                      marginLeft: "6px",
                    }}
                  >
                    {inspectBooking.status}
                  </span>
                </div>

                <div>
                  <span style={styles.modalStatusLabel}>Payment Status: </span>
                  <span
                    style={{
                      ...styles.badge,
                      ...getPaymentBadge(inspectBooking.paymentStatus),
                      marginLeft: "6px",
                    }}
                  >
                    {inspectBooking.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Grid: Vehicle & Customer */}
              <div style={styles.modalGrid}>
                {/* Vehicle Card */}
                <div style={styles.modalSectionCard}>
                  <div style={styles.sectionHeader}>🚗 Vehicle Details</div>
                  {inspectBooking.carImage ? (
                    <img
                      src={inspectBooking.carImage}
                      alt={inspectBooking.carName}
                      style={styles.modalCarImg}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div style={styles.modalImgPlaceholder}>No Vehicle Image</div>
                  )}

                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Vehicle Name:</span>
                    <span style={styles.infoValue}>{inspectBooking.carName}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Brand / Model:</span>
                    <span style={styles.infoValue}>{inspectBooking.carBrand}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Registration Plate:</span>
                    <span style={styles.infoValueHighlight}>{inspectBooking.carPlate || "Not Provided"}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Rental Mode:</span>
                    <span style={styles.infoValue}>{inspectBooking.rentalModeOption || "Self-Drive"}</span>
                  </div>
                </div>

                {/* Customer Card */}
                <div style={styles.modalSectionCard}>
                  <div style={styles.sectionHeader}>👤 Customer Profile</div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Full Name:</span>
                    <span style={styles.infoValue}>{inspectBooking.customerName}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Email Address:</span>
                    <span style={styles.infoValue}>{inspectBooking.customerEmail || "Not Provided"}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Phone Number:</span>
                    <span style={styles.infoValue}>{inspectBooking.customerPhone || "Not Provided"}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Customer UID:</span>
                    <span style={styles.infoValueSmall}>{inspectBooking.customerId || "N/A"}</span>
                  </div>

                  <div style={{ ...styles.sectionHeader, marginTop: "24px" }}>🏢 Host / Fleet Owner</div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Owner Name:</span>
                    <span style={styles.infoValue}>{inspectBooking.ownerName || "Vehicle Host"}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Owner UID:</span>
                    <span style={styles.infoValueSmall}>{inspectBooking.ownerId || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Schedule & Financial Breakdown */}
              <div style={styles.modalGrid}>
                {/* Schedule Card */}
                <div style={styles.modalSectionCard}>
                  <div style={styles.sectionHeader}>⏱️ Rental Schedule</div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Pickup Date:</span>
                    <span style={styles.infoValue}>{inspectBooking.pickupDate || "N/A"}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Return Date:</span>
                    <span style={styles.infoValue}>{inspectBooking.returnDate || "N/A"}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Total Rental Duration:</span>
                    <span style={styles.infoValueHighlight}>
                      {inspectBooking.days || 1} {inspectBooking.days === 1 ? "Day" : "Days"}
                    </span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Pickup Inspection:</span>
                    <span style={styles.infoValue}>{inspectBooking.inspectionStatus || "Pending"}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Return Inspection:</span>
                    <span style={styles.infoValue}>{inspectBooking.returnInspectionStatus || "None"}</span>
                  </div>
                </div>

                {/* Financial Summary */}
                <div style={styles.modalSectionCard}>
                  <div style={styles.sectionHeader}>💳 Financial Breakdown</div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Payment Method:</span>
                    <span style={styles.infoValue}>{inspectBooking.paymentMethod || "Cash on Pickup"}</span>
                  </div>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Refundable Security Deposit:</span>
                    <span style={styles.infoValue}>
                      PKR {Number(inspectBooking.securityDeposit || 15000).toLocaleString()}
                    </span>
                  </div>
                  <div style={styles.totalPriceRow}>
                    <span style={{ fontSize: "16px", color: "#F8FAFC", fontWeight: "600" }}>Total Rental Amount:</span>
                    <span style={{ fontSize: "20px", color: "#00B4D8", fontWeight: "700" }}>
                      PKR {Number(inspectBooking.totalPrice || 0).toLocaleString()}
                    </span>
                  </div>

                  {/* Payment Proof Preview if present */}
                  {inspectBooking.paymentProofUrl && (
                    <div style={{ marginTop: "16px" }}>
                      <span style={styles.infoLabel}>Payment Screenshot / Proof:</span>
                      <a
                        href={inspectBooking.paymentProofUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: "block", marginTop: "8px" }}
                      >
                        <img
                          src={inspectBooking.paymentProofUrl}
                          alt="Payment Receipt"
                          style={styles.paymentProofImg}
                        />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Action Buttons */}
              <div style={styles.modalActionsCard}>
                <div style={styles.sectionHeader}>⚡ Admin Quick Actions</div>
                <div style={styles.modalActionButtonsRow}>
                  {/* Status Options */}
                  <button
                    onClick={() =>
                      setStatusActionPrompt({
                        booking: inspectBooking,
                        newStatus: "Confirmed",
                        field: "status",
                      })
                    }
                    disabled={inspectBooking.status === "Confirmed"}
                    style={styles.actionBtnConfirm}
                  >
                    ✓ Mark Confirmed
                  </button>

                  <button
                    onClick={() =>
                      setStatusActionPrompt({
                        booking: inspectBooking,
                        newStatus: "In Progress",
                        field: "status",
                      })
                    }
                    disabled={inspectBooking.status === "In Progress"}
                    style={styles.actionBtnInProgress}
                  >
                    🚗 Mark In Progress
                  </button>

                  <button
                    onClick={() =>
                      setStatusActionPrompt({
                        booking: inspectBooking,
                        newStatus: "Completed",
                        field: "status",
                      })
                    }
                    disabled={inspectBooking.status === "Completed"}
                    style={styles.actionBtnComplete}
                  >
                    🏁 Mark Completed
                  </button>

                  <button
                    onClick={() =>
                      setStatusActionPrompt({
                        booking: inspectBooking,
                        newStatus: "Cancelled",
                        field: "status",
                      })
                    }
                    disabled={inspectBooking.status === "Cancelled"}
                    style={styles.actionBtnCancel}
                  >
                    ❌ Cancel Booking
                  </button>

                  {/* Payment Status Option */}
                  {inspectBooking.paymentStatus !== "Paid" ? (
                    <button
                      onClick={() =>
                        setStatusActionPrompt({
                          booking: inspectBooking,
                          newStatus: "Paid",
                          field: "paymentStatus",
                        })
                      }
                      style={styles.actionBtnPaid}
                    >
                      💰 Mark Payment as Paid
                    </button>
                  ) : (
                    <button
                      onClick={() =>
                        setStatusActionPrompt({
                          booking: inspectBooking,
                          newStatus: "Pending",
                          field: "paymentStatus",
                        })
                      }
                      style={styles.actionBtnPendingPayment}
                    >
                      ↩ Revert to Pending Payment
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. Action Confirmation Modal */}
      {statusActionPrompt && (
        <div style={styles.modalOverlay} onClick={() => !processingId && setStatusActionPrompt(null)}>
          <div style={styles.confirmModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "36px", textAlign: "center" }}>⚠️</div>
            <h3 style={styles.confirmTitle}>
              Confirm {statusActionPrompt.field === "paymentStatus" ? "Payment" : "Reservation"} Update
            </h3>
            <p style={styles.confirmText}>
              Are you sure you want to change the{" "}
              <strong>{statusActionPrompt.field === "paymentStatus" ? "payment status" : "reservation status"}</strong>{" "}
              for booking <strong>#{statusActionPrompt.booking.id.slice(0, 8)}</strong> to{" "}
              <span style={{ color: "#00B4D8", fontWeight: "700" }}>"{statusActionPrompt.newStatus}"</span>?
            </p>

            <div style={styles.confirmButtonsRow}>
              <button
                onClick={() => setStatusActionPrompt(null)}
                disabled={Boolean(processingId)}
                style={styles.btnSecondary}
              >
                Cancel
              </button>
              <button
                onClick={executeStatusChange}
                disabled={Boolean(processingId)}
                style={styles.btnPrimary}
              >
                {processingId ? "Updating Firestore..." : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sleek dark-mode styling consistent with other admin panel modules
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
  refreshButton: {
    backgroundColor: "#1E293B",
    color: "#F8FAFC",
    border: "1px solid #334155",
    padding: "10px 18px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
    transition: "all 0.2s ease",
  },

  // Alert Banner
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

  // KPI Grid
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
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
    fontSize: "24px",
    fontWeight: "800",
    color: "#F8FAFC",
    marginTop: "2px",
  },

  // Controls Card
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
  filterRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    flexWrap: "wrap",
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    backgroundColor: "#0F172A",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "8px 14px",
    flex: "1 1 350px",
    position: "relative",
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
  clearSearchBtn: {
    background: "none",
    border: "none",
    color: "#64748B",
    cursor: "pointer",
    fontSize: "14px",
    padding: "0 4px",
  },
  secondaryFilterGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  filterLabel: {
    fontSize: "13px",
    color: "#94A3B8",
    fontWeight: "500",
  },
  selectFilter: {
    backgroundColor: "#0F172A",
    color: "#F8FAFC",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "8px 14px",
    fontSize: "13px",
    outline: "none",
    cursor: "pointer",
  },

  // Table Card
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
    transition: "background 0.15s ease",
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
  carThumb: {
    width: "48px",
    height: "36px",
    objectFit: "cover",
    borderRadius: "6px",
    border: "1px solid #334155",
  },
  carThumbPlaceholder: {
    width: "48px",
    height: "36px",
    borderRadius: "6px",
    backgroundColor: "#0F172A",
    border: "1px solid #334155",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
  },
  carTitle: {
    fontWeight: "600",
    color: "#F8FAFC",
  },
  carSub: {
    fontSize: "11px",
    color: "#94A3B8",
  },
  customerName: {
    fontWeight: "600",
    color: "#F8FAFC",
  },
  dateRange: {
    fontWeight: "500",
    color: "#F8FAFC",
    whiteSpace: "nowrap",
  },
  priceText: {
    fontWeight: "700",
    color: "#00B4D8",
    fontSize: "14px",
  },
  depositText: {
    fontSize: "11px",
    color: "#94A3B8",
  },
  badge: {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "11px",
    fontWeight: "700",
    textTransform: "capitalize",
    whiteSpace: "nowrap",
  },
  actionBtnGroup: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
  },
  inspectBtn: {
    backgroundColor: "#0F172A",
    color: "#F8FAFC",
    border: "1px solid #334155",
    padding: "7px 14px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },

  // Empty & Spinner
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
  retryButton: {
    backgroundColor: "#00B4D8",
    color: "#0F172A",
    border: "none",
    padding: "8px 18px",
    borderRadius: "6px",
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer",
    marginTop: "16px",
  },

  // Modal Overlay
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: "20px",
  },
  modalContent: {
    backgroundColor: "#1E293B",
    border: "1px solid #334155",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "880px",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
  },
  modalHeader: {
    padding: "20px 24px",
    borderBottom: "1px solid #334155",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: "20px",
    fontWeight: "700",
    color: "#F8FAFC",
    margin: 0,
  },
  modalSub: {
    fontSize: "12px",
    color: "#94A3B8",
  },
  modalCloseBtn: {
    background: "transparent",
    border: "none",
    color: "#94A3B8",
    fontSize: "20px",
    cursor: "pointer",
  },
  modalBody: {
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  modalStatusBar: {
    display: "flex",
    justifyContent: "space-between",
    backgroundColor: "#0F172A",
    padding: "12px 20px",
    borderRadius: "8px",
    border: "1px solid #334155",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
  },
  modalStatusLabel: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#94A3B8",
  },
  modalGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
    gap: "16px",
  },
  modalSectionCard: {
    backgroundColor: "#0F172A",
    border: "1px solid #334155",
    borderRadius: "10px",
    padding: "18px",
  },
  sectionHeader: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#00B4D8",
    marginBottom: "14px",
  },
  modalCarImg: {
    width: "100%",
    height: "160px",
    objectFit: "cover",
    borderRadius: "8px",
    marginBottom: "14px",
    border: "1px solid #334155",
  },
  modalImgPlaceholder: {
    width: "100%",
    height: "120px",
    backgroundColor: "#1E293B",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#64748B",
    fontSize: "14px",
    marginBottom: "14px",
  },
  paymentProofImg: {
    width: "100%",
    maxHeight: "140px",
    objectFit: "cover",
    borderRadius: "8px",
    border: "1px solid #334155",
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "7px 0",
    borderBottom: "1px solid rgba(51, 65, 85, 0.4)",
    fontSize: "13px",
  },
  infoLabel: {
    color: "#94A3B8",
  },
  infoValue: {
    color: "#F8FAFC",
    fontWeight: "500",
  },
  infoValueHighlight: {
    color: "#00B4D8",
    fontWeight: "700",
  },
  infoValueSmall: {
    color: "#94A3B8",
    fontFamily: "monospace",
    fontSize: "11px",
  },
  totalPriceRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    marginTop: "8px",
    borderTop: "1px solid #334155",
  },
  modalActionsCard: {
    backgroundColor: "#0F172A",
    border: "1px solid #334155",
    borderRadius: "10px",
    padding: "18px",
  },
  modalActionButtonsRow: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },
  actionBtnConfirm: {
    backgroundColor: "rgba(0, 180, 216, 0.15)",
    color: "#00B4D8",
    border: "1px solid #00B4D8",
    padding: "8px 16px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
  },
  actionBtnInProgress: {
    backgroundColor: "rgba(129, 140, 248, 0.15)",
    color: "#818CF8",
    border: "1px solid #818CF8",
    padding: "8px 16px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
  },
  actionBtnComplete: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    color: "#10B981",
    border: "1px solid #10B981",
    padding: "8px 16px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
  },
  actionBtnCancel: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    color: "#EF4444",
    border: "1px solid #EF4444",
    padding: "8px 16px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
  },
  actionBtnPaid: {
    backgroundColor: "rgba(16, 185, 129, 0.25)",
    color: "#34D399",
    border: "1px solid #34D399",
    padding: "8px 16px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
  },
  actionBtnPendingPayment: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    color: "#F59E0B",
    border: "1px solid #F59E0B",
    padding: "8px 16px",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
  },

  // Confirmation Modal
  confirmModalContent: {
    backgroundColor: "#1E293B",
    border: "1px solid #334155",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "460px",
    padding: "28px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
  },
  confirmTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#F8FAFC",
    textAlign: "center",
    marginTop: "12px",
    marginBottom: "8px",
  },
  confirmText: {
    fontSize: "14px",
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: "1.5",
    marginBottom: "24px",
  },
  confirmButtonsRow: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
  },
  btnSecondary: {
    backgroundColor: "#334155",
    color: "#F8FAFC",
    border: "none",
    padding: "10px 20px",
    borderRadius: "8px",
    fontWeight: "600",
    fontSize: "13px",
    cursor: "pointer",
  },
  btnPrimary: {
    backgroundColor: "#00B4D8",
    color: "#0F172A",
    border: "none",
    padding: "10px 24px",
    borderRadius: "8px",
    fontWeight: "700",
    fontSize: "13px",
    cursor: "pointer",
  },
};
