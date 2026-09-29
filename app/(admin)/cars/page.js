"use client";

import { useState, useEffect, useMemo } from "react";
import { fetchCars, subscribeCars, approveCarListing, rejectCarListing } from "@/lib/carsService";
import { auth } from "@/lib/firebase";

export default function CarsPage() {
  const [cars, setCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all"); // "all" | "pending" | "approved" | "rejected"
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [processingId, setProcessingId] = useState(null);
  const [actionAlert, setActionAlert] = useState(null);

  // Modals
  const [inspectCar, setInspectCar] = useState(null);
  const [activePhoto, setActivePhoto] = useState(null);
  const [rejectingCar, setRejectingCar] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [selectedIssues, setSelectedIssues] = useState([]);

  const issueOptions = [
    "Vehicle registration document is illegible or missing",
    "Car photos are blurry or do not show all exterior sides",
    "Registration number mismatch with official documents",
    "Price is unreasonable or misleading",
    "Location details are incomplete",
    "Vehicle condition does not meet safety standards",
  ];

  const loadCars = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchCars();
      setCars(data);
    } catch (err) {
      console.error("Error loading cars:", err);
      setError(err.message || "Failed to load vehicles from Firestore.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setError("");
    const unsubscribe = subscribeCars(
      (data) => {
        setCars(data);
        setLoading(false);
      },
      (err) => {
        console.error("Error subscribing to cars in real-time:", err);
        setError(err.message || "Failed to load vehicles from Firestore in real-time.");
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
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    cars.forEach((c) => {
      const st = (c.approvalStatus || "").toLowerCase();
      if (st === "pending" || st === "pending_update") pending++;
      else if (st === "approved" || c.isApproved === true) approved++;
      else if (st === "rejected") rejected++;
    });

    return { all: cars.length, pending, approved, rejected };
  }, [cars]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(["all"]);
    cars.forEach((c) => {
      if (c.category) set.add(c.category.toLowerCase());
    });
    return Array.from(set);
  }, [cars]);

  // Filtered cars
  const filteredCars = useMemo(() => {
    return cars.filter((c) => {
      const st = (c.approvalStatus || "").toLowerCase();
      let matchesStatus = true;
      if (filter === "pending") matchesStatus = st === "pending" || st === "pending_update";
      else if (filter === "approved") matchesStatus = st === "approved" || c.isApproved === true;
      else if (filter === "rejected") matchesStatus = st === "rejected";

      if (!matchesStatus) return false;

      if (categoryFilter !== "all") {
        if ((c.category || "").toLowerCase() !== categoryFilter) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const name = (c.name || "").toLowerCase();
      const brand = (c.brand || "").toLowerCase();
      const loc = (c.location || "").toLowerCase();
      const host = (c.ownerName || "").toLowerCase();
      const reg = (c.registrationNumber || "").toLowerCase();

      return name.includes(q) || brand.includes(q) || loc.includes(q) || host.includes(q) || reg.includes(q);
    });
  }, [cars, filter, categoryFilter, searchQuery]);

  // Approve Car
  const handleApprove = async (car) => {
    if (!car?.id || processingId) return;

    const adminUser = auth.currentUser;
    const adminIdentifier = adminUser?.email || adminUser?.uid || "admin";

    setProcessingId(car.id);
    setActionAlert(null);

    try {
      await approveCarListing(car.id, adminIdentifier);

      setCars((prev) =>
        prev.map((c) => {
          if (c.id === car.id) {
            return {
              ...c,
              isApproved: true,
              approvalStatus: "approved",
              rejectionReason: "",
              rejectionIssues: [],
              pendingUpdates: null,
            };
          }
          return c;
        })
      );

      setActionAlert({
        type: "success",
        text: `✓ Vehicle "${car.name}" has been approved! It is now live and visible to customers in the mobile app.`,
      });

      if (inspectCar?.id === car.id) {
        setInspectCar((prev) => ({
          ...prev,
          isApproved: true,
          approvalStatus: "approved",
          rejectionReason: "",
          pendingUpdates: null,
        }));
      }
    } catch (err) {
      console.error("Failed to approve car:", err);
      setActionAlert({
        type: "error",
        text: `Error approving vehicle: ${err.message || "Failed to update Firestore."}`,
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Open Reject Modal
  const openRejectModal = (car) => {
    setRejectingCar(car);
    setRejectReason(car.rejectionReason || "Vehicle documentation or specifications require correction.");
    setSelectedIssues(car.rejectionIssues || []);
  };

  const toggleIssue = (issue) => {
    setSelectedIssues((prev) =>
      prev.includes(issue) ? prev.filter((i) => i !== issue) : [...prev, issue]
    );
  };

  // Confirm Reject Car
  const handleConfirmReject = async () => {
    if (!rejectingCar || processingId) return;

    const adminUser = auth.currentUser;
    const adminIdentifier = adminUser?.email || adminUser?.uid || "admin";
    const targetId = rejectingCar.id;

    setProcessingId(targetId);
    setActionAlert(null);

    try {
      await rejectCarListing(targetId, adminIdentifier, rejectReason, selectedIssues);

      setCars((prev) =>
        prev.map((c) => {
          if (c.id === targetId) {
            return {
              ...c,
              isApproved: false,
              approvalStatus: "rejected",
              rejectionReason: rejectReason,
              rejectionIssues: selectedIssues,
            };
          }
          return c;
        })
      );

      setActionAlert({
        type: "success",
        text: `Vehicle "${rejectingCar.name}" marked as rejected. The host has been notified with revision notes.`,
      });

      if (inspectCar?.id === targetId) {
        setInspectCar((prev) => ({
          ...prev,
          isApproved: false,
          approvalStatus: "rejected",
          rejectionReason: rejectReason,
          rejectionIssues: selectedIssues,
        }));
      }

      setRejectingCar(null);
    } catch (err) {
      console.error("Failed to reject car:", err);
      setActionAlert({
        type: "error",
        text: `Error rejecting vehicle: ${err.message || "Failed to update Firestore."}`,
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.tagBadge}>FLEET & VEHICLE MANAGEMENT</div>
          <h2 style={styles.title}>Vehicle Approvals & Fleet</h2>
          <p style={styles.subtitle}>
            Approve host vehicle listings, review registration cards, photos, and maintain customer catalog quality.
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={styles.liveIndicator} title="Realtime Firestore synchronization active">
            <span style={styles.liveDot} />
            <span style={styles.liveText}>Live Sync</span>
          </div>
          <button onClick={loadCars} style={styles.refreshBtn} title="Force reload fleet">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Global Alert Notification Toast */}
      {actionAlert && (
        <div
          style={{
            ...styles.alertToast,
            backgroundColor:
              actionAlert.type === "success"
                ? "rgba(16, 185, 129, 0.15)"
                : "rgba(239, 68, 68, 0.15)",
            border:
              actionAlert.type === "success"
                ? "1px solid #10B981"
                : "1px solid #EF4444",
            color: actionAlert.type === "success" ? "#34D399" : "#F87171",
          }}
        >
          <span>{actionAlert.text}</span>
          <button
            onClick={() => setActionAlert(null)}
            style={styles.closeAlertBtn}
          >
            ✕
          </button>
        </div>
      )}

      {/* Pending Banner */}
      {!loading && !error && counts.pending > 0 && (
        <div style={styles.pendingAlert}>
          <div style={styles.alertIcon}>🚘</div>
          <div style={styles.alertText}>
            <strong>
              {counts.pending} {counts.pending === 1 ? "Vehicle" : "Vehicles"} Awaiting Approval:
            </strong>{" "}
            Unapproved cars remain completely hidden from customers in the mobile app until approved by an admin.
          </div>
        </div>
      )}

      {/* Filter Tabs & Search Controls */}
      {!loading && !error && (
        <div style={styles.controlsRow}>
          <div style={styles.filterBar}>
            <button
              onClick={() => setFilter("all")}
              style={{
                ...styles.filterBtn,
                ...(filter === "all" ? styles.filterBtnActive : {}),
              }}
            >
              All Fleet <span style={styles.tabCount}>{counts.all}</span>
            </button>

            <button
              onClick={() => setFilter("pending")}
              style={{
                ...styles.filterBtn,
                ...(filter === "pending" ? styles.filterBtnPendingActive : {}),
              }}
            >
              ⏳ Pending Review <span style={styles.tabCountAmber}>{counts.pending}</span>
            </button>

            <button
              onClick={() => setFilter("approved")}
              style={{
                ...styles.filterBtn,
                ...(filter === "approved" ? styles.filterBtnVerifiedActive : {}),
              }}
            >
              ✓ Live / Approved <span style={styles.tabCountGreen}>{counts.approved}</span>
            </button>

            <button
              onClick={() => setFilter("rejected")}
              style={{
                ...styles.filterBtn,
                ...(filter === "rejected" ? styles.filterBtnRejectedActive : {}),
              }}
            >
              ✕ Rejected <span style={styles.tabCountRed}>{counts.rejected}</span>
            </button>
          </div>

          <div style={styles.searchWrapper}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search by car name, brand, city, host, or reg #..."
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
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={styles.stateCard}>
          <div style={styles.spinner} />
          <p style={styles.stateTitle}>Loading Fleet Vehicles...</p>
          <span style={styles.stateSubtitle}>Connecting to Firestore: cars collection</span>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div style={styles.errorCard}>
          <div style={styles.errorIcon}>⚠️</div>
          <div style={styles.errorContent}>
            <h4 style={styles.errorTitle}>Failed to Load Vehicles</h4>
            <p style={styles.errorText}>{error}</p>
            <button onClick={loadCars} style={styles.retryButton}>
              🔄 Retry Fetch
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && cars.length === 0 && (
        <div style={styles.stateCard}>
          <div style={styles.emptyIcon}>🚘</div>
          <p style={styles.stateTitle}>No Vehicles Found</p>
          <span style={styles.stateSubtitle}>
            There are currently no car documents listed in Firestore.
          </span>
          <button onClick={loadCars} style={styles.retryButton}>
            🔄 Refresh
          </button>
        </div>
      )}

      {/* Empty Filter State */}
      {!loading && !error && cars.length > 0 && filteredCars.length === 0 && (
        <div style={styles.stateCard}>
          <div style={styles.emptyIcon}>🔍</div>
          <p style={styles.stateTitle}>No Matching Vehicles</p>
          <span style={styles.stateSubtitle}>
            No vehicles match the selected filter &quot;{filter}&quot; and search query.
          </span>
          <button
            onClick={() => {
              setFilter("all");
              setSearchQuery("");
            }}
            style={styles.retryButton}
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Cars Grid */}
      {!loading && !error && filteredCars.length > 0 && (
        <div style={styles.grid}>
          {filteredCars.map((car) => {
            const isProcessing = processingId === car.id;
            const status = (car.approvalStatus || "").toLowerCase();
            const isPending = status === "pending";
            const isPendingUpdate = status === "pending_update";
            const isApproved = status === "approved" || car.isApproved === true;
            const isRejected = status === "rejected";

            const mainImg = car.image?.trim() || "";
            const hasHttpImg = mainImg.startsWith("http");

            return (
              <div
                key={car.id}
                style={{
                  ...styles.card,
                  border: isPending || isPendingUpdate
                    ? "1px solid rgba(245, 158, 11, 0.45)"
                    : isApproved
                    ? "1px solid rgba(16, 185, 129, 0.3)"
                    : "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                {/* Car Thumbnail Header with Status Badge */}
                <div style={styles.cardMediaBox}>
                  {hasHttpImg ? (
                    <img
                      src={mainImg}
                      alt={car.name}
                      style={styles.cardImg}
                      onClick={() => setActivePhoto({ title: car.name, url: mainImg })}
                    />
                  ) : (
                    <div style={styles.carFallbackImg}>
                      <span style={{ fontSize: "32px" }}>🚘</span>
                      <small style={{ color: "#9CA3AF", fontSize: "11px" }}>
                        {mainImg ? "Asset / Local Image" : "No Photo"}
                      </small>
                    </div>
                  )}

                  {/* Top Floating Badges */}
                  <div style={styles.topBadgesRow}>
                    <span style={styles.categoryBadge}>
                      {car.category ? car.category.toUpperCase() : "SEDAN"}
                    </span>

                    {isPendingUpdate ? (
                      <span style={styles.badgePendingUpdate}>⚠️ Edit Pending Review</span>
                    ) : isPending ? (
                      <span style={styles.badgePending}>⏳ Awaiting Approval</span>
                    ) : isApproved ? (
                      <span style={styles.badgeApproved}>✓ Live in App</span>
                    ) : isRejected ? (
                      <span style={styles.badgeRejected}>✕ Rejected</span>
                    ) : (
                      <span style={styles.badgeNeutral}>{status}</span>
                    )}
                  </div>

                  {/* Bottom Price Pill */}
                  <div style={styles.pricePill}>
                    {car.price}
                  </div>
                </div>

                {/* Card Title & Specs */}
                <div style={styles.cardBody}>
                  <div style={styles.cardTitleRow}>
                    <div>
                      <h4 style={styles.carName}>{car.name}</h4>
                      <span style={styles.carBrand}>{car.brand} • {car.location}</span>
                    </div>
                  </div>

                  {/* Specs Row */}
                  <div style={styles.specsRow}>
                    <span style={styles.specChip}>👥 {car.seats}</span>
                    <span style={styles.specChip}>⚙️ {car.transmission}</span>
                    <span style={styles.specChip}>⛽ {car.fuelType}</span>
                    <span style={styles.specChip}>🚗 {car.rentalMode}</span>
                  </div>

                  {/* Host Info Box */}
                  <div style={styles.hostBox}>
                    <div style={styles.hostAvatar}>
                      {(car.ownerName || "H").charAt(0).toUpperCase()}
                    </div>
                    <div style={styles.hostMeta}>
                      <span style={styles.hostName}>{car.ownerName || "Unknown Host"}</span>
                      <span style={styles.hostContact}>
                        {car.ownerPhone || car.ownerEmail || "No contact"}
                      </span>
                    </div>
                    {car.registrationNumber && (
                      <div style={styles.regBadge}>
                        Reg: {car.registrationNumber}
                      </div>
                    )}
                  </div>

                  {/* Rejection Notice if any */}
                  {isRejected && car.rejectionReason && (
                    <div style={styles.rejectionNotice}>
                      <span style={styles.rejectionLabel}>Rejection Reason:</span>
                      <span style={styles.rejectionText}>{car.rejectionReason}</span>
                    </div>
                  )}

                  {/* Pending Update Notice */}
                  {isPendingUpdate && (
                    <div style={styles.updateAlertBox}>
                      <span style={styles.updateAlertTitle}>⚠️ Host Edited Vehicle Details:</span>
                      <span style={styles.updateAlertText}>
                        Current approved listing remains live for customers until you review and approve these updates.
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div style={styles.cardActions}>
                  <button
                    onClick={() => setInspectCar(car)}
                    style={styles.inspectBtn}
                    title="View vehicle photos & documentation"
                  >
                    🔍 Inspect & Photos
                  </button>

                  <div style={styles.actionGroup}>
                    {(!isApproved || isPendingUpdate) && (
                      <button
                        onClick={() => handleApprove(car)}
                        disabled={isProcessing}
                        style={{
                          ...styles.approveBtn,
                          opacity: isProcessing ? 0.6 : 1,
                        }}
                      >
                        {isProcessing ? "Processing..." : isPendingUpdate ? "✓ Approve Update" : "✓ Approve Car"}
                      </button>
                    )}

                    {!isRejected && (
                      <button
                        onClick={() => openRejectModal(car)}
                        disabled={isProcessing}
                        style={{
                          ...styles.rejectBtn,
                          opacity: isProcessing ? 0.6 : 1,
                        }}
                      >
                        ✕ Reject
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Inspect Vehicle Modal */}
      {inspectCar && (
        <div style={styles.modalOverlay} onClick={() => setInspectCar(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>{inspectCar.name}</h3>
                <span style={styles.modalSubtitle}>
                  Car ID: {inspectCar.id} • Host: {inspectCar.ownerName}
                </span>
              </div>
              <button
                onClick={() => setInspectCar(null)}
                style={styles.modalCloseBtn}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              {/* Photo Showcase Gallery */}
              <div style={styles.modalSection}>
                <h4 style={styles.sectionHeading}>Vehicle Photo Showcase</h4>
                <div style={styles.galleryGrid}>
                  {/* Main Image */}
                  {inspectCar.image && inspectCar.image.startsWith("http") && (
                    <div
                      style={styles.galleryItem}
                      onClick={() =>
                        setActivePhoto({
                          title: `${inspectCar.name} (Main Photo)`,
                          url: inspectCar.image,
                        })
                      }
                    >
                      <img
                        src={inspectCar.image}
                        alt="Main"
                        style={styles.galleryImg}
                      />
                      <span style={styles.galleryLabel}>Main Photo</span>
                    </div>
                  )}

                  {/* Multi-Angle Photos */}
                  {inspectCar.photos &&
                    Object.entries(inspectCar.photos).map(([angle, pUrl]) => {
                      if (!pUrl || !pUrl.startsWith("http")) return null;
                      return (
                        <div
                          key={angle}
                          style={styles.galleryItem}
                          onClick={() =>
                            setActivePhoto({
                              title: `${inspectCar.name} (${angle.toUpperCase()})`,
                              url: pUrl,
                            })
                          }
                        >
                          <img
                            src={pUrl}
                            alt={angle}
                            style={styles.galleryImg}
                          />
                          <span style={styles.galleryLabel}>
                            {angle.toUpperCase()}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Specs & Configuration */}
              <div style={styles.modalSection}>
                <h4 style={styles.sectionHeading}>Specifications & Pricing</h4>
                <div style={styles.detailGrid}>
                  <div>
                    <span style={styles.metaLabel}>DAILY RATE</span>
                    <span style={styles.metaValue}>{inspectCar.price}</span>
                  </div>
                  <div>
                    <span style={styles.metaLabel}>LOCATION</span>
                    <span style={styles.metaValue}>{inspectCar.location}</span>
                  </div>
                  <div>
                    <span style={styles.metaLabel}>RENTAL MODE</span>
                    <span style={styles.metaValue}>{inspectCar.rentalMode}</span>
                  </div>
                  <div>
                    <span style={styles.metaLabel}>CATEGORY</span>
                    <span style={styles.metaValue}>{inspectCar.category}</span>
                  </div>
                  <div>
                    <span style={styles.metaLabel}>SEATS / TRANSMISSION</span>
                    <span style={styles.metaValue}>
                      {inspectCar.seats} • {inspectCar.transmission}
                    </span>
                  </div>
                  <div>
                    <span style={styles.metaLabel}>FUEL TYPE / SPEED</span>
                    <span style={styles.metaValue}>
                      {inspectCar.fuelType} • {inspectCar.speed}
                    </span>
                  </div>
                  <div>
                    <span style={styles.metaLabel}>REGISTRATION NUMBER</span>
                    <span style={styles.metaValue}>
                      {inspectCar.registrationNumber || "Not recorded"}
                    </span>
                  </div>
                  <div>
                    <span style={styles.metaLabel}>APPROVAL STATUS</span>
                    <span style={styles.metaValue}>
                      {inspectCar.approvalStatus.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vehicle Description */}
              {inspectCar.description && (
                <div style={styles.modalSection}>
                  <h4 style={styles.sectionHeading}>Description & Amenities</h4>
                  <div style={styles.descBox}>{inspectCar.description}</div>
                </div>
              )}

              {/* Pending Update Diff if available */}
              {inspectCar.pendingUpdates && (
                <div style={styles.modalSection}>
                  <h4 style={{ ...styles.sectionHeading, color: "#F59E0B" }}>
                    ⚠️ Proposed Updates Awaiting Review
                  </h4>
                  <div style={styles.diffBox}>
                    <pre style={styles.diffPre}>
                      {JSON.stringify(inspectCar.pendingUpdates, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div style={styles.modalFooter}>
              <button
                onClick={() => setInspectCar(null)}
                style={styles.cancelBtn}
              >
                Close
              </button>

              <div style={styles.actionGroup}>
                <button
                  onClick={() => openRejectModal(inspectCar)}
                  disabled={processingId === inspectCar.id}
                  style={styles.rejectBtn}
                >
                  ✕ Reject Listing
                </button>
                <button
                  onClick={() => handleApprove(inspectCar)}
                  disabled={processingId === inspectCar.id}
                  style={styles.approveBtn}
                >
                  ✓ Approve Vehicle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectingCar && (
        <div style={styles.modalOverlay} onClick={() => setRejectingCar(null)}>
          <div style={styles.rejectModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h3 style={styles.modalTitle}>Reject Vehicle Listing</h3>
                <span style={styles.modalSubtitle}>
                  Provide revision requirements for {rejectingCar.name}
                </span>
              </div>
              <button
                onClick={() => setRejectingCar(null)}
                style={styles.modalCloseBtn}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              <p style={styles.rejectInstruction}>
                Select the issue(s) with this vehicle listing so the host can revise it from the app:
              </p>

              <div style={styles.issueList}>
                {issueOptions.map((issue) => {
                  const isChecked = selectedIssues.includes(issue);
                  return (
                    <label
                      key={issue}
                      onClick={() => toggleIssue(issue)}
                      style={{
                        ...styles.issueItem,
                        backgroundColor: isChecked
                          ? "rgba(239, 68, 68, 0.12)"
                          : "#141414",
                        border: isChecked
                          ? "1px solid #EF4444"
                          : "1px solid rgba(255, 255, 255, 0.1)",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        style={styles.checkbox}
                      />
                      <span style={styles.issueText}>{issue}</span>
                    </label>
                  );
                })}
              </div>

              <div style={{ marginTop: "16px" }}>
                <label style={styles.fieldLabel}>Detailed Rejection Note:</label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why this vehicle was rejected..."
                  style={styles.textarea}
                />
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button
                onClick={() => setRejectingCar(null)}
                style={styles.cancelBtn}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={processingId === rejectingCar.id}
                style={styles.confirmRejectBtn}
              >
                {processingId === rejectingCar.id ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Photo Preview */}
      {activePhoto && (
        <div
          style={styles.lightboxOverlay}
          onClick={() => setActivePhoto(null)}
        >
          <div style={styles.lightboxHeader}>
            <span style={styles.lightboxTitle}>{activePhoto.title}</span>
            <button
              onClick={() => setActivePhoto(null)}
              style={styles.lightboxCloseBtn}
            >
              ✕ Close
            </button>
          </div>
          <div style={styles.lightboxImgContainer}>
            <img
              src={activePhoto.url}
              alt={activePhoto.title}
              style={styles.lightboxImg}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "1380px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "20px",
    flexWrap: "wrap",
    gap: "16px",
  },
  headerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  tagBadge: {
    display: "inline-block",
    alignSelf: "flex-start",
    backgroundColor: "rgba(0, 180, 216, 0.12)",
    color: "#00B4D8",
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "700",
    letterSpacing: "1px",
    border: "1px solid rgba(0, 180, 216, 0.25)",
  },
  title: {
    fontSize: "26px",
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: "-0.5px",
    margin: "0",
  },
  subtitle: {
    fontSize: "14px",
    color: "#9CA3AF",
    margin: "0",
  },
  liveIndicator: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    padding: "6px 12px",
    borderRadius: "20px",
  },
  liveDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#10B981",
    boxShadow: "0 0 8px #10B981",
    display: "inline-block",
  },
  liveText: {
    color: "#34D399",
    fontSize: "12px",
    fontWeight: "600",
    letterSpacing: "0.4px",
  },
  refreshBtn: {
    backgroundColor: "#1E1E1E",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    color: "#E0E0E0",
    padding: "8px 16px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  alertToast: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 18px",
    borderRadius: "10px",
    border: "1px solid",
    marginBottom: "20px",
    fontSize: "14px",
    fontWeight: "500",
  },
  closeAlertBtn: {
    background: "none",
    border: "none",
    color: "inherit",
    fontSize: "16px",
    cursor: "pointer",
    padding: "0 4px",
  },
  pendingAlert: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 18px",
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    border: "1px solid rgba(245, 158, 11, 0.35)",
    borderRadius: "10px",
    marginBottom: "20px",
    color: "#FBBF24",
    fontSize: "14px",
  },
  alertIcon: {
    fontSize: "20px",
  },
  alertText: {
    lineHeight: "1.4",
  },
  controlsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "16px",
    marginBottom: "24px",
  },
  filterBar: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  filterBtn: {
    backgroundColor: "#1E1E1E",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    color: "#9CA3AF",
    padding: "8px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    transition: "all 0.2s ease",
  },
  filterBtnActive: {
    backgroundColor: "rgba(0, 180, 216, 0.15)",
    border: "1px solid #00B4D8",
    color: "#00E5FF",
  },
  filterBtnPendingActive: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    border: "1px solid #F59E0B",
    color: "#FBBF24",
  },
  filterBtnVerifiedActive: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    border: "1px solid #10B981",
    color: "#34D399",
  },
  filterBtnRejectedActive: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    border: "1px solid #EF4444",
    color: "#F87171",
  },
  tabCount: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    padding: "2px 6px",
    borderRadius: "10px",
    fontSize: "11px",
    color: "#FFFFFF",
  },
  tabCountAmber: {
    backgroundColor: "rgba(245, 158, 11, 0.25)",
    padding: "2px 6px",
    borderRadius: "10px",
    fontSize: "11px",
    color: "#FBBF24",
  },
  tabCountGreen: {
    backgroundColor: "rgba(16, 185, 129, 0.25)",
    padding: "2px 6px",
    borderRadius: "10px",
    fontSize: "11px",
    color: "#34D399",
  },
  tabCountRed: {
    backgroundColor: "rgba(239, 68, 68, 0.25)",
    padding: "2px 6px",
    borderRadius: "10px",
    fontSize: "11px",
    color: "#F87171",
  },
  searchWrapper: {
    position: "relative",
    minWidth: "280px",
    flex: "1",
    maxWidth: "440px",
  },
  searchIcon: {
    position: "absolute",
    left: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#6B7280",
    fontSize: "14px",
    pointerEvents: "none",
  },
  searchInput: {
    width: "100%",
    backgroundColor: "#1E1E1E",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    padding: "9px 34px 9px 34px",
    color: "#FFFFFF",
    fontSize: "13px",
    outline: "none",
  },
  clearSearchBtn: {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    color: "#9CA3AF",
    cursor: "pointer",
    fontSize: "12px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
    gap: "20px",
  },
  card: {
    backgroundColor: "#1E1E1E",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "14px",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    transition: "border-color 0.2s ease, transform 0.2s ease",
  },
  cardMediaBox: {
    position: "relative",
    width: "100%",
    height: "190px",
    backgroundColor: "#121212",
    overflow: "hidden",
  },
  cardImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    cursor: "pointer",
    transition: "transform 0.3s ease",
  },
  carFallbackImg: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    backgroundColor: "#181818",
  },
  topBadgesRow: {
    position: "absolute",
    top: "10px",
    left: "10px",
    right: "10px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    pointerEvents: "none",
  },
  categoryBadge: {
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    backdropFilter: "blur(4px)",
    color: "#00E5FF",
    border: "1px solid rgba(0, 180, 216, 0.3)",
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.5px",
  },
  badgePending: {
    backgroundColor: "rgba(245, 158, 11, 0.9)",
    color: "#000000",
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "800",
  },
  badgePendingUpdate: {
    backgroundColor: "rgba(245, 158, 11, 0.95)",
    color: "#000000",
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "800",
  },
  badgeApproved: {
    backgroundColor: "rgba(16, 185, 129, 0.9)",
    color: "#FFFFFF",
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "800",
  },
  badgeRejected: {
    backgroundColor: "rgba(239, 68, 68, 0.9)",
    color: "#FFFFFF",
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "800",
  },
  badgeNeutral: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    color: "#9CA3AF",
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "11px",
  },
  pricePill: {
    position: "absolute",
    bottom: "10px",
    right: "10px",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    backdropFilter: "blur(4px)",
    color: "#00E5FF",
    border: "1px solid rgba(0, 180, 216, 0.4)",
    padding: "4px 10px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "800",
  },
  cardBody: {
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    flex: "1",
  },
  cardTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  carName: {
    fontSize: "16px",
    fontWeight: "800",
    color: "#FFFFFF",
    margin: "0 0 2px 0",
  },
  carBrand: {
    fontSize: "12px",
    color: "#9CA3AF",
  },
  specsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  specChip: {
    backgroundColor: "#161616",
    color: "#D1D5DB",
    padding: "3px 8px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "500",
    border: "1px solid rgba(255, 255, 255, 0.06)",
  },
  hostBox: {
    backgroundColor: "#161616",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: "8px",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  hostAvatar: {
    width: "30px",
    height: "30px",
    borderRadius: "6px",
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    color: "#FBBF24",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700",
    fontSize: "13px",
    flexShrink: 0,
  },
  hostMeta: {
    display: "flex",
    flexDirection: "column",
    flex: "1",
    minWidth: 0,
  },
  hostName: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#FFFFFF",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  hostContact: {
    fontSize: "11px",
    color: "#9CA3AF",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  regBadge: {
    backgroundColor: "rgba(0, 180, 216, 0.12)",
    color: "#00B4D8",
    fontSize: "10px",
    fontWeight: "700",
    padding: "3px 7px",
    borderRadius: "5px",
    border: "1px solid rgba(0, 180, 216, 0.25)",
    flexShrink: 0,
  },
  rejectionNotice: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.25)",
    borderRadius: "8px",
    padding: "8px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  rejectionLabel: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#F87171",
  },
  rejectionText: {
    fontSize: "12px",
    color: "#FCA5A5",
  },
  updateAlertBox: {
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    border: "1px solid rgba(245, 158, 11, 0.3)",
    borderRadius: "8px",
    padding: "8px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  updateAlertTitle: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#FBBF24",
  },
  updateAlertText: {
    fontSize: "11px",
    color: "#FDE68A",
  },
  cardActions: {
    padding: "12px 16px",
    borderTop: "1px solid rgba(255, 255, 255, 0.06)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#191919",
    gap: "8px",
  },
  inspectBtn: {
    backgroundColor: "transparent",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    color: "#D1D5DB",
    padding: "7px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
  actionGroup: {
    display: "flex",
    gap: "8px",
  },
  approveBtn: {
    backgroundColor: "#059669",
    color: "#FFFFFF",
    border: "none",
    padding: "8px 14px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer",
  },
  rejectBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    border: "1px solid rgba(239, 68, 68, 0.4)",
    color: "#F87171",
    padding: "7px 12px",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
  },
  stateCard: {
    backgroundColor: "#1E1E1E",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "14px",
    padding: "60px 24px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    gap: "12px",
  },
  spinner: {
    width: "36px",
    height: "36px",
    border: "3px solid rgba(0, 180, 216, 0.2)",
    borderTopColor: "#00B4D8",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  emptyIcon: {
    fontSize: "36px",
  },
  stateTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#FFFFFF",
    margin: "0",
  },
  stateSubtitle: {
    fontSize: "13px",
    color: "#9CA3AF",
  },
  retryButton: {
    marginTop: "8px",
    backgroundColor: "#00B4D8",
    border: "none",
    color: "#FFFFFF",
    padding: "8px 18px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
  },
  errorCard: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "14px",
    padding: "24px",
    display: "flex",
    gap: "16px",
    alignItems: "flex-start",
  },
  errorIcon: {
    fontSize: "24px",
  },
  errorContent: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  errorTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#F87171",
    margin: "0",
  },
  errorText: {
    fontSize: "13px",
    color: "#FCA5A5",
    margin: "0",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.82)",
    backdropFilter: "blur(5px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modalContent: {
    backgroundColor: "#1E1E1E",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "840px",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.7)",
  },
  rejectModalContent: {
    backgroundColor: "#1E1E1E",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "540px",
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    boxShadow: "0 20px 40px rgba(0, 0, 0, 0.7)",
  },
  modalHeader: {
    padding: "18px 24px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: "800",
    color: "#FFFFFF",
    margin: "0",
  },
  modalSubtitle: {
    fontSize: "12px",
    color: "#9CA3AF",
  },
  modalCloseBtn: {
    background: "none",
    border: "none",
    color: "#9CA3AF",
    fontSize: "18px",
    cursor: "pointer",
  },
  modalBody: {
    padding: "24px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  modalSection: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  sectionHeading: {
    fontSize: "14px",
    fontWeight: "700",
    color: "#00B4D8",
    margin: "0",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  galleryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
    gap: "10px",
  },
  galleryItem: {
    position: "relative",
    height: "100px",
    borderRadius: "8px",
    overflow: "hidden",
    backgroundColor: "#121212",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    cursor: "pointer",
  },
  galleryImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  galleryLabel: {
    position: "absolute",
    bottom: "4px",
    left: "4px",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    color: "#FFFFFF",
    fontSize: "9px",
    fontWeight: "700",
    padding: "2px 5px",
    borderRadius: "4px",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    backgroundColor: "#161616",
    borderRadius: "10px",
    padding: "16px",
  },
  metaLabel: {
    fontSize: "10px",
    fontWeight: "700",
    color: "#6B7280",
    letterSpacing: "0.5px",
  },
  metaValue: {
    fontSize: "13px",
    color: "#E5E7EB",
    fontWeight: "500",
  },
  descBox: {
    backgroundColor: "#161616",
    borderRadius: "10px",
    padding: "14px",
    fontSize: "13px",
    lineHeight: "1.6",
    color: "#D1D5DB",
    whiteSpace: "pre-line",
  },
  diffBox: {
    backgroundColor: "#141414",
    border: "1px solid rgba(245, 158, 11, 0.3)",
    borderRadius: "10px",
    padding: "14px",
    maxHeight: "180px",
    overflowY: "auto",
  },
  diffPre: {
    margin: 0,
    fontSize: "11px",
    color: "#FDE68A",
    fontFamily: "monospace",
  },
  modalFooter: {
    padding: "16px 24px",
    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#161616",
  },
  cancelBtn: {
    backgroundColor: "transparent",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    color: "#E5E7EB",
    padding: "8px 16px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  confirmRejectBtn: {
    backgroundColor: "#DC2626",
    color: "#FFFFFF",
    border: "none",
    padding: "8px 18px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
  },
  rejectInstruction: {
    fontSize: "13px",
    color: "#9CA3AF",
    margin: "0",
  },
  issueList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  issueItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1px solid",
    cursor: "pointer",
    userSelect: "none",
  },
  checkbox: {
    accentColor: "#EF4444",
  },
  issueText: {
    fontSize: "13px",
    color: "#FFFFFF",
  },
  fieldLabel: {
    fontSize: "12px",
    fontWeight: "700",
    color: "#9CA3AF",
    display: "block",
    marginBottom: "6px",
  },
  textarea: {
    width: "100%",
    backgroundColor: "#141414",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: "8px",
    padding: "10px 12px",
    color: "#FFFFFF",
    fontSize: "13px",
    outline: "none",
    resize: "vertical",
    fontFamily: "inherit",
  },
  lightboxOverlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.94)",
    backdropFilter: "blur(6px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1100,
    padding: "20px",
  },
  lightboxHeader: {
    width: "100%",
    maxWidth: "960px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },
  lightboxTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#FFFFFF",
  },
  lightboxCloseBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    border: "none",
    color: "#FFFFFF",
    padding: "6px 14px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  lightboxImgContainer: {
    maxWidth: "960px",
    maxHeight: "82vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  lightboxImg: {
    maxWidth: "100%",
    maxHeight: "82vh",
    objectFit: "contain",
    borderRadius: "10px",
    border: "1px solid rgba(255, 255, 255, 0.2)",
  },
};
