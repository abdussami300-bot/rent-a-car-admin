import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

function parseHostRecord(documentSnap) {
  const data = documentSnap.data();
  const hasStatus = !!data.verificationStatus;
  const hasHostFields =
    data.isHostVerified !== undefined ||
    !!data.cnicNumber ||
    !!data.licenseNumber ||
    data.role === "host" ||
    data.role === "owner";

  if (!hasStatus && !hasHostFields) return null;

  let normStatus = (data.verificationStatus || "").toLowerCase().trim();
  if (!normStatus) {
    if (data.isHostVerified === true || data.isVerified === true) {
      normStatus = "verified";
    } else if (data.cnicNumber || data.licenseNumber) {
      normStatus = "pending";
    } else {
      normStatus = "unverified";
    }
  }

  return {
    id: documentSnap.id,
    uid: data.uid || documentSnap.id,
    name: data.name || "Unnamed User",
    email: data.email || "",
    phone: data.phone || data.phoneNumber || "",
    role: data.role || "customer",
    isVerified: data.isVerified === true,
    isHostVerified: data.isHostVerified === true,
    verificationStatus: normStatus,
    cnicNumber: data.cnicNumber || "",
    cnicFrontUrl: data.cnicFrontUrl || data.cnicFrontPath || "",
    cnicBackUrl: data.cnicBackUrl || data.cnicBackPath || "",
    licenseNumber: data.licenseNumber || "",
    licenseExpiry: data.licenseExpiry || "",
    licenseUrl: data.licenseUrl || data.licenseImagePath || "",
    rejectionReason: data.verificationRejectionReason || "",
    rejectionIssues: Array.isArray(data.rejectionIssues) ? data.rejectionIssues : [],
    createdAt: data.createdAt || null,
    verificationSubmittedAt: data.verificationSubmittedAt || null,
    verificationReviewedAt: data.verificationReviewedAt || null,
    ...data,
  };
}

function sortHostList(list) {
  list.sort((a, b) => {
    const aPending = a.verificationStatus === "pending" || a.verificationStatus === "in_review" ? 0 : 1;
    const bPending = b.verificationStatus === "pending" || b.verificationStatus === "in_review" ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;

    const aTime = a.verificationSubmittedAt?.seconds || a.createdAt?.seconds || 0;
    const bTime = b.verificationSubmittedAt?.seconds || b.createdAt?.seconds || 0;
    return bTime - aTime;
  });
  return list;
}

/**
 * Subscribes to real-time changes in host verification records without requiring manual refresh.
 *
 * @param {Function} onData - Callback receiving updated array of host records
 * @param {Function} [onError] - Error callback
 * @returns {Function} Unsubscribe function
 */
export function subscribeHostApprovals(onData, onError) {
  const usersRef = collection(db, "users");
  return onSnapshot(
    usersRef,
    (querySnapshot) => {
      const list = [];
      querySnapshot.forEach((docSnap) => {
        const item = parseHostRecord(docSnap);
        if (item) list.push(item);
      });
      sortHostList(list);
      onData(list);
    },
    (err) => {
      console.error("Host approvals real-time listener error:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * Fetches users with host verification records from the Firestore 'users' collection once.
 *
 * @returns {Promise<Array<Object>>} List of host approval candidate objects
 */
export async function fetchHostApprovals() {
  const usersRef = collection(db, "users");
  const querySnapshot = await getDocs(usersRef);

  const list = [];
  querySnapshot.forEach((documentSnap) => {
    const item = parseHostRecord(documentSnap);
    if (item) list.push(item);
  });

  return sortHostList(list);
}

/**
 * Approves a user's host application in Firestore.
 * Preserves existing profile data and updates verification fields according
 * to the exact schema expected by the Flutter app.
 *
 * @param {string} userId - User document ID
 * @param {string} adminIdentifier - Admin UID or Email
 * @param {boolean} [approveAttachedCars=false] - Whether to approve pending cars
 */
export async function approveHostVerification(userId, adminIdentifier, approveAttachedCars = false) {
  if (!userId) throw new Error("User ID is required for approval.");

  const userDocRef = doc(db, "users", userId);
  const userDocSnap = await getDoc(userDocRef);

  if (!userDocSnap.exists()) {
    throw new Error(`User record '${userId}' does not exist.`);
  }

  const existingData = userDocSnap.data() || {};
  const userEmail = (existingData.email || "").toString().trim().toLowerCase();

  const updateData = {
    verificationStatus: "verified",
    isVerified: true,
    isHostVerified: true,
    role: "owner", // In Flutter app, approved hosts have role 'owner'
    verificationReviewedAt: serverTimestamp(),
    verificationReviewedBy: adminIdentifier || "admin",
    verificationRejectionReason: "",
    rejectionIssues: [],
    lastVerificationAlert: {
      type: "approved",
      isHost: true,
      title: "🎉 Congratulations! You are an Approved Host",
      message: "Your host identity and documents have been verified by Admin. You can now access Host Mode and list vehicles!",
      timestamp: serverTimestamp(),
      seen: false,
    },
  };

  await setDoc(userDocRef, updateData, { merge: true });

  // Optional: approve attached cars if requested
  if (approveAttachedCars) {
    try {
      const carsRef = collection(db, "cars");
      const carsSnap = await getDocs(carsRef);

      const updatePromises = [];
      carsSnap.forEach((carDoc) => {
        const cData = carDoc.data();
        const oId = (cData.ownerId || "").toString().trim();
        const oEmail = (cData.ownerEmail || "").toString().trim().toLowerCase();

        if (oId === userId || (userEmail && oEmail === userEmail)) {
          if (cData.approvalStatus === "pending") {
            updatePromises.push(
              setDoc(
                carDoc.ref,
                {
                  isApproved: true,
                  approvalStatus: "approved",
                  rejectionReason: "",
                  rejectionIssues: [],
                  approvedAt: serverTimestamp(),
                  approvedBy: adminIdentifier || "admin",
                },
                { merge: true }
              )
            );
          }
        }
      });

      await Promise.all(updatePromises);
    } catch (e) {
      console.warn("Error approving attached cars:", e);
    }
  }

  return true;
}

/**
 * Rejects a user's host application in Firestore.
 * Preserves customer account functionality while recording rejection reasons.
 *
 * @param {string} userId - User document ID
 * @param {string} adminIdentifier - Admin UID or Email
 * @param {string} reason - Rejection explanation
 * @param {Array<string>} [issues=[]] - List of specific issues (e.g. Blurry CNIC)
 */
export async function rejectHostVerification(userId, adminIdentifier, reason, issues = []) {
  if (!userId) throw new Error("User ID is required for rejection.");

  const userDocRef = doc(db, "users", userId);
  const userDocSnap = await getDoc(userDocRef);

  if (!userDocSnap.exists()) {
    throw new Error(`User record '${userId}' does not exist.`);
  }

  const existingData = userDocSnap.data() || {};
  const userEmail = (existingData.email || "").toString().trim().toLowerCase();
  const cleanReason = (reason || "Documents could not be verified.").trim();

  const updateData = {
    verificationStatus: "rejected",
    isVerified: false,
    isHostVerified: false,
    verificationReviewedAt: serverTimestamp(),
    verificationReviewedBy: adminIdentifier || "admin",
    verificationRejectionReason: cleanReason,
    rejectionIssues: issues || [],
    lastVerificationAlert: {
      type: "rejected",
      title: "Application Needs Revision",
      message: cleanReason,
      issues: issues || [],
      timestamp: serverTimestamp(),
      seen: false,
    },
  };

  await setDoc(userDocRef, updateData, { merge: true });

  // Also reject any pending cars associated with this host
  try {
    const carsRef = collection(db, "cars");
    const carsSnap = await getDocs(carsRef);

    const updatePromises = [];
    carsSnap.forEach((carDoc) => {
      const cData = carDoc.data();
      const oId = (cData.ownerId || "").toString().trim();
      const oEmail = (cData.ownerEmail || "").toString().trim().toLowerCase();

      if (oId === userId || (userEmail && oEmail === userEmail)) {
        if (cData.approvalStatus === "pending") {
          updatePromises.push(
            setDoc(
              carDoc.ref,
              {
                isApproved: false,
                approvalStatus: "rejected",
                rejectionReason: cleanReason,
                rejectionIssues: issues || [],
                reviewedAt: serverTimestamp(),
                reviewedBy: adminIdentifier || "admin",
              },
              { merge: true }
            )
          );
        }
      }
    });

    await Promise.all(updatePromises);
  } catch (e) {
    console.warn("Error marking pending cars as rejected:", e);
  }

  return true;
}
