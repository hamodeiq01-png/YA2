const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'ya2_reading_tracker_super_secret_key_12345';

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'الرجاء تسجيل الدخول أولاً' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'جلسة العمل منتهية أو غير صالحة' });
    }
    req.user = user;
    next();
  });
}

// Teacher Role Authorization Middleware
function requireTeacher(req, res, next) {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'غير مصرح بالدخول، هذه الصفحة مخصصة للمعلم فقط' });
  }
  next();
}

// Student Role Authorization Middleware
function requireStudent(req, res, next) {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'غير مصرح بالدخول، هذه الصفحة مخصصة للطالب فقط' });
  }
  next();
}

// --- AUTHENTICATION APIS ---

// Register Teacher
app.post('/api/auth/register-teacher', (req, res) => {
  const { fullName, username, password } = req.body;
  
  if (!fullName || !username || !password) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }

  try {
    const user = db.createUser(fullName, username, password, 'teacher');
    res.status(201).json({ message: 'تم تسجيل المعلم بنجاح', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login (Both Teacher and Student)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبة' });
  }

  const user = db.authenticateUser(username, password);
  if (!user) {
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }

  // Create JWT Token
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, fullName: user.fullName },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    message: 'تم تسجيل الدخول بنجاح',
    token,
    user
  });
});

// Get Current User (Me)
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// --- TEACHER APIS ---

// Get Students of Teacher
app.get('/api/teacher/students', authenticateToken, requireTeacher, (req, res) => {
  const students = db.getStudentsForTeacher(req.user.id);
  res.json({ students });
});

// Create Student Account by Teacher
app.post('/api/teacher/students', authenticateToken, requireTeacher, (req, res) => {
  const { fullName, username, password } = req.body;

  if (!fullName || !username || !password) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة لإنشاء حساب الطالب' });
  }

  try {
    const student = db.createUser(fullName, username, password, 'student', req.user.id);
    res.status(201).json({ message: 'تم إنشاء حساب الطالب بنجاح', student });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Create Daily Reading Assignment
app.post('/api/teacher/assignments', authenticateToken, requireTeacher, (req, res) => {
  const { bookName, startPage, endPage, targetDate } = req.body;

  if (!bookName || !startPage || !endPage || !targetDate) {
    return res.status(400).json({ error: 'جميع حقول التكليف مطلوبة' });
  }

  try {
    const assignment = db.createAssignment(req.user.id, bookName, startPage, endPage, targetDate);
    res.status(201).json({ message: 'تمت إضافة الورد اليومي بنجاح', assignment });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get Assignments Created by Teacher
app.get('/api/teacher/assignments', authenticateToken, requireTeacher, (req, res) => {
  const assignments = db.getAssignmentsForTeacher(req.user.id);
  res.json({ assignments });
});

// Get Student Submissions (dashboard data)
app.get('/api/teacher/submissions', authenticateToken, requireTeacher, (req, res) => {
  const submissions = db.getSubmissionsForTeacherDashboard(req.user.id);
  res.json({ submissions });
});

// --- STUDENT APIS ---

// Get Today's Assignment for Student
app.get('/api/student/assignment/today', authenticateToken, requireStudent, (req, res) => {
  const assignment = db.getAssignmentForStudentToday(req.user.id);
  
  if (!assignment) {
    return res.json({ assignment: null, submission: null });
  }

  // Check if student already submitted progress for today's assignment
  const submissions = db.getSubmissionsForStudent(req.user.id);
  const todaySubmission = submissions.find(s => s.assignmentId === assignment.id) || null;

  res.json({ assignment, submission: todaySubmission });
});

// Get Student Assignments History
app.get('/api/student/assignments/history', authenticateToken, requireStudent, (req, res) => {
  const assignments = db.getAssignmentsHistoryForStudent(req.user.id);
  const submissions = db.getSubmissionsForStudent(req.user.id);

  // Map assignments with their submission status
  const history = assignments.map(a => {
    const sub = submissions.find(s => s.assignmentId === a.id);
    return {
      id: a.id,
      bookName: a.bookName,
      startPage: a.startPage,
      endPage: a.endPage,
      targetDate: a.targetDate,
      isCompleted: sub ? sub.isCompleted : false,
      questions: sub ? sub.questions : '',
      freeSpace: sub ? sub.freeSpace : '',
      submittedAt: sub ? sub.submittedAt : null
    };
  });

  res.json({ history });
});

// Submit Reading Progress
app.post('/api/student/submit', authenticateToken, requireStudent, (req, res) => {
  const { assignmentId, isCompleted, questions, freeSpace } = req.body;

  if (!assignmentId) {
    return res.status(400).json({ error: 'معرف الورد اليومي مطلوب' });
  }

  try {
    const submission = db.submitProgress(req.user.id, assignmentId, isCompleted, questions, freeSpace);
    res.json({ message: 'تم إرسال إنجازك بنجاح. بارك الله في همتك!', submission });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Fallback to serving main html for client routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

module.exports = app;
