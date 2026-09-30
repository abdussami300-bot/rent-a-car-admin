# Sayyarah - Admin Console

Operations Management Console for **Sayyarah** (Car Rental & Sharing Platform).

Built with [Next.js](https://nextjs.org), React 19, and Firebase (Authentication & Cloud Firestore).

---

## Features

- 📊 **Realtime Dashboard**: Live fleet metrics, user statistics, active bookings, and revenue tracking.
- 👥 **Users Management**: View registered customers, host statuses, phone numbers, and profile details.
- 🛡️ **Host Approvals**: Review host CNIC / driving license documents and approve or reject applications.
- 🚘 **Vehicles (Cars) Management**: Approve vehicle listings, manage pricing, availability, and inspect car specs.
- 📅 **Bookings Management**: Realtime reservation tracking, pickup/return dates, customer and car links, status management.
- 💳 **Payments & Revenue**: Transaction history, total volume, commission breakdown, and payment status.
- 🔐 **Role-based Authentication**: Secure admin gate protecting all operations routes.

---

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local` and set your Firebase configuration:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```

3. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the console.

4. **Production Build**:
   ```bash
   npm run build
   npm run start
   ```
