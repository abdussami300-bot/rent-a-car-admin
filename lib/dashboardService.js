import {
  collection,
  query,
  where,
  getCountFromServer,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Subscribes to real-time changes across 'users', 'cars', and 'bookings' collections.
 * Automatically recalculates dashboard KPI metrics without requiring the user to refresh.
 *
 * @param {Function} onData - Callback receiving updated metrics object
 * @param {Function} [onError] - Callback for subscription errors
 * @returns {Function} Unsubscribe function
 */
export function subscribeDashboardMetrics(onData, onError) {
  const usersRef = collection(db, "users");
  const carsRef = collection(db, "cars");
  const bookingsRef = collection(db, "bookings");

  let latestUsers = null;
  let latestCars = null;
  let latestBookings = null;

  const recalculateAndNotify = () => {
    let registeredUsers = 0;
    let pendingHosts = 0;
    let fleetVehicles = 0;
    let pendingCars = 0;
    let totalBookings = 0;

    if (latestUsers) {
      registeredUsers = latestUsers.size;
      latestUsers.forEach((uDoc) => {
        const u = uDoc.data();
        const st = (u.verificationStatus || "").toLowerCase();
        if (st === "pending" || st === "in_review") {
          pendingHosts++;
        } else if (!st && (u.cnicNumber || u.licenseNumber) && !u.isHostVerified) {
          pendingHosts++;
        }
      });
    }

    if (latestCars) {
      latestCars.forEach((cDoc) => {
        const c = cDoc.data();
        const st = (c.approvalStatus || (c.isApproved ? "approved" : "pending")).toLowerCase();
        if (st === "approved" || c.isApproved === true) {
          fleetVehicles++;
        }
        if (st === "pending" || st === "pending_update") {
          pendingCars++;
        }
      });
    }

    if (latestBookings) {
      totalBookings = latestBookings.size;
    }

    onData({
      registeredUsers,
      pendingHosts,
      fleetVehicles,
      pendingCars,
      totalBookings,
    });
  };

  const unsubUsers = onSnapshot(
    usersRef,
    (snap) => {
      latestUsers = snap;
      recalculateAndNotify();
    },
    (err) => {
      console.error("Dashboard users subscription error:", err);
      if (onError) onError(err);
    }
  );

  const unsubCars = onSnapshot(
    carsRef,
    (snap) => {
      latestCars = snap;
      recalculateAndNotify();
    },
    (err) => {
      console.error("Dashboard cars subscription error:", err);
      if (onError) onError(err);
    }
  );

  const unsubBookings = onSnapshot(
    bookingsRef,
    (snap) => {
      latestBookings = snap;
      recalculateAndNotify();
    },
    (err) => {
      console.warn("Dashboard bookings subscription warning:", err);
      // Bookings might be empty or permissions restricted; don't break the listener
      if (latestBookings === null) {
        latestBookings = { size: 0 };
        recalculateAndNotify();
      }
    }
  );

  return () => {
    unsubUsers();
    unsubCars();
    unsubBookings();
  };
}

/**
 * Efficiently calculates real counts from Firestore using server-side aggregation.
 *
 * @returns {Promise<{
 *   registeredUsers: number,
 *   pendingHosts: number,
 *   fleetVehicles: number,
 *   pendingCars: number,
 *   totalBookings: number,
 * }>}
 */
export async function fetchDashboardMetrics() {
  const usersRef = collection(db, "users");
  const carsRef = collection(db, "cars");
  const bookingsRef = collection(db, "bookings");

  let registeredUsers = 0;
  let pendingHosts = 0;
  let fleetVehicles = 0;
  let pendingCars = 0;
  let totalBookings = 0;

  // 1. Registered Users Count
  try {
    const usersSnap = await getCountFromServer(usersRef);
    registeredUsers = usersSnap.data().count;
  } catch (e) {
    console.warn("Failed to get users count:", e);
  }

  // 2. Pending Host Approvals Count
  try {
    const qPendingHosts = query(
      usersRef,
      where("verificationStatus", "in", ["pending", "in_review"])
    );
    const hostSnap = await getCountFromServer(qPendingHosts);
    pendingHosts = hostSnap.data().count;
  } catch (e) {
    try {
      const qPendingHosts = query(
        usersRef,
        where("verificationStatus", "==", "pending")
      );
      const hostSnap = await getCountFromServer(qPendingHosts);
      pendingHosts = hostSnap.data().count;
    } catch (err2) {
      console.warn("Failed to get pending hosts count:", err2);
    }
  }

  // 3. Approved Fleet Vehicles Count
  try {
    const qApprovedCars = query(
      carsRef,
      where("approvalStatus", "==", "approved")
    );
    const carSnap = await getCountFromServer(qApprovedCars);
    fleetVehicles = carSnap.data().count;
  } catch (e) {
    try {
      const qApprovedCars = query(carsRef, where("isApproved", "==", true));
      const carSnap = await getCountFromServer(qApprovedCars);
      fleetVehicles = carSnap.data().count;
    } catch (err2) {
      console.warn("Failed to get approved cars count:", err2);
    }
  }

  // 3b. Pending Cars Count
  try {
    const qPendingCars = query(
      carsRef,
      where("approvalStatus", "in", ["pending", "pending_update"])
    );
    const pendingSnap = await getCountFromServer(qPendingCars);
    pendingCars = pendingSnap.data().count;
  } catch (e) {
    try {
      const qPendingCars = query(
        carsRef,
        where("approvalStatus", "==", "pending")
      );
      const pendingSnap = await getCountFromServer(qPendingCars);
      pendingCars = pendingSnap.data().count;
    } catch (_) {}
  }

  // 4. Total Bookings Count
  try {
    const bookingSnap = await getCountFromServer(bookingsRef);
    totalBookings = bookingSnap.data().count;
  } catch (e) {
    console.warn("Failed to get bookings count:", e);
  }

  return {
    registeredUsers,
    pendingHosts,
    fleetVehicles,
    pendingCars,
    totalBookings,
  };
}
