
# CrossFit Timer

A responsive web application developed as a technical take-home assignment for **Yaqbot**.

CrossFit Timer allows coaches to configure workouts on a desktop computer and run them on a mobile device using a shareable link or QR code.

## Features

- **For Time:** Count-up timer with a configurable time cap.
- **AMRAP:** Countdown timer with a configurable workout duration.
- **EMOM:** Interval timer with configurable rounds and durations.
- **Workout Sharing:** Transfer workouts between devices using links and QR codes.
- **Mobile Timer:** Fullscreen-friendly interface with large, readable numbers.
- **Audio Cues:** Sound notifications for workout starts, transitions, and completion.
- **Screen Wake Lock:** Attempts to keep the display active during workouts on supported devices.
- **Google Authentication:** Restricted coach access using verified `@yaqbot.com` Google Workspace accounts.

## Tech Stack

| Frontend | Backend | Infrastructure |
|---|---|---|
| React | Node.js | Vercel |
| TypeScript | Express.js | Redis |
| Vite | Google Identity Services | GitHub |
| Tailwind CSS | Express Session | |

## Architecture

The application uses a React frontend and an Express API.

Coaches authenticate through Google and configure workouts from a protected dashboard. Workout configurations are encoded into shareable URLs, allowing timers to run independently on mobile devices without continuous communication with the server.

Authentication sessions are managed server-side, with Redis providing shared session storage in production.

## Getting Started

Requires **Node.js 22.12+**.

Clone the repository and install dependencies:

```bash
git clone https://github.com/itzGery/CrossFit-Timer.git
cd CrossFit-Timer
npm install
```

Configure the environment variables using the provided `.env.example` files.

Start the development servers in separate terminals:

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

The frontend runs at `http://localhost:5173`.

## Deployment

The application is configured for deployment on **Vercel**, using Vite for the frontend and Vercel Functions for the Express API.

Production authentication requires Google OAuth credentials and a Redis connection.

**Live Demo:** https://crossfit-timer-cyan.vercel.app/

## License

Developed for the Yaqbot internship technical assessment.
