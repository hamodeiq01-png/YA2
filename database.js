require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key is missing in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- USER OPERATIONS ---

// تسجيل طالب جديد (بانتظار موافقة المعلم)
async function registerStudent(fullName, username, password) {
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .ilike('username', username)
    .single();

  if (existingUser) {
    throw new Error('اسم المستخدم موجود بالفعل');
  }

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);

  const { data, error } = await supabase
    .from('users')
    .insert([{
      full_name: fullName,
      username: username.toLowerCase(),
      password: hashedPassword,
      role: 'student',
      teacher_id: null,
      is_approved: false,
      points: 0
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { password: _, ...userWithoutPassword } = data;
  return mapUserKeys(userWithoutPassword);
}

// إنشاء حساب معلم بواسطة معلم آخر
async function createTeacher(fullName, username, password) {
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .ilike('username', username)
    .single();

  if (existingUser) {
    throw new Error('اسم المستخدم موجود بالفعل');
  }

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);

  const { data, error } = await supabase
    .from('users')
    .insert([{
      full_name: fullName,
      username: username.toLowerCase(),
      password: hashedPassword,
      role: 'teacher',
      teacher_id: null,
      is_approved: true,
      points: 0
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { password: _, ...userWithoutPassword } = data;
  return mapUserKeys(userWithoutPassword);
}

// إنشاء حساب طالب بواسطة المعلم (معتمد مباشرة)
async function createUser(fullName, username, password, role, teacherId = null) {
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .ilike('username', username)
    .single();

  if (existingUser) {
    throw new Error('اسم المستخدم موجود بالفعل');
  }

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);

  const { data, error } = await supabase
    .from('users')
    .insert([{
      full_name: fullName,
      username: username.toLowerCase(),
      password: hashedPassword,
      role: role,
      teacher_id: teacherId,
      is_approved: true,
      points: 0
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { password: _, ...userWithoutPassword } = data;
  return mapUserKeys(userWithoutPassword);
}

async function authenticateUser(username, password) {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .ilike('username', username)
    .single();

  if (error || !user) return null;

  const isValid = bcrypt.compareSync(password, user.password);
  if (!isValid) return null;

  // التحقق من حالة الموافقة للطلاب
  if (user.role === 'student' && !user.is_approved) {
    throw new Error('حسابك بانتظار موافقة المعلم. يرجى التواصل مع معلمك.');
  }

  const { password: _, ...userWithoutPassword } = user;
  return mapUserKeys(userWithoutPassword);
}

// جلب جميع الطلاب المعتمدين (مشترك بين جميع المعلمين)
async function getStudentsForTeacher(teacherId) {
  const { data: students, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'student')
    .eq('is_approved', true)
    .order('points', { ascending: false });

  if (error) return [];
  return students.map(({ password, ...user }) => mapUserKeys(user));
}

// جلب الطلاب المعلقين بانتظار الموافقة
async function getPendingStudents() {
  const { data: students, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'student')
    .eq('is_approved', false)
    .order('created_at', { ascending: false });

  if (error) return [];
  return students.map(({ password, ...user }) => mapUserKeys(user));
}

// موافقة المعلم على طالب وربطه به
async function approveStudent(studentId, teacherId) {
  const { data, error } = await supabase
    .from('users')
    .update({ is_approved: true, teacher_id: teacherId })
    .eq('id', studentId)
    .eq('is_approved', false)
    .select()
    .single();

  if (error) throw new Error('حدث خطأ أثناء الموافقة على الطالب');
  if (!data) throw new Error('الطالب غير موجود أو تمت الموافقة عليه مسبقاً');

  const { password: _, ...userWithoutPassword } = data;
  return mapUserKeys(userWithoutPassword);
}

// رفض طالب (حذف الحساب)
async function rejectStudent(studentId) {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', studentId)
    .eq('is_approved', false);

  if (error) throw new Error('حدث خطأ أثناء رفض الطالب');
  return true;
}

// --- ASSIGNMENT OPERATIONS ---

async function createAssignment(teacherId, bookName, startPage, endPage, targetDate) {
  const { data, error } = await supabase
    .from('assignments')
    .insert([{
      teacher_id: teacherId,
      book_name: bookName,
      start_page: parseInt(startPage),
      end_page: parseInt(endPage),
      target_date: targetDate
    }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapAssignmentKeys(data);
}

// جلب جميع الأوراد (مشترك بين جميع المعلمين)
async function getAssignmentsForTeacher(teacherId) {
  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('*')
    .order('target_date', { ascending: false });

  if (error) return [];
  return assignments.map(mapAssignmentKeys);
}

async function getAssignmentsForStudentToday(studentId) {
  const todayStr = new Date().toLocaleDateString('sv');
  // حساب تواريخ الأيام السبعة الماضية للسماح بالإنجاز المتأخر
  const dates = [todayStr];
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toLocaleDateString('sv'));
  }

  // جلب أوراد اليوم والأيام السبعة الماضية
  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('*')
    .in('target_date', dates)
    .order('target_date', { ascending: false });

  if (error || !assignments) return [];

  // فلترة: أوراد اليوم تظهر دائماً، الأوراد السابقة فقط إذا لم يسلمها
  const { data: existingSubs } = await supabase
    .from('submissions')
    .select('assignment_id')
    .eq('student_id', studentId);

  const submittedIds = (existingSubs || []).map(s => s.assignment_id);

  const filtered = assignments.filter(a => {
    // أوراد اليوم تظهر دائماً
    if (a.target_date === todayStr) return true;
    // الأوراد السابقة تظهر فقط إذا لم يسلمها
    if (!submittedIds.includes(a.id)) return true;
    return false;
  });

  return filtered.map(mapAssignmentKeys);
}

async function getAssignmentsHistoryForStudent(studentId) {
  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('*')
    .order('target_date', { ascending: false });

  if (error) return [];
  return assignments.map(mapAssignmentKeys);
}

// --- SUBMISSION OPERATIONS ---

async function submitProgress(studentId, assignmentId, isCompleted, questions = '', freeSpace = '') {
  // جلب بيانات الورد لحساب النقاط
  const { data: assignment } = await supabase
    .from('assignments')
    .select('target_date')
    .eq('id', assignmentId)
    .single();

  if (!assignment) throw new Error('الورد غير موجود');

  const todayStr = new Date().toLocaleDateString('sv');
  const targetDate = assignment.target_date;

  // حساب الفرق بالأيام
  const today = new Date(todayStr);
  const target = new Date(targetDate);
  const diffDays = Math.floor((today - target) / (1000 * 60 * 60 * 24));

  // التحقق من المهلة (أسبوع كحد أقصى)
  if (diffDays > 7) {
    throw new Error('انتهت مهلة تسليم هذا الورد (أسبوع كحد أقصى)');
  }

  // حساب النقاط
  let pointsToAward = 0;
  let isLate = false;

  if (isCompleted) {
    if (diffDays <= 0) {
      // اليوم الأول (نفس اليوم أو قبله)
      pointsToAward = 10;
      isLate = false;
    } else if (diffDays === 1) {
      // اليوم الثاني (متأخر - 5 نقاط)
      pointsToAward = 5;
      isLate = true;
    } else {
      // بعد يومين (فائت - بدون نقاط)
      pointsToAward = 0;
      isLate = true;
    }
  }

  const { data: existingSubmission } = await supabase
    .from('submissions')
    .select('id, points_awarded')
    .eq('student_id', studentId)
    .eq('assignment_id', assignmentId)
    .single();

  let submissionData;
  let previousPoints = 0;

  if (existingSubmission) {
    previousPoints = existingSubmission.points_awarded || 0;

    const { data, error } = await supabase
      .from('submissions')
      .update({
        is_completed: !!isCompleted,
        questions: questions.trim(),
        free_space: freeSpace.trim(),
        submitted_at: new Date().toISOString(),
        points_awarded: pointsToAward,
        is_late: isLate
      })
      .eq('id', existingSubmission.id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    submissionData = data;
  } else {
    const { data, error } = await supabase
      .from('submissions')
      .insert([{
        student_id: studentId,
        assignment_id: assignmentId,
        is_completed: !!isCompleted,
        questions: questions.trim(),
        free_space: freeSpace.trim(),
        points_awarded: pointsToAward,
        is_late: isLate
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    submissionData = data;
  }

  // تحديث نقاط الطالب (إزالة النقاط القديمة وإضافة الجديدة)
  const pointsDiff = pointsToAward - previousPoints;
  if (pointsDiff !== 0) {
    const { data: student } = await supabase
      .from('users')
      .select('points')
      .eq('id', studentId)
      .single();

    const newPoints = Math.max(0, (student?.points || 0) + pointsDiff);
    await supabase
      .from('users')
      .update({ points: newPoints })
      .eq('id', studentId);
  }

  return mapSubmissionKeys(submissionData);
}

// جلب جميع التسليمات للوحة المعلم (مشترك بين جميع المعلمين)
async function getSubmissionsForTeacherDashboard(teacherId) {
  const { data: assignments, error: err1 } = await supabase
    .from('assignments')
    .select('id, book_name, start_page, end_page, target_date');

  if (err1 || !assignments || !assignments.length) return [];

  const assignmentIds = assignments.map(a => a.id);

  const { data: submissions, error: err2 } = await supabase
    .from('submissions')
    .select(`
      *,
      users:student_id (full_name)
    `)
    .in('assignment_id', assignmentIds)
    .order('submitted_at', { ascending: false });

  if (err2 || !submissions) return [];

  return submissions.map(sub => {
    const assignment = assignments.find(a => a.id === sub.assignment_id);
    return {
      id: sub.id,
      studentId: sub.student_id,
      assignmentId: sub.assignment_id,
      isCompleted: sub.is_completed,
      questions: sub.questions,
      freeSpace: sub.free_space,
      submittedAt: sub.submitted_at,
      pointsAwarded: sub.points_awarded || 0,
      isLate: sub.is_late || false,
      studentName: sub.users ? sub.users.full_name : 'طالب محذوف',
      bookName: assignment ? assignment.book_name : 'كتاب غير معروف',
      pages: assignment ? `${assignment.start_page} - ${assignment.end_page}` : '',
      targetDate: assignment ? assignment.target_date : ''
    };
  });
}

async function getSubmissionsForStudent(studentId) {
  const { data: submissions, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('student_id', studentId);

  if (error) return [];
  return submissions.map(mapSubmissionKeys);
}

// --- POINTS OPERATIONS ---

// إضافة نقاط يدوياً من المعلم
async function addBonusPoints(studentId, points, reason = '') {
  const { data: student, error: fetchErr } = await supabase
    .from('users')
    .select('points, full_name')
    .eq('id', studentId)
    .eq('role', 'student')
    .single();

  if (fetchErr || !student) throw new Error('الطالب غير موجود');

  const newPoints = Math.max(0, (student.points || 0) + points);

  const { error: updateErr } = await supabase
    .from('users')
    .update({ points: newPoints })
    .eq('id', studentId);

  if (updateErr) throw new Error('حدث خطأ أثناء تحديث النقاط');

  return { studentId, fullName: student.full_name, newPoints, pointsAdded: points };
}

// جلب نقاط الطالب
async function getStudentPoints(studentId) {
  const { data: student, error } = await supabase
    .from('users')
    .select('points, full_name')
    .eq('id', studentId)
    .single();

  if (error || !student) return { points: 0, fullName: '' };
  return { points: student.points || 0, fullName: student.full_name };
}

// جلب جميع الطلاب مع نقاطهم (ترتيب بالنقاط)
async function getAllStudentsWithPoints() {
  const { data: students, error } = await supabase
    .from('users')
    .select('id, full_name, username, points')
    .eq('role', 'student')
    .eq('is_approved', true)
    .order('points', { ascending: false });

  if (error) return [];
  return students.map(s => ({
    id: s.id,
    fullName: s.full_name,
    username: s.username,
    points: s.points || 0
  }));
}

// جلب الإحصائيات (يومية أو شاملة)
async function getStatistics(dateFilter = 'all') {
  // جلب جميع الطلاب المعتمدين
  const { data: students } = await supabase
    .from('users')
    .select('id, full_name, points')
    .eq('role', 'student')
    .eq('is_approved', true)
    .order('points', { ascending: false });

  if (!students) return { students: [], submissions: [], assignments: [], summary: {} };

  // جلب الأوراد
  let assignmentsQuery = supabase.from('assignments').select('*');
  if (dateFilter === 'today') {
    const todayStr = new Date().toLocaleDateString('sv');
    assignmentsQuery = assignmentsQuery.eq('target_date', todayStr);
  } else if (dateFilter === 'week') {
    const todayStr = new Date().toLocaleDateString('sv');
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toLocaleDateString('sv');
    assignmentsQuery = assignmentsQuery.gte('target_date', weekAgoStr).lte('target_date', todayStr);
  }
  const { data: assignments } = await assignmentsQuery.order('target_date', { ascending: false });

  // جلب التسليمات
  let submissionsData = [];
  if (assignments && assignments.length > 0) {
    const assignmentIds = assignments.map(a => a.id);
    const { data: subs } = await supabase
      .from('submissions')
      .select(`*, users:student_id (full_name)`)
      .in('assignment_id', assignmentIds)
      .order('submitted_at', { ascending: false });
    submissionsData = subs || [];
  }

  // حساب الملخص
  const totalStudents = students.length;
  const totalAssignments = (assignments || []).length;
  const totalSubmissions = submissionsData.length;
  const completedSubmissions = submissionsData.filter(s => s.is_completed).length;
  const lateSubmissions = submissionsData.filter(s => s.is_late).length;
  const totalPointsAwarded = submissionsData.reduce((sum, s) => sum + (s.points_awarded || 0), 0);

  // بيانات كل طالب
  const studentStats = students.map(student => {
    const studentSubs = submissionsData.filter(s => s.student_id === student.id);
    const completed = studentSubs.filter(s => s.is_completed).length;
    const late = studentSubs.filter(s => s.is_late).length;
    const pointsFromSubs = studentSubs.reduce((sum, s) => sum + (s.points_awarded || 0), 0);

    return {
      id: student.id,
      fullName: student.full_name,
      totalPoints: student.points || 0,
      completedCount: completed,
      lateCount: late,
      pointsFromAssignments: pointsFromSubs,
      submissionCount: studentSubs.length
    };
  });

  return {
    summary: {
      totalStudents,
      totalAssignments,
      totalSubmissions,
      completedSubmissions,
      lateSubmissions,
      totalPointsAwarded,
      completionRate: totalStudents > 0 && totalAssignments > 0
        ? Math.round((completedSubmissions / (totalStudents * totalAssignments)) * 100)
        : 0
    },
    studentStats,
    filter: dateFilter
  };
}

// Helpers to map snake_case from DB to camelCase for JS
function mapUserKeys(user) {
  if (!user) return null;
  return {
    id: user.id,
    fullName: user.full_name,
    username: user.username,
    role: user.role,
    teacherId: user.teacher_id,
    isApproved: user.is_approved,
    points: user.points || 0,
    createdAt: user.created_at
  };
}

function mapAssignmentKeys(assignment) {
  if (!assignment) return null;
  return {
    id: assignment.id,
    teacherId: assignment.teacher_id,
    bookName: assignment.book_name,
    startPage: assignment.start_page,
    endPage: assignment.end_page,
    targetDate: assignment.target_date,
    createdAt: assignment.created_at
  };
}

function mapSubmissionKeys(sub) {
  if (!sub) return null;
  return {
    id: sub.id,
    studentId: sub.student_id,
    assignmentId: sub.assignment_id,
    isCompleted: sub.is_completed,
    questions: sub.questions,
    freeSpace: sub.free_space,
    pointsAwarded: sub.points_awarded || 0,
    isLate: sub.is_late || false,
    submittedAt: sub.submitted_at
  };
}

// حذف مستخدم (طالب أو معلم)
async function deleteUser(userId) {
  // حذف التسليمات المرتبطة أولاً
  await supabase.from('submissions').delete().eq('student_id', userId);

  // حذف الطلاب المرتبطين (إذا كان معلماً)
  const { data: linkedStudents } = await supabase
    .from('users')
    .select('id')
    .eq('teacher_id', userId);

  if (linkedStudents && linkedStudents.length > 0) {
    for (const s of linkedStudents) {
      await supabase.from('submissions').delete().eq('student_id', s.id);
    }
    await supabase.from('users').delete().eq('teacher_id', userId);
  }

  // حذف الأوراد المرتبطة (إذا كان معلماً)
  const { data: linkedAssignments } = await supabase
    .from('assignments')
    .select('id')
    .eq('teacher_id', userId);

  if (linkedAssignments && linkedAssignments.length > 0) {
    const assignIds = linkedAssignments.map(a => a.id);
    await supabase.from('submissions').delete().in('assignment_id', assignIds);
    await supabase.from('assignments').delete().eq('teacher_id', userId);
  }

  // حذف المستخدم نفسه
  const { error } = await supabase.from('users').delete().eq('id', userId);
  if (error) throw new Error('حدث خطأ أثناء حذف المستخدم');
  return true;
}

// حذف ورد
async function deleteAssignment(assignmentId) {
  // حذف التسليمات المرتبطة أولاً
  await supabase.from('submissions').delete().eq('assignment_id', assignmentId);

  const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);
  if (error) throw new Error('حدث خطأ أثناء حذف الورد');
  return true;
}

// جلب جميع المعلمين
async function getAllTeachers() {
  const { data: teachers, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'teacher')
    .order('created_at', { ascending: false });

  if (error) return [];
  return teachers.map(({ password, ...user }) => mapUserKeys(user));
}

module.exports = {
  registerStudent,
  createTeacher,
  createUser,
  authenticateUser,
  getStudentsForTeacher,
  getPendingStudents,
  approveStudent,
  rejectStudent,
  createAssignment,
  getAssignmentsForTeacher,
  getAssignmentsForStudentToday,
  getAssignmentsHistoryForStudent,
  submitProgress,
  getSubmissionsForTeacherDashboard,
  getSubmissionsForStudent,
  addBonusPoints,
  getStudentPoints,
  getAllStudentsWithPoints,
  getStatistics,
  deleteUser,
  deleteAssignment,
  getAllTeachers
};
