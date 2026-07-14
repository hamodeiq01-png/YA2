global.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Load config from environment variables (for Vercel) or fallback to config.json (for local development)
let supabaseUrl = process.env.SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  try {
    const configPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      supabaseUrl = supabaseUrl || config.SUPABASE_URL;
      supabaseKey = supabaseKey || config.SUPABASE_KEY;
    }
  } catch (e) {
    console.error('Failed to load config.json and env variables are missing', e);
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- USER OPERATIONS ---

async function createUser(fullName, username, password, role, teacherId = null) {
  // Check if username already exists
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('id')
    .eq('username', username.toLowerCase())
    .maybeSingle();

  if (checkError) throw new Error(checkError.message);
  if (existingUser) {
    throw new Error('اسم المستخدم موجود بالفعل');
  }

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);

  const newUser = {
    id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    full_name: fullName,
    username: username.toLowerCase(),
    password: hashedPassword,
    role, // 'teacher' or 'student'
    teacher_id: teacherId
  };

  const { data, error } = await supabase
    .from('users')
    .insert([newUser])
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { password: _, ...userWithoutPassword } = data;
  return {
    id: userWithoutPassword.id,
    fullName: userWithoutPassword.full_name,
    username: userWithoutPassword.username,
    role: userWithoutPassword.role,
    teacherId: userWithoutPassword.teacher_id,
    createdAt: userWithoutPassword.created_at
  };
}

async function authenticateUser(username, password) {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username.toLowerCase())
    .maybeSingle();

  if (error || !user) return null;

  const isValid = bcrypt.compareSync(password, user.password);
  if (!isValid) return null;

  const { password: _, ...userWithoutPassword } = user;
  return {
    id: userWithoutPassword.id,
    fullName: userWithoutPassword.full_name,
    username: userWithoutPassword.username,
    role: userWithoutPassword.role,
    teacherId: userWithoutPassword.teacher_id,
    createdAt: userWithoutPassword.created_at
  };
}

async function getStudentsForTeacher(teacherId) {
  const { data: students, error } = await supabase
    .from('users')
    .select('id, full_name, username, role, teacher_id, created_at')
    .eq('role', 'student')
    .eq('teacher_id', teacherId);

  if (error) return [];
  return students.map(s => ({
    id: s.id,
    fullName: s.full_name,
    username: s.username,
    role: s.role,
    teacherId: s.teacher_id,
    createdAt: s.created_at
  }));
}

// --- ASSIGNMENT OPERATIONS ---

async function createAssignment(teacherId, bookName, startPage, endPage, targetDate) {
  const newAssignment = {
    id: 'assign_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    teacher_id: teacherId,
    book_name: bookName,
    start_page: parseInt(startPage),
    end_page: parseInt(endPage),
    target_date: targetDate
  };

  const { data, error } = await supabase
    .from('assignments')
    .insert([newAssignment])
    .select()
    .single();

  if (error) throw new Error(error.message);
  
  return {
    id: data.id,
    teacherId: data.teacher_id,
    bookName: data.book_name,
    startPage: data.start_page,
    endPage: data.end_page,
    targetDate: data.target_date,
    createdAt: data.created_at
  };
}

async function getAssignmentsForTeacher(teacherId) {
  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('target_date', { ascending: false });

  if (error) return [];
  return assignments.map(a => ({
    id: a.id,
    teacherId: a.teacher_id,
    bookName: a.book_name,
    startPage: a.start_page,
    endPage: a.end_page,
    targetDate: a.target_date,
    createdAt: a.created_at
  }));
}

async function getAssignmentForStudentToday(studentId) {
  const { data: student, error: studentError } = await supabase
    .from('users')
    .select('teacher_id')
    .eq('id', studentId)
    .single();

  if (studentError || !student || !student.teacher_id) return null;

  const todayStr = new Date().toLocaleDateString('sv'); // YYYY-MM-DD

  const { data: assignment, error: assignError } = await supabase
    .from('assignments')
    .select('*')
    .eq('teacher_id', student.teacher_id)
    .eq('target_date', todayStr)
    .maybeSingle();

  if (assignError || !assignment) return null;

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

async function getAssignmentsHistoryForStudent(studentId) {
  const { data: student, error: studentError } = await supabase
    .from('users')
    .select('teacher_id')
    .eq('id', studentId)
    .single();

  if (studentError || !student || !student.teacher_id) return [];

  const { data: assignments, error: assignError } = await supabase
    .from('assignments')
    .select('*')
    .eq('teacher_id', student.teacher_id)
    .order('target_date', { ascending: false });

  if (assignError) return [];
  return assignments.map(a => ({
    id: a.id,
    teacherId: a.teacher_id,
    bookName: a.book_name,
    startPage: a.start_page,
    endPage: a.end_page,
    targetDate: a.target_date,
    createdAt: a.created_at
  }));
}

// --- SUBMISSION OPERATIONS ---

async function submitProgress(studentId, assignmentId, isCompleted, questions = '', freeSpace = '') {
  // Check if assignment exists
  const { data: assignment, error: assignError } = await supabase
    .from('assignments')
    .select('id')
    .eq('id', assignmentId)
    .maybeSingle();

  if (assignError || !assignment) throw new Error('الورد المحدد غير موجود');

  // Check if submission already exists
  const { data: existingSubmission, error: subError } = await supabase
    .from('submissions')
    .select('id')
    .eq('student_id', studentId)
    .eq('assignment_id', assignmentId)
    .maybeSingle();

  const submissionData = {
    id: existingSubmission ? existingSubmission.id : 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    student_id: studentId,
    assignment_id: assignmentId,
    is_completed: !!isCompleted,
    questions: questions.trim(),
    free_space: freeSpace.trim(),
    submitted_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('submissions')
    .upsert([submissionData])
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    id: data.id,
    studentId: data.student_id,
    assignmentId: data.assignment_id,
    isCompleted: data.is_completed,
    questions: data.questions,
    freeSpace: data.free_space,
    submittedAt: data.submitted_at
  };
}

async function getSubmissionsForTeacherDashboard(teacherId) {
  const { data: submissions, error } = await supabase
    .from('submissions')
    .select(`
      id,
      student_id,
      assignment_id,
      is_completed,
      questions,
      free_space,
      submitted_at,
      student:users!student_id(full_name),
      assignment:assignments!assignment_id(book_name, start_page, end_page, target_date, teacher_id)
    `);

  if (error) {
    console.error('Error fetching submissions dashboard:', error);
    return [];
  }

  return submissions
    .filter(s => s.assignment && s.assignment.teacher_id === teacherId)
    .map(s => ({
      id: s.id,
      studentId: s.student_id,
      assignmentId: s.assignment_id,
      isCompleted: s.is_completed,
      questions: s.questions,
      freeSpace: s.free_space,
      submittedAt: s.submitted_at,
      studentName: s.student ? s.student.full_name : 'طالب محذوف',
      bookName: s.assignment.book_name,
      pages: `${s.assignment.start_page} - ${s.assignment.end_page}`,
      targetDate: s.assignment.target_date
    }))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

async function getSubmissionsForStudent(studentId) {
  const { data: submissions, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('student_id', studentId);

  if (error) return [];
  return submissions.map(s => ({
    id: s.id,
    studentId: s.student_id,
    assignmentId: s.assignment_id,
    isCompleted: s.is_completed,
    questions: s.questions,
    freeSpace: s.free_space,
    submittedAt: s.submitted_at
  }));
}

module.exports = {
  createUser,
  authenticateUser,
  getStudentsForTeacher,
  createAssignment,
  getAssignmentsForTeacher,
  getAssignmentForStudentToday,
  getAssignmentsHistoryForStudent,
  submitProgress,
  getSubmissionsForTeacherDashboard,
  getSubmissionsForStudent
};
