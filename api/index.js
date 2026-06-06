const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const db = require('./db');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';

// Verification middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (role) => (req, res, next) => {
  if (req.userRole !== role) {
    return res.status(403).json({ error: `Requires ${role} role` });
  }
  next();
};

// ============ AUTH ROUTES ============

app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password, role = 'student', department } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const existing = db.users.getByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already exists' });
    
    const passwordHash = bcrypt.hashSync(password, 10);
    const userId = db.users.create(name, email, passwordHash, role, department);
    
    const token = jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ 
      message: 'User created', 
      userId, 
      token,
      user: db.users.getById(userId)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const user = db.users.getByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const passwordMatch = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    // Exclude password from response
    const { password_hash, ...userWithoutPassword } = user;
    res.json({ 
      message: 'Login successful', 
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ USERS ROUTES ============

app.get('/api/users', verifyToken, requireRole('admin'), (req, res) => {
  try {
    const users = db.users.getAll();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:id', verifyToken, (req, res) => {
  try {
    const user = db.users.getById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password_hash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', verifyToken, requireRole('admin'), (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const existing = db.users.getByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already exists' });
    
    const passwordHash = bcrypt.hashSync(password, 10);
    const userId = db.users.create(name, email, passwordHash, role, department);
    
    res.json({ message: 'User created', userId, user: db.users.getById(userId) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', verifyToken, (req, res) => {
  try {
    if (req.userId !== parseInt(req.params.id) && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Cannot update other users' });
    }
    
    const { name, department } = req.body;
    db.users.update(req.params.id, name, department);
    res.json({ message: 'User updated', user: db.users.getById(req.params.id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', verifyToken, requireRole('admin'), (req, res) => {
  try {
    db.users.delete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ COURSES ROUTES ============

app.get('/api/courses', (req, res) => {
  try {
    const courses = db.courses.getAll();
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/courses/:id', (req, res) => {
  try {
    const course = db.courses.getById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    
    const materials = db.materials.getByCourse(req.params.id);
    const students = db.enrollments.getCourseLists(req.params.id);
    const lecturer = db.users.getById(course.lecturer_id);
    
    res.json({ ...course, materials, students, lecturer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/courses', verifyToken, requireRole('lecturer'), (req, res) => {
  try {
    const { title, code, description } = req.body;
    if (!title || !code) return res.status(400).json({ error: 'Title and code required' });
    
    const courseId = db.courses.create(title, code, description, req.userId);
    res.json({ message: 'Course created', courseId, course: db.courses.getById(courseId) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/courses/:id', verifyToken, requireRole('lecturer'), (req, res) => {
  try {
    const course = db.courses.getById(req.params.id);
    if (course.lecturer_id !== req.userId) {
      return res.status(403).json({ error: 'Only course lecturer can update' });
    }
    
    const { title, description } = req.body;
    db.courses.update(req.params.id, title, description);
    res.json({ message: 'Course updated', course: db.courses.getById(req.params.id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/courses/:id', verifyToken, requireRole('admin'), (req, res) => {
  try {
    db.courses.delete(req.params.id);
    res.json({ message: 'Course deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ MATERIALS ROUTES ============

app.get('/api/materials', (req, res) => {
  try {
    const materials = db.materials.getAll();
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/materials/course/:courseId', (req, res) => {
  try {
    const materials = db.materials.getByCourse(req.params.courseId);
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/materials', verifyToken, requireRole('lecturer'), (req, res) => {
  try {
    const { title, type, fileUrl, courseId } = req.body;
    if (!title || !type || !courseId) {
      return res.status(400).json({ error: 'Title, type, and courseId required' });
    }
    
    const course = db.courses.getById(courseId);
    if (course.lecturer_id !== req.userId) {
      return res.status(403).json({ error: 'Only course lecturer can upload materials' });
    }
    
    const materialId = db.materials.create(title, type, fileUrl, courseId, req.userId);
    res.json({ message: 'Material uploaded', materialId, material: db.materials.getById(materialId) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/materials/:id', verifyToken, requireRole('lecturer'), (req, res) => {
  try {
    const material = db.materials.getById(req.params.id);
    if (material.uploaded_by !== req.userId) {
      return res.status(403).json({ error: 'Only uploader can delete' });
    }
    
    db.materials.delete(req.params.id);
    res.json({ message: 'Material deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ REPOSITORY ROUTES ============

app.get('/api/repository', (req, res) => {
  try {
    const items = db.repository.getApproved();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/repository/pending', verifyToken, requireRole('admin'), (req, res) => {
  try {
    const items = db.repository.getPending();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/repository', verifyToken, (req, res) => {
  try {
    const { title, abstract, fileUrl, category } = req.body;
    if (!title || !category) {
      return res.status(400).json({ error: 'Title and category required' });
    }
    
    const itemId = db.repository.create(title, abstract, fileUrl, category, req.userId);
    res.json({ message: 'Repository item created', itemId, item: db.repository.getById(itemId) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/repository/:id/approve', verifyToken, requireRole('admin'), (req, res) => {
  try {
    db.repository.approve(req.params.id);
    res.json({ message: 'Repository item approved', item: db.repository.getById(req.params.id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/repository/:id', verifyToken, (req, res) => {
  try {
    const item = db.repository.getById(req.params.id);
    if (item.author_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Cannot delete other users items' });
    }
    
    db.repository.reject(req.params.id);
    res.json({ message: 'Repository item deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STAFF DEVELOPMENT ROUTES ============

app.get('/api/staff-dev', verifyToken, (req, res) => {
  try {
    if (req.userRole === 'admin') {
      const items = db.staffDev.getAll();
      res.json(items);
    } else {
      const items = db.staffDev.getByUser(req.userId);
      res.json(items);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/staff-dev', verifyToken, (req, res) => {
  try {
    const { trainingTitle, date, status, notes, userId } = req.body;
    if (!trainingTitle || !date) {
      return res.status(400).json({ error: 'Title and date required' });
    }
    
    // Admin can create for others, lecturers only for themselves
    const targetUserId = userId && req.userRole === 'admin' ? userId : req.userId;
    
    const itemId = db.staffDev.create(targetUserId, trainingTitle, date, status, notes);
    res.json({ message: 'Staff development record created', itemId, item: db.staffDev.getById(itemId) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/staff-dev/:id', verifyToken, (req, res) => {
  try {
    const item = db.staffDev.getById(req.params.id);
    if (item.user_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Cannot update other users records' });
    }
    
    const { status, notes } = req.body;
    db.staffDev.update(req.params.id, status, notes);
    res.json({ message: 'Record updated', item: db.staffDev.getById(req.params.id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ENROLLMENTS ROUTES ============

app.get('/api/enrollments/my-courses', verifyToken, (req, res) => {
  try {
    const courses = db.enrollments.getStudentCourses(req.userId);
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/enrollments', verifyToken, (req, res) => {
  try {
    const { courseId } = req.body;
    if (!courseId) return res.status(400).json({ error: 'courseId required' });
    
    db.enrollments.enroll(req.userId, courseId);
    res.json({ message: 'Enrolled successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/enrollments/:courseId', verifyToken, (req, res) => {
  try {
    db.enrollments.unenroll(req.userId, req.params.courseId);
    res.json({ message: 'Unenrolled successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STATS ROUTES ============

app.get('/api/stats', (req, res) => {
  try {
    const stats = db.stats.getRecentStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats/growth', (req, res) => {
  try {
    const growth = db.stats.getUserGrowth();
    res.json(growth);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ HEALTH CHECK ============

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SGES HDRRC API running' });
});

// ============ SERVE STATIC ============

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/app', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/app.html'));
});

// ============ ERROR HANDLING ============

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ============ START SERVER ============

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 SGES HDRRC API running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`📊 Landing page: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`🎯 App dashboard: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/app`);
  console.log(`📡 API health: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/api/health`);
});

module.exports = app;
