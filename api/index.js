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

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role = 'student', department } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const existing = await db.users.getByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already exists' });
    
    const passwordHash = bcrypt.hashSync(password, 10);
    const userId = await db.users.create(name, email, passwordHash, role, department);
    
    const token = jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '7d' });
    const user = await db.users.getById(userId);

    res.json({ 
      message: 'User created', 
      userId, 
      token,
      user: user && (({ password_hash, ...rest }) => rest)(user)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const user = await db.users.getByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    
    const passwordMatch = bcrypt.compareSync(password, user.password_hash);
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
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

app.get('/api/users', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const users = await db.users.getAll();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/lecturers', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const lecturers = await db.users.getByRole('lecturer');
    res.json(lecturers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:id', verifyToken, async (req, res) => {
  try {
    const requestedId = parseInt(req.params.id, 10);
    if (req.userRole !== 'admin' && req.userId !== requestedId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const user = await db.users.getById(requestedId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const { password_hash, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const existing = await db.users.getByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already exists' });
    
    const passwordHash = bcrypt.hashSync(password, 10);
    const userId = await db.users.create(name, email, passwordHash, role, department);
    const user = await db.users.getById(userId);

    const { password_hash, ...userWithoutPassword } = user;
    res.json({ message: 'User created', userId, user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', verifyToken, async (req, res) => {
  try {
    const requestedId = parseInt(req.params.id, 10);
    if (req.userId !== requestedId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Cannot update other users' });
    }
    
    const { name, department } = req.body;
    await db.users.update(requestedId, name, department);
    const user = await db.users.getById(requestedId);
    const { password_hash, ...userWithoutPassword } = user;
    res.json({ message: 'User updated', user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    await db.users.delete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ COURSES ROUTES ============

app.get('/api/courses', async (req, res) => {
  try {
    const courses = await db.courses.getAll();
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/courses/:id', verifyToken, async (req, res) => {
  try {
    const courseId = parseInt(req.params.id, 10);
    const course = await db.courses.getById(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    
    const materials = await db.materials.getByCourse(courseId);
    const students = await db.enrollments.getCourseLists(courseId);
    const lecturer = await db.users.getById(course.lecturer_id);
    
    const { password_hash, ...lecturerSafe } = lecturer || {};
    res.json({ ...course, materials, students, lecturer: lecturerSafe });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/courses', verifyToken, async (req, res) => {
  try {
    const { title, code, description, lecturerId } = req.body;
    if (!title || !code) return res.status(400).json({ error: 'Title and code required' });

    if (req.userRole !== 'admin' && req.userRole !== 'lecturer') {
      return res.status(403).json({ error: 'Only admin or lecturer can create courses' });
    }

    const ownerId = req.userRole === 'admin' ? parseInt(lecturerId, 10) : req.userId;
    if (req.userRole === 'admin' && (!ownerId || Number.isNaN(ownerId))) {
      return res.status(400).json({ error: 'lecturerId is required for admin course creation' });
    }

    const courseId = await db.courses.create(title, code, description, ownerId);
    const course = await db.courses.getById(courseId);
    res.json({ message: 'Course created', courseId, course });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/courses/:id', verifyToken, async (req, res) => {
  try {
    const courseId = parseInt(req.params.id, 10);
    const course = await db.courses.getById(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (req.userRole !== 'admin' && course.lecturer_id !== req.userId) {
      return res.status(403).json({ error: 'Only course lecturer or admin can update' });
    }

    const { title, description } = req.body;
    await db.courses.update(courseId, title, description);
    const updated = await db.courses.getById(courseId);
    res.json({ message: 'Course updated', course: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/courses/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    await db.courses.delete(req.params.id);
    res.json({ message: 'Course deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ MATERIALS ROUTES ============

app.get('/api/materials', async (req, res) => {
  try {
    const materials = await db.materials.getAll();
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/materials/course/:courseId', async (req, res) => {
  try {
    const materials = await db.materials.getByCourse(req.params.courseId);
    res.json(materials);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/materials', verifyToken, requireRole('lecturer'), async (req, res) => {
  try {
    const { title, type, fileUrl, courseId } = req.body;
    if (!title || !type || !courseId) {
      return res.status(400).json({ error: 'Title, type, and courseId required' });
    }
    
    const course = await db.courses.getById(courseId);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (course.lecturer_id !== req.userId) {
      return res.status(403).json({ error: 'Only course lecturer can upload materials' });
    }
    
    const materialId = await db.materials.create(title, type, fileUrl, courseId, req.userId);
    const material = await db.materials.getById(materialId);
    res.json({ message: 'Material uploaded', materialId, material });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/materials/:id', verifyToken, requireRole('lecturer'), async (req, res) => {
  try {
    const material = await db.materials.getById(req.params.id);
    if (!material) return res.status(404).json({ error: 'Material not found' });
    if (material.uploaded_by !== req.userId) {
      return res.status(403).json({ error: 'Only uploader can delete' });
    }
    
    await db.materials.delete(req.params.id);
    res.json({ message: 'Material deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ REPOSITORY ROUTES ============

app.get('/api/repository', async (req, res) => {
  try {
    const { q, category } = req.query;
    if (q || category) {
      const items = await db.repository.searchApproved(q, category);
      return res.json(items);
    }
    const items = await db.repository.getApproved();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/repository/mine', verifyToken, async (req, res) => {
  try {
    const items = await db.repository.getByAuthor(req.userId);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/repository/pending', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const items = await db.repository.getPending();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/repository', verifyToken, async (req, res) => {
  try {
    const { title, abstract, fileUrl, category } = req.body;
    if (!title || !category) {
      return res.status(400).json({ error: 'Title and category required' });
    }
    
    const itemId = await db.repository.create(title, abstract, fileUrl, category, req.userId);
    const item = await db.repository.getById(itemId);
    res.json({ message: 'Repository item created', itemId, item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/repository/:id/approve', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    await db.repository.approve(req.params.id);
    const item = await db.repository.getById(req.params.id);
    res.json({ message: 'Repository item approved', item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/repository/:id', verifyToken, async (req, res) => {
  try {
    const item = await db.repository.getById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Repository item not found' });
    if (item.author_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Cannot delete other users items' });
    }
    
    await db.repository.reject(req.params.id);
    res.json({ message: 'Repository item deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STAFF DEVELOPMENT ROUTES ============

app.get('/api/staff-dev', verifyToken, async (req, res) => {
  try {
    if (req.userRole === 'admin') {
      const items = await db.staffDev.getAll();
      res.json(items);
    } else {
      const items = await db.staffDev.getByUser(req.userId);
      res.json(items);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/staff-dev', verifyToken, async (req, res) => {
  try {
    const { trainingTitle, date, status, notes, userId } = req.body;
    if (!trainingTitle || !date) {
      return res.status(400).json({ error: 'Title and date required' });
    }
    
    const targetUserId = userId && req.userRole === 'admin' ? userId : req.userId;
    
    const itemId = await db.staffDev.create(targetUserId, trainingTitle, date, status, notes);
    const item = await db.staffDev.getById(itemId);
    res.json({ message: 'Staff development record created', itemId, item });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/staff-dev/:id', verifyToken, async (req, res) => {
  try {
    const item = await db.staffDev.getById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Record not found' });
    if (item.user_id !== req.userId && req.userRole !== 'admin') {
      return res.status(403).json({ error: 'Cannot update other users records' });
    }
    
    const { status, notes } = req.body;
    await db.staffDev.update(req.params.id, status, notes);
    const updated = await db.staffDev.getById(req.params.id);
    res.json({ message: 'Record updated', item: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ENROLLMENTS ROUTES ============

app.get('/api/enrollments/my-courses', verifyToken, async (req, res) => {
  try {
    const courses = await db.enrollments.getStudentCourses(req.userId);
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/enrollments', verifyToken, async (req, res) => {
  try {
    const { courseId } = req.body;
    if (!courseId) return res.status(400).json({ error: 'courseId required' });
    
    await db.enrollments.enroll(req.userId, courseId);
    res.json({ message: 'Enrolled successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/enrollments/:courseId', verifyToken, async (req, res) => {
  try {
    await db.enrollments.unenroll(req.userId, req.params.courseId);
    res.json({ message: 'Unenrolled successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ STATS ROUTES ============

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.stats.getRecentStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats/growth', async (req, res) => {
  try {
    const growth = await db.stats.getUserGrowth();
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

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`🚀 SGES HDRRC API running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`📊 Landing page: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`🎯 App dashboard: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/app`);
    console.log(`📡 API health: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/api/health`);
  });
}

module.exports = app;
