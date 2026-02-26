# School Management System (English / 日本語)

Comprehensive school portal built with Node.js, Express, EJS, and SQLite.

---

## 1. Overview (English)

This project is a role-based school management system.
It supports:
- Admin / Staff operations
- Teacher portal
- Student portal
- Parent portal
- Attendance, exams, fees, library, events, notifications, profile management

The app starts from `app.js`, initializes SQLite tables automatically, then mounts all modules from `routes/`.

---

## 2. Tech Stack

- Backend: Node.js, Express
- Database: SQLite3
- Templating: EJS + express-ejs-layouts
- Auth/session: express-session + connect-sqlite3
- Security: CSRF middleware, login rate limiter, security headers
- File upload: multer (profile photo)

---

## 3. How To Run (English)

### 3.1 Requirements
- Node.js 18+
- npm

### 3.2 Install
```bash
npm install
```

### 3.3 Environment (`.env`)
Recommended:
```env
PORT=3000
SESSION_SECRET=replace-with-long-random-secret
# Optional DB override
# DB_PATH=./student_management.db

# Optional admin seed account
# SEED_ADMIN_PASSWORD=ChangeMe123!
# SEED_ADMIN_USERNAME=admin
# SEED_ADMIN_EMAIL=admin@school.edu
# SEED_ADMIN_FIRST_NAME=System
# SEED_ADMIN_LAST_NAME=Administrator
```

### 3.4 Start
Development:
```bash
npm run dev
```
Production:
```bash
npm start
```

### 3.5 Tests
```bash
npm test
```

App URL: `http://localhost:3000`

---

## 4. Login and Accounts (English)

### 4.1 Login
- URL: `/auth/login`
- Method: username + password
- Redirect after login by role:
  - `admin` -> `/dashboard`
  - `teacher` -> `/teacher/dashboard`
  - `student` -> `/student/dashboard`
  - `parent` -> `/parent/dashboard`
  - other -> `/dashboard`

### 4.2 Important: Register Page
Routes exist (`/auth/register`), but current register view is a placeholder/error page.
For real operations, create users from admin/staff flows (`/students/add`, `/teachers/add`) or admin seed env.

### 4.3 Default Credentials After Creating Users

#### Student creation (`/students/add`)
When admin/staff adds a student:
- Username = `admission_number`
- Password = `date_of_birth` if provided, otherwise `admission_number`

So if DOB is entered as `2010-04-15`, initial password becomes `2010-04-15`.

#### Teacher creation (`/teachers/add`)
When admin/staff adds a teacher:
- Username = `employee_number`
- Password = `hire_date` (format like `YYYY-MM-DD`)

Example: hire date `2024-07-01` => initial password `2024-07-01`.

### 4.4 Change Password
- URL: `/profile/change-password`
- User can change password after first login.

---

## 5. How Links and Navigation Work (English)

### 5.1 Base entry
- `/` checks session and redirects by role.
- If not logged in -> `/auth/login`.

### 5.2 Main module mount points
From `app.js`, route prefixes are:
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
- `/profile`
- `/parent`

### 5.3 Access control
- `requireAuth`: user must be logged in.
- `requireRole([...])`: user must match allowed roles.
- `requireStudentAccess(...)`: allows admin/staff/teacher or owner-safe access for student-linked resources.

---

## 6. Feature Guide (English)

### 6.1 Dashboard
- `/dashboard`
- Admin/staff overview cards and quick links.

### 6.2 Students
- List: `/students`
- Add: `/students/add`
- Detail: `/students/:id`
- Edit: `/students/:id/edit`
- Delete: `/students/:id` (DELETE)

### 6.3 Teachers
- List: `/teachers`
- Add: `/teachers/add`
- Detail: `/teachers/:id`
- Assign subject: `/teachers/:id/assign-subject`

### 6.4 Teacher Portal
- Dashboard: `/teacher/dashboard`
- My classes: `/teacher/my-classes`
- Class students: `/teacher/class/:classId/students`
- Mark attendance: `/teacher/mark-attendance` (redirects into attendance module)
- Attendance report: `/teacher/attendance-report`
- Enter exam results: `/teacher/enter-results/:examId`
- Timetable: `/teacher/my-timetable`

### 6.5 Student Portal
- Dashboard: `/student/dashboard`
- My attendance: `/student/my-attendance`
- My results: `/student/my-results`
- My timetable: `/student/my-timetable`
- My fees: `/student/my-fees`
- My profile: `/student/my-profile`

### 6.6 Parent Portal
- Dashboard: `/parent/dashboard`
- Children: `/parent/my-children`
- Attendance: `/parent/attendance`
- Results: `/parent/results`
- Fees: `/parent/fees`

### 6.7 Classes
- `/classes`
- Add/edit classes, promote students, manage timetable per class.

### 6.8 Courses
- `/courses`
- Admin-only course and fee-plan management.

### 6.9 Subjects
- `/subjects`
- Subject CRUD for admin/staff.

### 6.10 Attendance
- Dashboard: `/attendance`
- Mark attendance: `/attendance/mark`
  - monthly mode and daily+period mode
- Period attendance: `/attendance/period`
- Student attendance view: `/attendance/student/:studentId`
- Reports: `/attendance/report`
- CSV export: `/attendance/report/export`
- Corrections workflow: `/attendance/corrections`
- Risk check: `/attendance/run-risk-check`
- Integrity check: `/attendance/integrity`

### 6.11 Exams
- `/exams`
- Create exam, exam details, enter results, student result view.

### 6.12 Fees
- Dashboard: `/fees`
- Structure: `/fees/structure`
- Add/edit fee: `/fees/add`, `/fees/structure/:feeId/edit`
- Record payments: `/fees/record`
- Receipt: `/fees/receipt/:receiptNumber`
- Per-student fees: `/fees/student/:studentId`

### 6.13 Library
- Dashboard: `/library`
- Books: `/library/books`
- Add books: `/library/books/add`
- Issue/return: `/library/issue`, `/library/return`
- Requests: `/library/requests`
- Student request: `/library/request`
- My books: `/library/my-books`

### 6.14 Events
- List: `/events`
- Calendar: `/events/calendar`
- Create: `/events/create`
- Detail/update: `/events/:id`

### 6.15 Guidance
- Dashboard/list/create: `/guidance`
- Student-specific guidance page is available through guidance routes.

### 6.16 Notifications
- Inbox/list: `/notifications`
- Create: `/notifications/create`
- Mark read / mark all read endpoints available in module.

### 6.17 Profile
- View: `/profile`
- Edit: `/profile/edit`
- Change password: `/profile/change-password`
- Upload photo: `/profile/upload-photo`

---

## 7. Database Behavior (English)

On startup, `initializeDatabase()` automatically:
- Creates tables if missing
- Adds baseline defaults (department/class/subject) if empty
- Optionally seeds an admin user if `SEED_ADMIN_PASSWORD` is set

Main DB file default: `./student_management.db`

---

## 8. Security Notes (English)

- Session-based authentication
- CSRF protection enabled for state-changing requests
- Login rate limiter is enabled on `/auth/login`
- Audit logging exists for important actions (e.g., login, attendance changes)

---

## 9. プロジェクト概要（日本語）

このシステムは、学校運営を一元管理するためのWebアプリです。

対応ロール:
- 管理者（admin）
- 教師（teacher）
- 生徒（student）
- 保護者（parent）
- スタッフ（staff）

主な機能:
- 生徒/教師管理
- クラス・科目・時間割
- 出欠管理（通常・時限別・訂正申請）
- 試験と成績
- 学費管理
- 図書管理
- 行事管理
- 通知
- プロフィール管理

---

## 10. 実行方法（日本語）

### 10.1 必要環境
- Node.js 18以上
- npm

### 10.2 インストール
```bash
npm install
```

### 10.3 `.env` 設定
```env
PORT=3000
SESSION_SECRET=十分に長いランダム文字列
# 任意: DB_PATH=./student_management.db

# 任意: 初期管理者アカウント
# SEED_ADMIN_PASSWORD=任意の初期パスワード
# SEED_ADMIN_USERNAME=admin
# SEED_ADMIN_EMAIL=admin@school.edu
# SEED_ADMIN_FIRST_NAME=System
# SEED_ADMIN_LAST_NAME=Administrator
```

### 10.4 起動
開発モード:
```bash
npm run dev
```
本番モード:
```bash
npm start
```

テスト:
```bash
npm test
```

アクセス先: `http://localhost:3000`

---

## 11. ログイン仕様（日本語）

ログインURL: `/auth/login`

ログイン後の遷移先:
- admin -> `/dashboard`
- teacher -> `/teacher/dashboard`
- student -> `/student/dashboard`
- parent -> `/parent/dashboard`

### ユーザー追加時の初期パスワード

#### 生徒追加（`/students/add`）
- ユーザー名: `admission_number`
- 初期パスワード: `date_of_birth`（入力がある場合）
- `date_of_birth` が空の場合は `admission_number`

例: 生年月日が `2010-04-15` なら初期パスワードは `2010-04-15`

#### 教師追加（`/teachers/add`）
- ユーザー名: `employee_number`
- 初期パスワード: `hire_date`（`YYYY-MM-DD`）

例: 入職日 `2024-07-01` -> 初期パスワード `2024-07-01`

※ 初回ログイン後は `/profile/change-password` で変更してください。

---

## 12. 機能とリンク一覧（日本語）

- ダッシュボード: `/dashboard`
- 生徒管理: `/students`
- 教師管理: `/teachers`
- 教師ポータル: `/teacher/*`
- 生徒ポータル: `/student/*`
- 保護者ポータル: `/parent/*`
- クラス管理: `/classes`
- コース管理: `/courses`
- 科目管理: `/subjects`
- 出欠管理: `/attendance/*`
- 試験管理: `/exams/*`
- 学費管理: `/fees/*`
- 図書管理: `/library/*`
- 行事管理: `/events/*`
- 指導記録: `/guidance/*`
- 通知: `/notifications/*`
- プロフィール: `/profile/*`

ルート `/` はセッション状態を見てロールごとのページへ自動リダイレクトします。

---

## 13. 注意事項

- CSRF保護が有効です。フォーム送信はトークン必須です。
- セッションが切れた場合は再ログインしてください。
- 画像アップロードは `public/uploads/` を使用します。
- DBテーブルは初回起動時に自動作成されます。

---

## 14. License

MIT
