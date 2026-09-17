# CampusArena

CampusArena is a comprehensive Campus Competition Tool designed to simplify the organization, management, and participation in various campus events and competitions.

## 🚀 Live Demo
[View Live on Vercel](https://campus-arena-five.vercel.app/)

## 🌟 Features
- **Role-based Dashboards:** Dedicated experiences for Students, Organizers, Reviewers, Mentors, and Sponsors.
- **Event Registration:** Seamless registration flow for competitions.
- **Team Management:** Create teams, manage members, and join with PINs.
- **Dark Mode Support:** Fully featured dark mode implementation across the app.
- **Real-time Updates:** Stay informed about competition deadlines and statuses.

## 🛠️ Built With
- **Frontend:** React, Vite, Tailwind CSS, shadcn/ui, framer-motion
- **Backend:** Node.js, Express
- **Language:** TypeScript

## ⚙️ Running Locally
1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and set `DATABASE_URL` to your PostgreSQL connection string.
4. Run the development server: `npm run dev`
5. The application will be available at `http://localhost:5173`

## PostgreSQL persistence

`DATABASE_URL` is required for the API server. On its first connection, CampusArena creates the PostgreSQL schema and imports the existing `server/data/db.json` data once. After that, PostgreSQL stores all platform records—including users, profiles, competition configuration, teams, payments, submissions, notifications, and certificates. Account preferences are stored separately and restored after sign-in; the current theme preference is the first setting wired to this flow.

## Demo accounts

Use the **Password** sign-in method with the password `Campus@2026`:

| Workspace | Email |
| --- | --- |
| Student | `aarav@campus.edu` |
| Organizer | `organizer@campus.edu` |
| Faculty | `faculty@campus.edu` |
| Judge | `judge@campus.edu` |
| Admin | `admin@campus.edu` |

These accounts are intended for the public demo only. Set `DEMO_CREDENTIALS_ENABLED=false` in a non-demo deployment.

## Administrator access and real OTP delivery

- The platform-admin login ID is `arnavgoel1206@gmail.com`. That exact email is the only login that receives the platform-admin role after a successful OTP check. You may override it with `PLATFORM_ADMIN_EMAIL` in private deployment settings.
- Configure `FAST2SMS_KEY` to send real OTPs to Indian mobile numbers. Configure `GMAIL_USER` and `GMAIL_PASS` to send email OTPs. If either delivery service is unavailable, the app refuses authentication rather than exposing or generating codes in the browser.
- On a user's first sign-in, CampusArena verifies an OTP and asks them to create a password. Later they may sign in using that password or choose an OTP instead.
- Set a long, random `AUTH_SESSION_SECRET` before deployment. It signs the administrator session used by the form builder, notification centre, audit log, metrics, and dispute-resolution APIs.
- The new admin subpages are available at `/admin/forms` and `/admin/notifications` after a platform-admin login.
