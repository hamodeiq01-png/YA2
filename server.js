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

// تسجيل طالب جديد (بانتظار موافقة المعلم)
app.post('/api/auth/register-student', async (req, res) => {
  const { fullName, username, password } = req.body;

  if (!fullName || !username || !password) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }

  try {
    const user = await db.registerStudent(fullName, username, password);
    res.status(201).json({ message: 'تم تسجيل حسابك بنجاح! بانتظار موافقة المعلم.', user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login (Both Teacher and Student)
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبة' });
  }

  try {
    const user = await db.authenticateUser(username, password);
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
  } catch (error) {
    // رسالة خاصة للطلاب غير المعتمدين
    res.status(403).json({ error: error.message });
  }
});

// Get Current User (Me)
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// --- TEACHER APIS ---

// إنشاء حساب معلم جديد بواسطة معلم حالي
app.post('/api/teacher/create-teacher', authenticateToken, requireTeacher, async (req, res) => {
  const { fullName, username, password } = req.body;

  if (!fullName || !username || !password) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }

  try {
    const teacher = await db.createTeacher(fullName, username, password);
    res.status(201).json({ message: 'تم إنشاء حساب المعلم بنجاح', teacher });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// جلب الطلاب المعلقين بانتظار الموافقة
app.get('/api/teacher/pending-students', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const students = await db.getPendingStudents();
    res.json({ students });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب بيانات الطلاب المعلقين' });
  }
});

// الموافقة على طالب
app.post('/api/teacher/approve-student', authenticateToken, requireTeacher, async (req, res) => {
  const { studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: 'معرف الطالب مطلوب' });
  }

  try {
    const student = await db.approveStudent(studentId, req.user.id);
    res.json({ message: `تمت الموافقة على الطالب "${student.fullName}" بنجاح!`, student });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// رفض طالب
app.post('/api/teacher/reject-student', authenticateToken, requireTeacher, async (req, res) => {
  const { studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({ error: 'معرف الطالب مطلوب' });
  }

  try {
    await db.rejectStudent(studentId);
    res.json({ message: 'تم رفض الطالب وحذف حسابه.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get Students of Teacher
app.get('/api/teacher/students', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const students = await db.getStudentsForTeacher(req.user.id);
    res.json({ students });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب بيانات الطلاب' });
  }
});

// Create Student Account by Teacher (معتمد مباشرة)
app.post('/api/teacher/students', authenticateToken, requireTeacher, async (req, res) => {
  const { fullName, username, password } = req.body;

  if (!fullName || !username || !password) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة لإنشاء حساب الطالب' });
  }

  try {
    const student = await db.createUser(fullName, username, password, 'student', req.user.id);
    res.status(201).json({ message: 'تم إنشاء حساب الطالب بنجاح', student });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Create Daily Reading Assignment
app.post('/api/teacher/assignments', authenticateToken, requireTeacher, async (req, res) => {
  const { bookName, startPage, endPage, targetDate } = req.body;

  if (!bookName || !startPage || !endPage || !targetDate) {
    return res.status(400).json({ error: 'جميع حقول التكليف مطلوبة' });
  }

  try {
    const assignment = await db.createAssignment(req.user.id, bookName, startPage, endPage, targetDate);
    res.status(201).json({ message: 'تمت إضافة الورد اليومي بنجاح', assignment });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get Assignments Created by Teacher
app.get('/api/teacher/assignments', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const assignments = await db.getAssignmentsForTeacher(req.user.id);
    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب بيانات الأوراد' });
  }
});

// Get Student Submissions (dashboard data)
app.get('/api/teacher/submissions', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const submissions = await db.getSubmissionsForTeacherDashboard(req.user.id);
    res.json({ submissions });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب بيانات الإنجازات' });
  }
});

// --- STUDENT APIS ---

// Get Today's Assignments for Student (supports multiple)
app.get('/api/student/assignments/today', authenticateToken, requireStudent, async (req, res) => {
  try {
    const assignments = await db.getAssignmentsForStudentToday(req.user.id);

    if (!assignments || assignments.length === 0) {
      return res.json({ assignments: [] });
    }

    const submissions = await db.getSubmissionsForStudent(req.user.id);

    // Map each assignment with its submission
    const result = assignments.map(a => {
      const sub = submissions.find(s => s.assignmentId === a.id) || null;
      return { assignment: a, submission: sub };
    });

    res.json({ assignments: result });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب أوراد اليوم' });
  }
});

// Get Student Assignments History
app.get('/api/student/assignments/history', authenticateToken, requireStudent, async (req, res) => {
  try {
    const assignments = await db.getAssignmentsHistoryForStudent(req.user.id);
    const submissions = await db.getSubmissionsForStudent(req.user.id);

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
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب السجل' });
  }
});

// Submit Reading Progress
app.post('/api/student/submit', authenticateToken, requireStudent, async (req, res) => {
  const { assignmentId, isCompleted, questions, freeSpace } = req.body;

  if (!assignmentId) {
    return res.status(400).json({ error: 'معرف الورد اليومي مطلوب' });
  }

  try {
    const submission = await db.submitProgress(req.user.id, assignmentId, isCompleted, questions, freeSpace);
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
