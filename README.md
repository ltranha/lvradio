# LV Radio - Private Music Streamer

A secure, web-based music player designed to stream a private music library from **Backblaze B2** via a **Cloudflare Worker** proxy.

This setup uses Backblaze B2’s free tier, requiring no credit card and supporting up to 10GB of storage.

## Architecture

* **Frontend:** Vanilla HTML/CSS/JS (Single Page Application).
* **Storage:** Backblaze B2 (Private Bucket).
* **Security layer:** Cloudflare Workers (Acts as a proxy to sign S3 requests and validate Auth tokens).

## Quick Start

### Prerequisites
* Node.js and npm (for the worker).
* A Backblaze B2 account.
* A Cloudflare Workers account.

### Installation

1.  **Clone the repository**

    ```bash
    git clone https://github.com/ltranha/lvradio.git
    cd lvradio
    ```

2.  **Setup the Cloudflare Worker**

    ```bash
    cd worker
    npm install
    ```

3.  **Deploy Backend**

    Follow the detailed steps in [docs/setup.md](docs/setup.md) to configure your secrets and deploy the worker.

4.  **Configure Frontend**

    Update [`js/api.js`](js/api.js)  with your worker URL:
    ```javascript
    const WORKER_URL = 'https://music-proxy.yourname.workers.dev';
    ```

5.  **Run Locally**

    Open `index.html` using a local server (e.g., Live Server).

## Security

* **Token Authentication:** The app requires a secret password (Auth Token) to load.
* **Hidden Credentials:** Backblaze keys are stored securely in Cloudflare Secrets, never in the browser.
* **CORS Protection:** The worker manages Access-Control headers to ensure safe cross-origin requests.
