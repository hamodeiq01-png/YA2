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

// Get Students of Teacher (now shows ALL students)
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

// Get Assignments Created by Teacher (now shows ALL assignments)
app.get('/api/teacher/assignments', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const assignments = await db.getAssignmentsForTeacher(req.user.id);
    res.json({ assignments });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب بيانات الأوراد' });
  }
});

// Get Student Submissions (dashboard data - now shows ALL submissions)
app.get('/api/teacher/submissions', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const submissions = await db.getSubmissionsForTeacherDashboard(req.user.id);
    res.json({ submissions });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب بيانات الإنجازات' });
  }
});

// إضافة نقاط يدوياً للطالب
app.post('/api/teacher/add-points', authenticateToken, requireTeacher, async (req, res) => {
  const { studentId, points } = req.body;

  if (!studentId || points === undefined || points === null) {
    return res.status(400).json({ error: 'معرف الطالب وعدد النقاط مطلوبة' });
  }

  const pointsNum = parseInt(points);
  if (isNaN(pointsNum) || pointsNum === 0) {
    return res.status(400).json({ error: 'يرجى إدخال عدد نقاط صحيح (غير صفري)' });
  }

  try {
    const result = await db.addBonusPoints(studentId, pointsNum);
    const action = pointsNum > 0 ? 'إضافة' : 'خصم';
    res.json({
      message: `تم ${action} ${Math.abs(pointsNum)} نقطة ${pointsNum > 0 ? 'إلى' : 'من'} "${result.fullName}". الرصيد الجديد: ${result.newPoints} نقطة`,
      result
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// جلب الإحصائيات
app.get('/api/teacher/statistics', authenticateToken, requireTeacher, async (req, res) => {
  const filter = req.query.filter || 'all';
  try {
    const statistics = await db.getStatistics(filter);
    res.json({ statistics });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب الإحصائيات' });
  }
});

// حذف مستخدم (طالب أو معلم)
app.delete('/api/teacher/delete-user/:userId', authenticateToken, requireTeacher, async (req, res) => {
  try {
    // منع المعلم من حذف نفسه
    if (req.params.userId === req.user.id) {
      return res.status(400).json({ error: 'لا يمكنك حذف حسابك الخاص!' });
    }
    await db.deleteUser(req.params.userId);
    res.json({ message: 'تم حذف المستخدم وجميع بياناته بنجاح.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// حذف ورد
app.delete('/api/teacher/delete-assignment/:assignmentId', authenticateToken, requireTeacher, async (req, res) => {
  try {
    await db.deleteAssignment(req.params.assignmentId);
    res.json({ message: 'تم حذف الورد بنجاح.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// جلب جميع المعلمين
app.get('/api/teacher/all-teachers', authenticateToken, requireTeacher, async (req, res) => {
  try {
    const teachers = await db.getAllTeachers();
    res.json({ teachers });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب بيانات المعلمين' });
  }
});

// --- STUDENT APIS ---

// Get Today's Assignments for Student (supports multiple + 2-day deadline)
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
        pointsAwarded: sub ? sub.pointsAwarded : 0,
        isLate: sub ? sub.isLate : false,
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
    let message = 'تم إرسال إنجازك بنجاح.';
    if (submission.pointsAwarded > 0) {
      message += ` حصلت على ${submission.pointsAwarded} نقطة!`;
      if (submission.isLate) {
        message += ' (تسليم متأخر)';
      }
    }
    message += ' بارك الله في همتك!';
    res.json({ message, submission });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// جلب نقاط الطالب
app.get('/api/student/points', authenticateToken, requireStudent, async (req, res) => {
  try {
    const pointsData = await db.getStudentPoints(req.user.id);
    // جلب ترتيب الطالب
    const allStudents = await db.getAllStudentsWithPoints();
    const rank = allStudents.findIndex(s => s.id === req.user.id) + 1;
    const totalStudents = allStudents.length;

    res.json({
      points: pointsData.points,
      fullName: pointsData.fullName,
      rank,
      totalStudents
    });
  } catch (error) {
    res.status(500).json({ error: 'حدث خطأ في جلب النقاط' });
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
