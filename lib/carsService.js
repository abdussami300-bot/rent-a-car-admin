import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteField,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Normalizes a raw Firestore car document into a structured car object with owner details.
 *
 * @param {import("firebase/firestore").DocumentSnapshot} carDoc
 * @param {Map} usersByUid
 * @param {Map} usersByEmail
 * @returns {Object}
 */
export function parseCarDoc(carDoc, usersByUid = new Map(), usersByEmail = new Map()) {
  const data = carDoc.data() || {};
  const rawStatus = (
    data.approvalStatus || (data.isApproved === true ? "approved" : "pending")
  )
    .toString()
    .toLowerCase()
    .trim();

  const ownerId = (data.ownerId || "").toString().trim();
  const ownerEmail = (data.ownerEmail || "").toString().trim().toLowerCase();

  // Lookup owner in users map
  let ownerObj = null;
  if (ownerId && usersByUid.has(ownerId)) {
    ownerObj = usersByUid.get(ownerId);
  } else if (ownerEmail && usersByEmail.has(ownerEmail)) {
    ownerObj = usersByEmail.get(ownerEmail);
  }

  return {
    id: carDoc.id,
    name: data.name || "Unnamed Vehicle",
    brand: data.brand || "Custom",
    price: data.price || "5000/day",
    rating: typeof data.rating === "number" ? data.rating : 5.0,
    image: data.image || "",
    photos: data.photos && typeof data.photos === "object" ? data.photos : {},
    seats: data.seats || "5 Seats",
    transmission: data.transmission || "Automatic",
    fuelType: data.fuelType || "Petrol",
    speed: data.speed || "220 km/h",
    location: data.location || "Islamabad, Pakistan",
    description: data.description || "",
    rentalMode: data.rentalMode || "Both Available",
    category: data.category || "Sedan",
    isUserCar: data.isUserCar === true,
    ownerId: ownerId,
    ownerEmail: ownerEmail,
    ownerName: ownerObj?.name || data.ownerName || "Vehicle Host",
    ownerPhone: ownerObj?.phone || ownerObj?.phoneNumber || data.ownerPhone || "",
    ownerCnic: ownerObj?.cnicNumber || data.ownerCnic || "",
    availableFrom: data.availableFrom || "Available Now",
    availableTo: data.availableTo || "Always Open",
    isApproved: data.isApproved === true,
    approvalStatus: rawStatus, // "approved", "pending", "rejected", "pending_update"
    rejectionReason: data.rejectionReason || "",
    rejectionIssues: Array.isArray(data.rejectionIssues) ? data.rejectionIssues : [],
    registrationNumber: data.registrationNumber || "",
    registrationDocUrl: data.registrationDocUrl || "",
    pendingUpdates: data.pendingUpdates && typeof data.pendingUpdates === "object" ? data.pendingUpdates : null,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    approvedAt: data.approvedAt || null,
    approvedBy: data.approvedBy || "",
  };
}

/**
 * Sorts cars list with pending approvals first, then newest.
 *
 * @param {Array<Object>} carsList
 * @returns {Array<Object>}
 */
export function sortCarsList(carsList) {
  return carsList.sort((a, b) => {
    const aPending = a.approvalStatus === "pending" || a.approvalStatus === "pending_update" ? 0 : 1;
    const bPending = b.approvalStatus === "pending" || b.approvalStatus === "pending_update" ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;

    const aTime = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
    const bTime = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
}

/**
 * Subscribes to real-time changes in Firestore 'cars' and 'users' collections.
 * Automatically synchronizes vehicle inventory and updates without requiring manual refresh.
 *
 * @param {Function} onData - Callback receiving updated array of cars
 * @param {Function} [onError] - Callback for subscription errors
 * @returns {Function} Unsubscribe function
 */
export function subscribeCars(onData, onError) {
  const carsRef = collection(db, "cars");
  const usersRef = collection(db, "users");

  let latestCarsSnap = null;
  let latestUsersSnap = null;

  const notify = () => {
    if (!latestCarsSnap) return;

    const usersByUid = new Map();
    const usersByEmail = new Map();
    if (latestUsersSnap) {
      latestUsersSnap.forEach((uDoc) => {
        const uData = uDoc.data();
        const userObj = { id: uDoc.id, ...uData };
        usersByUid.set(uDoc.id, userObj);
        if (uData.uid) usersByUid.set(uData.uid, userObj);
        if (uData.email) usersByEmail.set(uData.email.toLowerCase().trim(), userObj);
      });
    }

    const carsList = [];
    latestCarsSnap.forEach((carDoc) => {
      carsList.push(parseCarDoc(carDoc, usersByUid, usersByEmail));
    });

    sortCarsList(carsList);
    onData(carsList);
  };

  const unsubCars = onSnapshot(
    carsRef,
    (snap) => {
      latestCarsSnap = snap;
      notify();
    },
    (err) => {
      console.error("Cars realtime subscription error:", err);
      if (onError) onError(err);
    }
  );

  const unsubUsers = onSnapshot(
    usersRef,
    (snap) => {
      latestUsersSnap = snap;
      notify();
    },
    (err) => {
      console.warn("Users lookup listener warning in subscribeCars:", err);
    }
  );

  return () => {
    unsubCars();
    unsubUsers();
  };
}

/**
 * Fetches all vehicles from Firestore 'cars' collection with owner details once.
 *
 * @returns {Promise<Array<Object>>} List of car objects with enriched owner details
 */
export async function fetchCars() {
  const carsRef = collection(db, "cars");
  const usersRef = collection(db, "users");

  const [carsSnapshot, usersSnapshot] = await Promise.all([
    getDocs(carsRef),
    getDocs(usersRef),
  ]);

  // Build users lookup map by UID and by lowercase email
  const usersByUid = new Map();
  const usersByEmail = new Map();

  usersSnapshot.forEach((uDoc) => {
    const uData = uDoc.data();
    const userObj = { id: uDoc.id, ...uData };
    usersByUid.set(uDoc.id, userObj);
    if (uData.uid) usersByUid.set(uData.uid, userObj);
    if (uData.email) usersByEmail.set(uData.email.toLowerCase().trim(), userObj);
  });

  const carsList = [];
  carsSnapshot.forEach((carDoc) => {
    carsList.push(parseCarDoc(carDoc, usersByUid, usersByEmail));
  });

  return sortCarsList(carsList);
}

/**
 * Approves a car listing or pending car update.
 * Matches existing Flutter FirestoreService.approveCarListing schema exactly.
 *
 * @param {string} carId - Document ID in 'cars'
 * @param {string} adminIdentifier - Admin UID or Email
 */
export async function approveCarListing(carId, adminIdentifier) {
  if (!carId) throw new Error("Car ID is required.");

  const carDocRef = doc(db, "cars", carId);
  const carDocSnap = await getDoc(carDocRef);

  if (!carDocSnap.exists()) {
    throw new Error(`Car '${carId}' does not exist.`);
  }

  const data = carDocSnap.data() || {};
  const updates = {
    isApproved: true,
    approvalStatus: "approved",
    rejectionReason: "",
    rejectionIssues: [],
    approvedAt: serverTimestamp(),
    approvedBy: adminIdentifier || "admin",
  };

  // If this was a pending update, merge pendingUpdates into live fields
  if (data.pendingUpdates && typeof data.pendingUpdates === "object") {
    const pending = { ...data.pendingUpdates };
    delete pending.id;
    delete pending.approvalStatus;
    delete pending.isApproved;
    delete pending.pendingUpdates;

    Object.assign(updates, pending);
    updates.pendingUpdates = deleteField();
  }

  await setDoc(carDocRef, updates, { merge: true });

  // Update vehicle owner to verified owner in users collection
  const ownerId = (data.ownerId || "").toString().trim();
  const ownerEmail = (data.ownerEmail || "").toString().trim().toLowerCase();

  const approvalUserData = {
    role: "owner",
    isHostVerified: true,
    isVerified: true,
    verificationStatus: "verified",
    verificationRejectionReason: "",
    rejectionIssues: [],
    lastVerificationAlert: {
      type: "approved",
      title: "🎉 Congratulations! Your Vehicle is Live & Host Mode Active",
      message: `Your car listing "${data.name || "vehicle"}" has been approved by Admin and is now live for customer bookings. Host Mode is unlocked!`,
      timestamp: serverTimestamp(),
      seen: false,
    },
  };

  if (ownerId) {
    try {
      await setDoc(doc(db, "users", ownerId), approvalUserData, { merge: true });
    } catch (e) {
      console.warn("Could not update owner doc by ownerId:", e);
    }
  }

  return true;
}

/**
 * Rejects a car listing or pending car update with reasons.
 * Matches existing Flutter FirestoreService.rejectCarListing schema exactly.
 *
 * @param {string} carId - Document ID in 'cars'
 * @param {string} adminIdentifier - Admin UID or Email
 * @param {string} reason - Rejection explanation
 * @param {Array<string>} [issues=[]] - List of specific issues
 */
export async function rejectCarListing(carId, adminIdentifier, reason, issues = []) {
  if (!carId) throw new Error("Car ID is required.");

  const carDocRef = doc(db, "cars", carId);
  const carDocSnap = await getDoc(carDocRef);

  if (!carDocSnap.exists()) {
    throw new Error(`Car '${carId}' does not exist.`);
  }

  const data = carDocSnap.data() || {};
  const currentStatus = (data.approvalStatus || "").toString().toLowerCase().trim();
  const cleanReason = (reason || "Vehicle documents or photos require revision.").trim();

  const updates = {
    rejectionReason: cleanReason,
    rejectionIssues: issues || [],
    reviewedAt: serverTimestamp(),
    reviewedBy: adminIdentifier || "admin",
  };

  if (currentStatus === "pending_update") {
    // Revert to current live approved listing and delete invalid pending draft
    updates.approvalStatus = "approved";
    updates.isApproved = true;
    updates.pendingUpdates = deleteField();
  } else {
    // Reject new vehicle listing
    updates.approvalStatus = "rejected";
    updates.isApproved = false;
  }

  await setDoc(carDocRef, updates, { merge: true });

  // Notify vehicle owner via their user document
  const ownerId = (data.ownerId || "").toString().trim();
  const rejectionUserUpdate = {
    verificationRejectionReason: cleanReason,
    rejectionIssues: issues || [],
    lastVerificationAlert: {
      type: "rejected",
      title: "Vehicle Listing Requires Revision",
      message: `Vehicle "${data.name || "listing"}": ${cleanReason}`,
      issues: issues || [],
      timestamp: serverTimestamp(),
      seen: false,
    },
  };

  if (ownerId) {
    try {
      await setDoc(doc(db, "users", ownerId), rejectionUserUpdate, { merge: true });
    } catch (e) {
      console.warn("Could not update owner doc on rejection:", e);
    }
  }

  return true;
}
