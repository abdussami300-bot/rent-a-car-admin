import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "@/lib/firebase";

/**
 * Verifies whether the provided user has the "admin" role in Firestore.
 * Checks both direct document ID (users/{uid}) and queries by uid or email.
 *
 * @param {string} uid - Firebase Auth user UID
 * @param {string} [email] - Optional user email
 * @returns {Promise<{isAdmin: boolean, error?: string, user?: object}>}
 */
export async function verifyAdminRole(uid, email = "") {
  if (!uid) {
    return { isAdmin: false, error: "No user authenticated." };
  }

  try {
    let userData = null;

    // 1. Direct document lookup by doc ID (standard pattern: /users/{uid})
    try {
      const userDocRef = doc(db, "users", uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        userData = { id: userDocSnap.id, ...userDocSnap.data() };
      }
    } catch (e) {
      console.warn("Direct /users/{uid} fetch attempt:", e);
    }

    // 2. Fallback query by 'uid' field if not resolved
    if (!userData) {
      const usersRef = collection(db, "users");
      const qUid = query(usersRef, where("uid", "==", uid));
      const snapUid = await getDocs(qUid);
      if (!snapUid.empty) {
        userData = { id: snapUid.docs[0].id, ...snapUid.docs[0].data() };
      }
    }

    // 3. Fallback query by 'email' field if provided
    if (!userData && email) {
      const usersRef = collection(db, "users");
      const qEmail = query(usersRef, where("email", "==", email.toLowerCase().trim()));
      const snapEmail = await getDocs(qEmail);
      if (!snapEmail.empty) {
        userData = { id: snapEmail.docs[0].id, ...snapEmail.docs[0].data() };
      }
    }

    // If no user document could be found
    if (!userData) {
      await signOut(auth);
      return {
        isAdmin: false,
        error: "Access denied. No user account record exists in the system.",
      };
    }

    // Check if role is "admin"
    const role = (userData.role || "").toString().toLowerCase().trim();
    if (role !== "admin") {
      await signOut(auth);
      return {
        isAdmin: false,
        error: "Access denied. You do not have admin privileges.",
      };
    }

    return {
      isAdmin: true,
      user: userData,
    };
  } catch (err) {
    console.error("Admin verification error:", err);
    await signOut(auth);
    return {
      isAdmin: false,
      error: "Error verifying admin privileges: " + (err.message || "Access denied."),
    };
  }
}

