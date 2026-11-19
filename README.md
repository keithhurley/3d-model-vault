# 3D Model Vault

Serverless 3D Model Storage and Ingestion System (Google Antigravity Blueprint)

## 1. System Architecture Overview

### Storage & Database
- **File Storage:** Google Drive for heavy 3D model and slicer files (`STL`, `3MF`, `G-code`).
- **Metadata Database:** Firebase Realtime Database or Cloud Firestore (free tier) connected via REST APIs for structured, cloud-synced metadata across multiple computers, avoiding local SQLite sync conflicts and file locking.

### Automated Ingestion
- **Backend API & Webhook:** Google Apps Script deployed as an always-on HTTPS web app.
- **Capture Triggers:** Android Share Sheet intent, browser bookmarklet, or Telegram bot posting URLs to the Apps Script webhook.
- **Processing:** Apps Script scrapes page metadata, downloads model archives/files, uploads them to Google Drive, and writes a metadata record to Firebase.

### Frontend UI
- Single-file web application (`HTML`/`CSS`/`JS`) using **Three.js** for client-side 3D model previews.
- Hosted for free on **GitHub Pages** or run locally from desktop, communicating directly with the Google Apps Script API and Firebase.
- **Print Queue / Waitlist:** Flag models into a prioritized print queue (`archived` → `queued` → `printing` → `printed`) so the app serves as an active project waitlist, not just a static repository.
- **Post-Print Notes & Print Logs:** Record timestamped comments, slicer/filament tweaks, outcomes, and *"for next time"* reminders after each print.

## 2. Technical Constraints & Reliability
- **Upload Limits & Quotas:** Standard Google Drive 750 GB daily upload cap; standard Apps Script execution and URL Fetch quotas are sufficient for personal ingestion volumes.
- **Error Handling:** Implement resumable uploads for large 3D files and exponential backoff to handle any temporary API throttling.

## 3. Distribution & Sharing Model
- **Frontend Distribution:** Static single-file app distributed via GitHub repository / GitHub Pages (one-click access).
- **Backend Setup for External Users:** Each user deploys their own copy of the Google Apps Script backend, configures their own Firebase free-tier project, and authorizes access to their personal Google Drive via a setup guide.
