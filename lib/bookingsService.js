import {
  collection,
  doc,
  getDocs,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Normalizes a raw Firestore booking document into a structured booking object.
 *
 * @param {import("firebase/firestore").DocumentSnapshot} docSnap
 * @returns {Object}
 */
export function parseBookingDoc(docSnap) {
  const data = docSnap.data() || {};
  const car = data.car || {};

  return {
    id: docSnap.id,
    carId: car.id || data.carId || "",
    carName: car.name || data.carName || "Vehicle Reservation",
    carBrand: car.brand || data.carBrand || "Standard",
    carImage: car.image || data.carImage || "",
    carPlate: car.registrationNumber || data.registrationNumber || "",
    ownerId: data.ownerId || car.ownerId || "",
    ownerName: data.ownerName || car.ownerName || "Vehicle Host",
    ownerEmail: data.ownerEmail || car.ownerEmail || "",
    customerId: data.customerId || "",
    customerName: data.customerName || data.name || "Customer",
    customerEmail: data.customerEmail || data.email || "",
    customerPhone: data.customerPhone || data.phone || data.phoneNumber || "",
    pickupDate: data.pickupDate || data.startDate || "",
    returnDate: data.returnDate || data.endDate || "",
    days: typeof data.days === "number" ? data.days : 1,
    totalPrice: typeof data.totalPrice === "number" ? data.totalPrice : (parseInt(data.totalPrice, 10) || 0),
    securityDeposit: typeof data.securityDeposit === "number" ? data.securityDeposit : 15000,
    rentalModeOption: data.rentalModeOption || data.rentalMode || "Self-Drive",
    status: (data.status || "Pending").trim(),
    paymentStatus: (data.paymentStatus || "Pending").trim(),
    paymentMethod: data.paymentMethod || "Cash on Pickup",
    paymentProofUrl: data.paymentProofUrl || "",
    inspectionStatus: data.inspectionStatus || "pending",
    returnInspectionStatus: data.returnInspectionStatus || "none",
    bookingDate: data.bookingDate || data.createdAt || null,
    createdAt: data.createdAt || data.bookingDate || null,
    ...data,
  };
}

/**
 * Sorts bookings: Newest / Most recent bookings first.
 *
 * @param {Array<Object>} list
 * @returns {Array<Object>}
 */
export function sortBookingsList(list) {
  return list.sort((a, b) => {
    const aTime = a.createdAt?.seconds || a.bookingDate?.seconds || 0;
    const bTime = b.createdAt?.seconds || b.bookingDate?.seconds || 0;
    return bTime - aTime;
  });
}

/**
 * Subscribes to real-time changes in Firestore 'bookings' collection.
 * Automatically updates reservations without requiring manual page refresh.
 *
 * @param {Function} onData - Callback receiving updated array of bookings
 * @param {Function} [onError] - Error callback
 * @returns {Function} Unsubscribe function
 */
export function subscribeBookings(onData, onError) {
  const bookingsRef = collection(db, "bookings");

  return onSnapshot(
    bookingsRef,
    (querySnapshot) => {
      const list = [];
      querySnapshot.forEach((docSnap) => {
        list.push(parseBookingDoc(docSnap));
      });
      sortBookingsList(list);
      onData(list);
    },
    (err) => {
      console.error("Bookings realtime listener error:", err);
      if (onError) onError(err);
    }
  );
}

/**
 * Fetches all bookings from Firestore 'bookings' collection once.
 *
 * @returns {Promise<Array<Object>>} List of booking objects
 */
export async function fetchBookings() {
  const bookingsRef = collection(db, "bookings");
  const querySnapshot = await getDocs(bookingsRef);

  const list = [];
  querySnapshot.forEach((docSnap) => {
    list.push(parseBookingDoc(docSnap));
  });

  return sortBookingsList(list);
}

/**
 * Updates a booking's status in Firestore (e.g. 'Confirmed', 'Completed', 'Cancelled').
 *
 * @param {string} bookingId - Document ID in 'bookings'
 * @param {string} newStatus - New status value
 * @returns {Promise<void>}
 */
export async function updateBookingStatus(bookingId, newStatus) {
  if (!bookingId) throw new Error("Booking ID is required.");
  const bookingDocRef = doc(db, "bookings", bookingId);
  await updateDoc(bookingDocRef, {
    status: newStatus,
  });
}

/**
 * Updates a booking's payment status in Firestore (e.g. 'Paid', 'Pending').
 *
 * @param {string} bookingId - Document ID in 'bookings'
 * @param {string} newPaymentStatus - New payment status
 * @returns {Promise<void>}
 */
export async function updateBookingPaymentStatus(bookingId, newPaymentStatus) {
  if (!bookingId) throw new Error("Booking ID is required.");
  const bookingDocRef = doc(db, "bookings", bookingId);
  await updateDoc(bookingDocRef, {
    paymentStatus: newPaymentStatus,
  });
}
