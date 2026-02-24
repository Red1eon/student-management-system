# 🎓 School Management System

A full-featured School Management Portal built with **Node.js + Express.js** to manage students, teachers, academics, and administration in one place.

> 🚧 Status: **Under Development**  
> Core modules are stable. Additional enhancements and optimizations are ongoing.

---

## 📖 Project Objective

The objective of this system is to digitalize school administration processes and reduce manual paperwork by providing a centralized web-based management platform.

---

## 🚀 Tech Stack

### Backend
- Node.js
- Express.js
- SQLite3

### Frontend
- EJS
- Tailwind CSS

### Libraries & Tools
- express-session
- connect-sqlite3
- express-validator
- method-override
- i18n
- multer
- dotenv

---

## ✨ Current Features

### 🔐 Authentication & Authorization
- Multi-role login system (Admin, Teacher, Student, Parent, Staff)
- Role-based route protection
- Session-based authentication
- CSRF protection and security middleware

### 👩‍🎓 Student Management
- Add, edit, delete students
- Student profile and class mapping
- Student detail pages

### 👨‍🏫 Teacher Management
- Add and manage teachers
- Assign subjects to teachers
- Teacher dashboard with academic tools

### 🏫 Class & Subject Management
- Create and update classes
- Manage subjects
- Promote students between classes
- Timetable support

### 📅 Attendance System
- Mark attendance by class/date
- Student-wise attendance reports
- Teacher attendance workflows

### 📝 Exams & Results
- Create exams
- Enter marks and results
- Student and parent result views

### 💰 Fee Management
- Fee structure setup
- Record payments
- Receipt generation
- Student fee history tracking

### 📚 Library System
- Manage books
- Issue and return books
- Book request and approval workflow
- User borrowing history

### 🎉 Events Management
- Create and update events
- Event calendar and detailed views

### 🔔 Notifications
- Create notices
- User notification inbox
- Mark-as-read functionality

### 👨‍👩‍👧 Parent Portal
- View linked children
- Attendance tracking
- Fee and result visibility

### 🌐 Multi-language Support
- English 🇬🇧
- Japanese 🇯🇵

---

## ⚙️ Installation

1. Clone the repository

```bash
git clone https://github.com/Red1eon/student-management-system.git

## Installation
1. Clone repository
2. Run `npm install`
3. Copy `.env.example` to `.env` and configure
4. Run `npm run dev`

## Database
SQLite database auto-initializes on first run with all required tables.
