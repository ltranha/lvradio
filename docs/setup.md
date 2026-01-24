# Infrastructure Setup Guide

This guide details how to set up the secure backend using **Backblaze B2** (Storage) and **Cloudflare Workers** (Proxy).

## Backblaze B2 Storage Setup

1. **Create Account**
   * Go to [Backblaze B2](https://www.backblaze.com/b2/cloud-storage.html) and sign up.
   * Enable **B2 Cloud Storage** (Free Tier).

2. **Create a Bucket**
   * Go to **Buckets** in the left menu.
   * Click **Create a Bucket**.
   * **Bucket Unique Name:** choose your unique name.
   * **Files in Bucket are:** Private (Important!).
   * **Encryption:** Disabled.
   * **Object Lock:** Disabled.
   * Click **Create a Bucket**.

3. **Upload Files**
   * Go to **Browse Files** in the left menu.
   * Click **Upload**.
   * Upload your `db.json` file to the root.
   * Create folders named `music` and `art`. Upload your audio and image files into their respective folders.

4. **Get Credentials**
   * Go to **Application Keys** in the left menu.
   * Click **Add a New Application Key**.
   * **Name of Key:** `worker-access-key`.
   * **Allow access to Bucket(s):** Select your specific bucket.
   * **Type of Access:** Read and Write.
   * Click **Create New Key**.
   * **IMPORTANT:** Copy the `keyID` and `applicationKey` immediately. You will never see the `applicationKey` again.
   * **Get Endpoint:** Go to the **Buckets** page and note the **Endpoint** for your bucket (e.g., `s3.us-east-005.backblazeb2.com`).

## Cloudflare Worker Setup

1. **Prepare the Environment**

   Navigate to the [`worker/`](../worker/) directory in the repository and install dependencies:
   ```bash
   cd worker
   npm install aws4fetch
   ```

2. **Configure Code**

   Ensure [`worker/index.js`](../worker/index.js) contains the proxy logic and [`wrangler.toml`](../worker/wrangler.toml) contains your bucket variables:
   * `B2_ENDPOINT`: Your Endpoint from the Backblaze B2 storage setup.
   * `B2_BUCKET_NAME`: Your Bucket name.
   * `B2_REGION`: The region part of your endpoint (e.g., `us-east-005`).

3. **Deploy**

   Run the deployment command:
   ```bash
   npx wrangler deploy
   ```
   * If prompted, log in to Cloudflare and click **Allow**.
   * Select **Yes** to create a `workers.dev` subdomain if you haven't already.
   * Remember the URL provided after deployment (e.g., `https://music-proxy.yourname.workers.dev`).

4. **Set Secrets**

   Securely upload your keys to Cloudflare. Do not commit these to Git.

   Run these commands one by one. It will ask you to paste the value.

   * Key ID
   ```bash
   npx wrangler secret put B2_KEY_ID  # Paste the `keyID` you copied from Backblaze
   ```

   * Application Key
   ```bash
   npx wrangler secret put B2_APP_KEY  # Paste the `applicationKey` you copied from Backblaze
   ```

   * Auth Token
   ```bash
   npx wrangler secret put AUTH_TOKEN  # Create a password for your app
   ```

## Connect Frontend

1. **Get Worker URL**

   Copy the URL provided after `npx wrangler deploy` finishes (e.g., `https://music-proxy.yourname.workers.dev`).

2. **Update Config**

   Open [`js/api.js`](../js/api.js) in the project root and update the constant:
   ```javascript
   const WORKER_URL = 'https://music-proxy.yourname.workers.dev';
   ```

3. **Test**

   Open [`index.html`](../index.html) in your browser. Enter the `AUTH_TOKEN` you created during the Cloudfare Worker setup to unlock your library.
