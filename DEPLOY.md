# Putting Remembrall online

The backend is already running on Supabase (project **Remembrall**, Singapore region): the database, sign-in, and the daily reminder job that runs every hour and sends each person their recall at the hour they picked. What's left is to put the `site` folder on the web and point sign-in at it. It takes about 10 minutes.

## 1. Publish the site on Netlify (free)

1. Go to **https://app.netlify.com** and log in with GitHub.
2. Click **Add new site → Import an existing project → GitHub**, and allow Netlify access to `mitch-labs/remembrall`.
3. Pick the **remembrall** repo. Netlify reads `netlify.toml`, so leave the build settings as they are (no build command, publish directory `site`) and click **Deploy**.
4. Netlify gives you an address like `https://sparkly-otter-123abc.netlify.app`.
5. Optional: in **Site configuration → Change site name**, rename it to something like `remembrall-mitch` so the address is `https://remembrall-mitch.netlify.app`.

Every push to the `main` branch redeploys the site automatically.

Copy that address. You need it in the next step.

## 2. Point sign-in at your site

Open https://supabase.com/dashboard and choose the **Remembrall** project.

1. Go to **Authentication → URL Configuration**.
   - Set **Site URL** to your Netlify address.
   - Under **Redirect URLs**, add the same address with `/**` on the end, for example `https://remembrall-mitch.netlify.app/**`.
2. Go to **Authentication → Email Templates → Magic Link** and replace the message body with this, so the email also contains a code. iPhone home-screen apps need the code, because a link opens in Safari instead of the app.

   ```html
   <h2>Your Remembrall sign-in</h2>
   <p>Enter this code in the app:</p>
   <p style="font-size:28px;letter-spacing:4px"><strong>{{ .Token }}</strong></p>
   <p>Or tap this link on the same device: <a href="{{ .ConfirmationURL }}">Sign in to Remembrall</a></p>
   ```

   Set the subject to `Your Remembrall code`.

## 3. Try it

- **Desktop (Chrome or Edge):** open your address, sign in with your email, then click **Install Remembrall** (or the install icon in the address bar).
- **Android:** open it in Chrome, sign in, and tap **Install** or **Add to Home screen**.
- **iPhone or iPad:** open it in **Safari**, tap **Share → Add to Home Screen**, then open Remembrall *from the home screen* and sign in there with the emailed code. Reminders only work on iPhone from the home-screen app (iOS 16.4 or later).

Then, in the app, switch on **Remind me every day**, pick a time, allow notifications, and tap **Send a test now**.

## 4. Before you invite other people

- **Email limits:** Supabase's built-in email sender is meant for testing and only sends a few sign-in emails per hour. Before sharing widely, connect your own email sender in **Authentication → Emails → SMTP Settings**. Resend, Brevo and Postmark all have free tiers.
- **Your address for push services:** push services ask for a contact URL. It's currently set to `https://remembrall.netlify.app`. Send me your real Netlify address and I'll update it, or run this in **SQL Editor**:

  ```sql
  update private.config set value = 'https://YOUR-SITE.netlify.app' where key = 'vapid_subject';
  ```

- **Test account:** there is one leftover test account, `test-remembrall@example.com`, from checking the reminder job. It has no devices and its reminders are off. You can delete it in **Authentication → Users**.

## Updating the app later

Change files in `site` and push to `main`. Netlify redeploys on its own, and installed apps pick up the new version the next time they're opened.

## What's in the box

- `site/`: the app (HTML, CSS, JavaScript, icons, manifest and service worker). Netlify publishes this folder.
- `supabase/functions/daily-recall/`: the reminder function (already deployed).
- `supabase/schema.sql`: the database tables and privacy rules (already applied). Each person can only ever see their own entries.
