# School Management System

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-blue.svg)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-orange.svg)](https://www.sqlite.org/)

A role-based school management portal for students, teachers, attendance, exams, fees, library resources, events, and notifications.

## Features

- Role-based access: `admin`, `staff`, `teacher`, `student`, `parent`
- Student and teacher management
- Class, course, and subject management
- Attendance tracking (daily and period-based)
- Exam creation and result entry
- Fee structure and payment records
- Library catalog, issue/return, and requests
- Events, notifications, and guidance records
- Profile management and password changes

## Tech Stack

- Runtime: Node.js 18+
- Framework: Express 4.x
- Database: SQLite3
- Views: EJS + `express-ejs-layouts`
- Auth/session: `express-session` + `connect-sqlite3`
- Security: CSRF middleware, session hardening, security headers

## Requirements

- Node.js `>=18`
- npm

## Quick Start

```bash
git clone <repository-url>
cd school-management-system
npm install
```

Create `.env` in the project root:

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=replace-with-a-long-random-string
DB_PATH=./student_management.db

# Optional admin seed account
SEED_ADMIN_USERNAME=admin
SEED_ADMIN_PASSWORD=ChangeMe123!
SEED_ADMIN_EMAIL=admin@school.edu
SEED_ADMIN_FIRST_NAME=System
SEED_ADMIN_LAST_NAME=Administrator
```

Run the app:

```bash
npm run dev
# or
npm start
```

App URL: `http://localhost:3000`

## Scripts

- `npm run dev` - start with nodemon
- `npm start` - start in normal mode
- `npm test` - run Node test files in `test/*.test.js`

## Authentication Notes

- Login URL: `/auth/login`
- `/auth/register` currently exists as a placeholder route and is not the primary user creation flow.
- Common redirects after login:
  - `admin` -> `/dashboard`
  - `staff` -> `/dashboard`
  - `teacher` -> `/teacher/dashboard`
  - `student` -> `/student/dashboard`
  - `parent` -> `/parent/dashboard`

Default credentials when created via admin/staff flows:

- Student (`/students/add`)
  - Username: `admission_number`
  - Password: `date_of_birth` (or `admission_number` if DOB is missing)
- Teacher (`/teachers/add`)
  - Username: `employee_number`
  - Password: `hire_date` (`YYYY-MM-DD`)

Users should change passwords after first login at `/profile/change-password`.

## Main Route Prefixes

- `/auth`
- `/dashboard`
- `/students`
- `/student`
- `/teachers`
- `/teacher`
- `/classes`
- `/courses`
- `/subjects`
- `/attendance`
- `/exams`
- `/fees`
- `/library`
- `/events`
- `/guidance`
- `/notifications`
- `/admin`
- `/profile`
- `/parent`

## Database

On startup, `initializeDatabase()` creates missing tables and baseline defaults (department, class, subject). If `SEED_ADMIN_PASSWORD` is set, an admin seed account is created.

Default DB file: `./student_management.db`

## Health Endpoint

- `GET /health` returns app status and attendance scheduler state.

## Troubleshooting

- If login fails, verify username/password format and role.
- If session expires, sign in again and ensure cookies are enabled.
- If CSRF errors appear, reload the page and submit again.
- If uploads fail, ensure `public/uploads/` exists and is writable.
