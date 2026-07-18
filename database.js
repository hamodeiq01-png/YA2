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
      is_approved: false
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
      is_approved: true
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
      is_approved: true
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

async function getStudentsForTeacher(teacherId) {
  const { data: students, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'student')
    .eq('teacher_id', teacherId)
    .eq('is_approved', true);

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

async function getAssignmentsForTeacher(teacherId) {
  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('target_date', { ascending: false });

  if (error) return [];
  return assignments.map(mapAssignmentKeys);
}

async function getAssignmentForStudentToday(studentId) {
  const { data: student } = await supabase
    .from('users')
    .select('teacher_id')
    .eq('id', studentId)
    .single();

  if (!student || !student.teacher_id) return null;

  const todayStr = new Date().toLocaleDateString('sv');

  const { data: assignment, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('teacher_id', student.teacher_id)
    .eq('target_date', todayStr)
    .single();

  if (error || !assignment) return null;
  return mapAssignmentKeys(assignment);
}

async function getAssignmentsHistoryForStudent(studentId) {
  const { data: student } = await supabase
    .from('users')
    .select('teacher_id')
    .eq('id', studentId)
    .single();

  if (!student || !student.teacher_id) return [];

  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('teacher_id', student.teacher_id)
    .order('target_date', { ascending: false });

  if (error) return [];
  return assignments.map(mapAssignmentKeys);
}

// --- SUBMISSION OPERATIONS ---

async function submitProgress(studentId, assignmentId, isCompleted, questions = '', freeSpace = '') {
  const { data: existingSubmission } = await supabase
    .from('submissions')
    .select('id')
    .eq('student_id', studentId)
    .eq('assignment_id', assignmentId)
    .single();

  let submissionData;

  if (existingSubmission) {
    const { data, error } = await supabase
      .from('submissions')
      .update({
        is_completed: !!isCompleted,
        questions: questions.trim(),
        free_space: freeSpace.trim(),
        submitted_at: new Date().toISOString()
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
        free_space: freeSpace.trim()
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);
    submissionData = data;
  }

  return mapSubmissionKeys(submissionData);
}

async function getSubmissionsForTeacherDashboard(teacherId) {
  const { data: assignments, error: err1 } = await supabase
    .from('assignments')
    .select('id, book_name, start_page, end_page, target_date')
    .eq('teacher_id', teacherId);

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
    submittedAt: sub.submitted_at
  };
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
  getAssignmentForStudentToday,
  getAssignmentsHistoryForStudent,
  submitProgress,
  getSubmissionsForTeacherDashboard,
  getSubmissionsForStudent
};
