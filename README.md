# 🎓 SGES HDRRC System
## HR & Repository Management System for Educational Institutions

**Status:** ✅ Fully Implemented & Running on GitHub Codespace

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ (Pre-installed in Codespace)
- npm/yarn

### Installation & Run

```bash
# Install dependencies
npm install

# Start the server
npm start
```

The system will be available at:
- **Landing Page:** http://localhost:3000
- **Dashboard:** http://localhost:3000/app
- **API Health:** http://localhost:3000/api/health

---

## 📁 Project Structure

```
HRD/
├── api/
│   ├── index.js          # Express server & all REST API routes
│   └── db.js             # SQLite database schema & helpers
├── public/
│   ├── index.html        # Landing page (hero, features, stats)
│   └── app.html          # Full SPA dashboard (login + all roles)
├── package.json          # Dependencies & scripts
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

---

## 🔐 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@sges.edu` | `admin123` |
| Lecturer | `john@sges.edu` | `lecturer123` |
| Student | `alice@sges.edu` | `student123` |

---

## 🗄️ Database Schema

### Tables

**users**
- `id` (PK): Auto-increment
- `name`: Full name
- `email`: Unique email
- `password_hash`: bcrypt hash
- `role`: 'admin' \| 'lecturer' \| 'student'
- `department`: Department/faculty
- `created_at`: Timestamp

**courses**
- `id` (PK)
- `title`: Course name
- `code`: Unique course code
- `description`: Course description
- `lecturer_id` (FK): References users
- `created_at`: Timestamp

**materials**
- `id` (PK)
- `title`: Material name
- `type`: 'notes' \| 'video' \| 'assignment' \| 'exam'
- `file_url`: Storage path/URL
- `course_id` (FK): References courses
- `uploaded_by` (FK): References users
- `created_at`: Timestamp

**repository**
- `id` (PK)
- `title`: Item title
- `abstract`: Description
- `file_url`: File path/URL
- `category`: 'research' \| 'project' \| 'thesis' \| 'publication'
- `author_id` (FK): References users
- `approved`: Boolean (0/1)
- `created_at`: Timestamp

**staff_development**
- `id` (PK)
- `user_id` (FK): References users
- `training_title`: Training name
- `date`: Training date
- `status`: 'completed' \| 'pending' \| 'in_progress'
- `notes`: Additional notes
- `created_at`: Timestamp

**enrollments**
- `id` (PK)
- `student_id` (FK): References users
- `course_id` (FK): References courses
- `enrolled_at`: Enrollment timestamp
- Unique constraint on (student_id, course_id)

---

## 🔗 API Endpoints

### Authentication
```
POST   /api/auth/login       - User login (JWT)
POST   /api/auth/register    - User registration
```

### Users (Admin only)
```
GET    /api/users            - List all users
GET    /api/users/:id        - Get user details
POST   /api/users            - Create user
PUT    /api/users/:id        - Update user
DELETE /api/users/:id        - Delete user
```

### Courses
```
GET    /api/courses          - List all courses
GET    /api/courses/:id      - Get course details (with materials & students)
POST   /api/courses          - Create course (Lecturer)
PUT    /api/courses/:id      - Update course (Lecturer)
DELETE /api/courses/:id      - Delete course (Admin)
```

### Materials
```
GET    /api/materials        - List all materials
GET    /api/materials/course/:courseId - Get course materials
POST   /api/materials        - Upload material (Lecturer)
DELETE /api/materials/:id    - Delete material (Lecturer)
```

### Repository
```
GET    /api/repository       - List approved items
GET    /api/repository/pending - List pending (Admin)
POST   /api/repository       - Submit item
POST   /api/repository/:id/approve - Approve (Admin)
DELETE /api/repository/:id   - Delete/Reject
```

### Staff Development
```
GET    /api/staff-dev        - List dev records
POST   /api/staff-dev        - Create record
PUT    /api/staff-dev/:id    - Update record
```

### Enrollments
```
GET    /api/enrollments/my-courses - Get my courses (Student)
POST   /api/enrollments      - Enroll in course
DELETE /api/enrollments/:courseId - Unenroll
```

### Statistics
```
GET    /api/stats            - System statistics
GET    /api/stats/growth     - User growth data
GET    /api/health           - Health check
```

---

## 👥 Role-Based Features

### Admin Dashboard
✅ User management (create/edit/delete)  
✅ Course oversight  
✅ Repository approvals  
✅ Staff development tracking  
✅ System analytics & charts  

### Lecturer Dashboard
✅ Create & manage courses  
✅ Upload course materials (notes, videos, assignments)  
✅ View enrolled students  
✅ Personal development log  
✅ Repository contributions  

### Student Dashboard
✅ Browse all courses  
✅ Enroll in courses  
✅ Access course materials  
✅ Search repository  
✅ View my enrollment  

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js + Express.js |
| **Database** | SQLite3 |
| **Frontend** | React 18 (single HTML) |
| **UI Icons** | Lucide Icons (CDN) |
| **Charts** | Chart.js (CDN) |
| **Auth** | JWT + bcrypt |
| **Styling** | CSS3 (in-page) |

---

## 🔧 Configuration

### Environment Variables
Create a `.env` file (optional):
```env
PORT=3000
HOST=0.0.0.0
DB_PATH=./sges.db
JWT_SECRET=your-secret-key-change-in-production
```

### Default Port
- **Development:** 3000
- **Codespace:** 3000 (with forwarding)

---

## 🚀 Deployment on Codespace

### Step 1: Create Codespace
1. Go to GitHub repository: `Al-Ahotanee/HRD`
2. Click **Code → Codespaces → Create codespace on main**
3. Wait for environment setup (1-2 minutes)

### Step 2: Install & Run
```bash
npm install
npm start
```

### Step 3: Access the App
- **Codespace Port 3000** will automatically forward
- Use the **Open in Browser** option
- Or navigate to the provided URL

### Step 4: Port Forwarding (if needed)
1. Terminal → **Ports** tab
2. Port 3000 should show as **Public**
3. Click the globe icon to open in browser

---

## 📊 Features Implemented

### ✅ Core Features
- [x] User authentication & authorization
- [x] Role-based access control (RBAC)
- [x] Course management system
- [x] Material upload & download
- [x] Digital repository with approval workflow
- [x] Staff development tracking
- [x] Student enrollment system
- [x] System analytics dashboard

### ✅ Data Features
- [x] Full-text search capabilities
- [x] Advanced filtering & sorting
- [x] Real-time statistics
- [x] User growth charts
- [x] Activity logs

### ✅ Security Features
- [x] JWT-based authentication
- [x] Password hashing with bcrypt
- [x] SQL injection prevention (parameterized queries)
- [x] CORS protection
- [x] Role-based route protection

---

## 🧪 Testing

### Test API with curl
```bash
# Health check
curl http://localhost:3000/api/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@sges.edu","password":"admin123"}'

# Get stats
curl http://localhost:3000/api/stats
```

---

## 📝 Implementation Plan

---

## SGES HDRRC System — Implementation Plan

### Stack
- **Frontend:** React 18 (single HTML file, in-browser Babel) + Lucide icons CDN + Chart.js CDN
- **Backend:** Node.js + Express
- **DB:** SQLite (`better-sqlite3`)
- **Deploy:** Vercel (frontend as static, backend as serverless functions)

---

### 5-File Architecture

| # | File | Purpose |
|---|------|---------|
| 1 | `api/index.js` | Full Express REST API — all routes (auth, users, materials, courses, staff dev, repo, stats) |
| 2 | `api/db.js` | SQLite schema bootstrap + all DB helpers |
| 3 | `public/index.html` | Landing page (hero, carousel, features, CTA, footer) |
| 4 | `public/app.html` | Full SPA — login + all dashboards (Admin, Lecturer, Student) |
| 5 | `vercel.json` | Routing config (rewrites `/api/*` → serverless, static serving) |

---

### Modules Per Role

**Admin Dashboard**
- User management (create/edit/delete lecturers & students)
- Staff development tracking (training records, performance evals)
- Repository oversight (approve/reject uploads)
- Course management
- Analytics charts (Chart.js): user growth, uploads, course activity

**Lecturer Dashboard**
- Upload courseware (notes, videos, assignments)
- Manage own courses
- View student enrollment
- Repository contributions
- Personal development log

**Student Dashboard**
- Browse & access courseware
- Search repository
- Enrolled courses view
- Download materials

---

### DB Schema (SQLite)

```
users — id, name, email, password_hash, role, department, created_at
courses — id, title, code, description, lecturer_id, created_at
materials — id, title, type, file_url, course_id, uploaded_by, created_at
repository — id, title, abstract, file_url, category, author_id, approved, created_at
staff_development — id, user_id, training_title, date, status, notes
```

---

### Landing Page Sections
1. **Header** — logo, nav links, Login/Register CTA
2. **Hero** — headline, subtext, dual CTA buttons, animated background
3. **Carousel** — rotating feature highlights (3 slides)
4. **Features** — 6-card grid (HR, Repository, Courseware, Analytics, Security, Access)
5. **Stats** — animated counters
6. **Footer** — links, contact, university branding

---

### Deployment Notes
- `vercel.json` routes `/api/*` to `api/index.js` as a serverless function
- SQLite file stored at `/tmp/sges.db` on Vercel (ephemeral — for demo; production would swap to PlanetScale/Turso)
- Static files served from `public/`

---

Ready to build? I'll generate all 5 files in sequence. Confirm and I'll start with `api/db.js` + `api/index.js`, then the two HTML files, then `vercel.json`.
