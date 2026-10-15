# Solo Parent Portal

A comprehensive web portal designed for the application, verification, and management of Solo Parent ID cards in accordance with RA 11861. The system features a public applicant portal for document submission and an administrative dashboard for CSWDD personnel to process, review, and approve applications.

## System Architecture

The project is structured as a split full-stack application:

- **Frontend (`/frontend`)**: A modern Single Page Application (SPA) built with React, Vite, Tailwind CSS, and shadcn/ui components.
- **Backend (`/backend`)**: A robust REST API built with Laravel (PHP 8+).
- **Database**: PostgreSQL (hosted on Supabase).
- **Storage**: AWS S3 compatible storage (via Supabase Storage) for secure document uploads.

## Prerequisites

- **Node.js** (v18 or higher)
- **PHP** (v8.2 or higher)
- **Composer** (for Laravel dependencies)
- **PostgreSQL** (or a Supabase project)

## Getting Started

### 1. Backend Setup (Laravel)
Open a terminal and navigate to the `backend` folder:
```bash
cd backend
composer install
copy .env.example .env
php artisan key:generate
```
*Ensure your `.env` is configured with your database and storage credentials.*
To start the backend server:
```bash
php artisan serve --port=8080
```

### 2. Frontend Setup (React/Vite)
Open a new terminal and navigate to the `frontend` folder:
```bash
cd frontend
npm install
```
*Ensure your `frontend/.env` points to the Laravel backend (e.g., `VITE_BACKEND_URL=http://localhost:8080/api`).*
To start the frontend development server:
```bash
npm run dev
```

## Features
- **Applicant Portal**: Solo parents can submit applications, upload documentary requirements, complete their profile, and track their application status dynamically.
- **Admin Dashboard**: CSWDD administrators can review documents, approve or disqualify applicants, generate ID cards (PDFs), and view system analytics.
- **Automated Notifications**: In-app notifications for status changes and automated daily cron jobs for ID renewal reminders.
>>>>>>> f685886 (feat: initial commit of Solo Parent Portal System with technical audit and QA documentation)
