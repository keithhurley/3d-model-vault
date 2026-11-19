# Setup Guide: Firebase + Google Apps Script Backend

Follow these steps to connect **3D Model Vault** to your own personal **Google Drive** and free-tier **Firebase Realtime Database**.

---

## Step 1: Create Your Free Firebase Realtime Database

1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Create a project** (name it `3d-model-vault`).
2. In the left sidebar, go to **Build → Realtime Database** and click **Create Database**.
3. Choose your region and start in **Test Mode** (you can lock down security rules later).
4. Copy your database URL — it looks like:
   ```text
   https://your-project-id-default-rtdb.firebaseio.com
   ```

---

## Step 2: Deploy the Google Apps Script Backend (`backend/Code.gs`)

1. Open [script.google.com](https://script.google.com/) and click **New project**.
2. Rename the project to **3D Model Vault Backend**.
3. Delete the default `myFunction()` code and paste the entire contents of [`backend/Code.gs`](../backend/Code.gs).
4. Click the **Project Settings** (gear icon on the left) → scroll to **Script Properties** → click **Add script property**:
   - **`FIREBASE_DB_URL`**: Paste your Firebase Realtime Database URL from Step 1.
   - **`VAULT_ROOT_FOLDER`** *(optional)*: `3D Model Vault`
   - **`API_SECRET`** *(optional)*: Any random password you choose if you want to require a secret on webhook calls.
   - **`TELEGRAM_BOT_TOKEN`** *(optional)*: Your Telegram bot token from `@BotFather` if you want to text URLs to a bot.
5. Click **Deploy → New deployment** (top right):
   - Select type: **Web app**
   - **Execute as:** `Me`
   - **Who has access:** `Anyone` (so your GitHub Pages app, bookmarklet, and phone share sheet can reach it)
6. Click **Deploy**, authorize Google Drive permissions when prompted, and copy the **Web app URL**:
   ```text
   https://script.google.com/macros/s/AKfycb.../exec
   ```

---

## Step 3: Verify & Connect to the Web App

1. Test your Apps Script URL by opening it in a browser with `?action=ping`:
   ```text
   https://script.google.com/macros/s/AKfycb.../exec?action=ping
   ```
   You should see JSON returning `"ok": true` and `"firebaseConfigured": true`.
2. Open your **3D Model Vault** web app ([GitHub Pages](https://keithhurley.github.io/3d-model-vault/)), go to the **⚙️ Setup** tab, and paste both URLs.
