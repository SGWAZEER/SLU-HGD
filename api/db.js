const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

// Use ephemeral SQLite file on deployment, allow DB_PATH override for local development
const dbPath = process.env.DB_PATH || path.join(process.env.TMPDIR || '/tmp', 'sges.db');
const db = new sqlite3.Database(dbPath);

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Promisify database operations
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

const dbExec = (sql) => {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

/**
 * Initialize database schema
 */
async function initializeDatabase() {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'lecturer', 'student')),
      department TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      lecturer_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lecturer_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('notes', 'video', 'assignment', 'exam')),
      file_url TEXT,
      course_id INTEGER NOT NULL,
      uploaded_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS repository (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      abstract TEXT,
      file_url TEXT,
      category TEXT NOT NULL CHECK(category IN ('research', 'project', 'thesis', 'publication')),
      author_id INTEGER NOT NULL,
      approved BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS staff_development (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      training_title TEXT NOT NULL,
      date DATETIME NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('completed', 'pending', 'in_progress')),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(student_id, course_id),
      FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_courses_lecturer ON courses(lecturer_id);
    CREATE INDEX IF NOT EXISTS idx_materials_course ON materials(course_id);
    CREATE INDEX IF NOT EXISTS idx_materials_uploader ON materials(uploaded_by);
    CREATE INDEX IF NOT EXISTS idx_repository_author ON repository(author_id);
    CREATE INDEX IF NOT EXISTS idx_staff_dev_user ON staff_development(user_id);
    CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
    CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
  `;
  
  return dbExec(schema);
}

/**
 * Seed initial data
 */
async function seedDatabase() {
  try {
    const adminExists = await dbGet('SELECT COUNT(*) as count FROM users WHERE role = ?', ['admin']);
    
    if (adminExists && adminExists.count === 0) {
      // Create default admin
      const adminHash = bcrypt.hashSync('admin123', 10);
      await dbRun(
        `INSERT INTO users (name, email, password_hash, role, department)
         VALUES (?, ?, ?, ?, ?)`,
        ['Admin User', 'admin@sges.edu', adminHash, 'admin', 'Administration']
      );
      
      // Create sample lecturer
      const lecturerHash = bcrypt.hashSync('lecturer123', 10);
      const lecturerResult = await dbRun(
        `INSERT INTO users (name, email, password_hash, role, department)
         VALUES (?, ?, ?, ?, ?)`,
        ['Dr. John Doe', 'john@sges.edu', lecturerHash, 'lecturer', 'Computer Science']
      );
      
      // Create sample students
      const studentHash = bcrypt.hashSync('student123', 10);
      await dbRun(
        `INSERT INTO users (name, email, password_hash, role, department)
         VALUES (?, ?, ?, ?, ?)`,
        ['Alice Johnson', 'alice@sges.edu', studentHash, 'student', 'Computer Science']
      );
      
      await dbRun(
        `INSERT INTO users (name, email, password_hash, role, department)
         VALUES (?, ?, ?, ?, ?)`,
        ['Bob Smith', 'bob@sges.edu', studentHash, 'student', 'Computer Science']
      );
      
      // Create sample course
      await dbRun(
        `INSERT INTO courses (title, code, description, lecturer_id)
         VALUES (?, ?, ?, ?)`,
        ['Web Development 101', 'CS101', 'Introduction to web development', lecturerResult.lastID]
      );
    }
  } catch (error) {
    console.log('Seed status:', error.message);
  }
}

/**
 * User queries
 */
const users = {
  getById: (id) => dbGet('SELECT * FROM users WHERE id = ?', [id]),
  getByEmail: (email) => dbGet('SELECT * FROM users WHERE email = ?', [email]),
  getAll: () => dbAll('SELECT id, name, email, role, department, created_at FROM users'),
  getByRole: (role) => dbAll('SELECT * FROM users WHERE role = ?', [role]),
  create: async (name, email, passwordHash, role, department) => {
    const result = await dbRun(
      `INSERT INTO users (name, email, password_hash, role, department)
       VALUES (?, ?, ?, ?, ?)`,
      [name, email, passwordHash, role, department || 'Unassigned']
    );
    return result.lastID;
  },
  update: (id, name, department) => {
    return dbRun('UPDATE users SET name = ?, department = ? WHERE id = ?', [name, department, id]);
  },
  delete: (id) => {
    return dbRun('DELETE FROM users WHERE id = ?', [id]);
  }
};

/**
 * Course queries
 */
const courses = {
  getById: (id) => dbGet('SELECT * FROM courses WHERE id = ?', [id]),
  getAll: () => dbAll('SELECT * FROM courses'),
  getByLecturer: (lecturerId) => dbAll('SELECT * FROM courses WHERE lecturer_id = ?', [lecturerId]),
  create: async (title, code, description, lecturerId) => {
    const result = await dbRun(
      `INSERT INTO courses (title, code, description, lecturer_id)
       VALUES (?, ?, ?, ?)`,
      [title, code, description || '', lecturerId]
    );
    return result.lastID;
  },
  update: (id, title, description) => {
    return dbRun('UPDATE courses SET title = ?, description = ? WHERE id = ?', [title, description, id]);
  },
  delete: (id) => {
    return dbRun('DELETE FROM courses WHERE id = ?', [id]);
  }
};

/**
 * Material queries
 */
const materials = {
  getById: (id) => dbGet('SELECT * FROM materials WHERE id = ?', [id]),
  getByCourse: (courseId) => dbAll('SELECT * FROM materials WHERE course_id = ?', [courseId]),
  getAll: () => dbAll('SELECT * FROM materials ORDER BY created_at DESC'),
  create: async (title, type, fileUrl, courseId, uploadedBy) => {
    const result = await dbRun(
      `INSERT INTO materials (title, type, file_url, course_id, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`,
      [title, type, fileUrl || '', courseId, uploadedBy]
    );
    return result.lastID;
  },
  delete: (id) => {
    return dbRun('DELETE FROM materials WHERE id = ?', [id]);
  }
};

/**
 * Repository queries
 */
const repository = {
  getById: (id) => dbGet('SELECT * FROM repository WHERE id = ?', [id]),
  getAll: () => dbAll('SELECT * FROM repository ORDER BY created_at DESC'),
  getApproved: () => dbAll('SELECT * FROM repository WHERE approved = 1 ORDER BY created_at DESC'),
  getPending: () => dbAll('SELECT * FROM repository WHERE approved = 0 ORDER BY created_at DESC'),
  getByAuthor: (authorId) => dbAll('SELECT * FROM repository WHERE author_id = ?', [authorId]),
  create: async (title, abstract, fileUrl, category, authorId) => {
    const result = await dbRun(
      `INSERT INTO repository (title, abstract, file_url, category, author_id)
       VALUES (?, ?, ?, ?, ?)`,
      [title, abstract || '', fileUrl || '', category, authorId]
    );
    return result.lastID;
  },
  searchApproved: (query, category) => {
    const search = query ? `%${query}%` : '%';
    const categoryFilter = category ? category : '%';
    return dbAll(
      `SELECT * FROM repository
       WHERE approved = 1
         AND (title LIKE ? OR abstract LIKE ? OR category LIKE ?)
         AND category LIKE ?
       ORDER BY created_at DESC`,
      [search, search, search, categoryFilter]
    );
  },
  approve: (id) => {
    return dbRun('UPDATE repository SET approved = 1 WHERE id = ?', [id]);
  },
  reject: (id) => {
    return dbRun('DELETE FROM repository WHERE id = ?', [id]);
  }
};

/**
 * Staff development queries
 */
const staffDev = {
  getById: (id) => dbGet('SELECT * FROM staff_development WHERE id = ?', [id]),
  getByUser: (userId) => dbAll('SELECT * FROM staff_development WHERE user_id = ? ORDER BY date DESC', [userId]),
  getAll: () => dbAll('SELECT sd.*, u.name FROM staff_development sd JOIN users u ON sd.user_id = u.id ORDER BY sd.date DESC'),
  create: async (userId, trainingTitle, date, status, notes) => {
    const result = await dbRun(
      `INSERT INTO staff_development (user_id, training_title, date, status, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, trainingTitle, date, status || 'pending', notes || '']
    );
    return result.lastID;
  },
  update: (id, status, notes) => {
    return dbRun('UPDATE staff_development SET status = ?, notes = ? WHERE id = ?', [status, notes, id]);
  },
  delete: (id) => {
    return dbRun('DELETE FROM staff_development WHERE id = ?', [id]);
  }
};

/**
 * Enrollment queries
 */
const enrollments = {
  getStudentCourses: (studentId) => {
    return dbAll(
      `SELECT c.* FROM courses c
       JOIN enrollments e ON c.id = e.course_id
       WHERE e.student_id = ?
       ORDER BY c.created_at DESC`,
      [studentId]
    );
  },
  getCourseLists: (courseId) => {
    return dbAll(
      `SELECT u.id, u.name, u.email FROM users u
       JOIN enrollments e ON u.id = e.student_id
       WHERE e.course_id = ?
       ORDER BY u.name`,
      [courseId]
    );
  },
  enroll: (studentId, courseId) => {
    return dbRun(
      `INSERT OR IGNORE INTO enrollments (student_id, course_id)
       VALUES (?, ?)`,
      [studentId, courseId]
    );
  },
  unenroll: (studentId, courseId) => {
    return dbRun('DELETE FROM enrollments WHERE student_id = ? AND course_id = ?', [studentId, courseId]);
  }
};

/**
 * Statistics queries
 */
const stats = {
  getUserCount: async () => {
    const result = await dbGet('SELECT COUNT(*) as count FROM users');
    return result ? result.count : 0;
  },
  getUserCountByRole: async (role) => {
    const result = await dbGet('SELECT COUNT(*) as count FROM users WHERE role = ?', [role]);
    return result ? result.count : 0;
  },
  getCourseCount: async () => {
    const result = await dbGet('SELECT COUNT(*) as count FROM courses');
    return result ? result.count : 0;
  },
  getMaterialCount: async () => {
    const result = await dbGet('SELECT COUNT(*) as count FROM materials');
    return result ? result.count : 0;
  },
  getRepositoryCount: async () => {
    const result = await dbGet('SELECT COUNT(*) as count FROM repository WHERE approved = 1');
    return result ? result.count : 0;
  },
  getRecentStats: async () => {
    const userCount = await dbGet('SELECT COUNT(*) as count FROM users');
    const studentCount = await dbGet('SELECT COUNT(*) as count FROM users WHERE role = ?', ['student']);
    const lecturerCount = await dbGet('SELECT COUNT(*) as count FROM users WHERE role = ?', ['lecturer']);
    const courseCount = await dbGet('SELECT COUNT(*) as count FROM courses');
    const materialCount = await dbGet('SELECT COUNT(*) as count FROM materials');
    const repoCount = await dbGet('SELECT COUNT(*) as count FROM repository WHERE approved = 1');
    const pendingCount = await dbGet('SELECT COUNT(*) as count FROM repository WHERE approved = 0');
    
    return {
      users: userCount ? userCount.count : 0,
      students: studentCount ? studentCount.count : 0,
      lecturers: lecturerCount ? lecturerCount.count : 0,
      courses: courseCount ? courseCount.count : 0,
      materials: materialCount ? materialCount.count : 0,
      repositoryItems: repoCount ? repoCount.count : 0,
      pendingApprovals: pendingCount ? pendingCount.count : 0,
    };
  },
  getUserGrowth: () => {
    return dbAll(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM users
       GROUP BY DATE(created_at)
       ORDER BY date DESC
       LIMIT 30`
    );
  }
};

// Initialize on module load
(async () => {
  try {
    await initializeDatabase();
    await seedDatabase();
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
  }
})();

module.exports = {
  db,
  users,
  courses,
  materials,
  repository,
  staffDev,
  enrollments,
  stats
};
