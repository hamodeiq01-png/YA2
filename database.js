const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'db.json');

// Initialize database file if it doesn't exist
function initDb() {
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      users: [],
      assignments: [],
      submissions: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

// Helper to read database
function readDb() {
  initDb();
  try {
    const data = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database file:', error);
    return { users: [], assignments: [], submissions: [] };
  }
}

// Helper to write database
function writeDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing to database file:', error);
    return false;
  }
}

// --- USER OPERATIONS ---

function createUser(fullName, username, password, role, teacherId = null) {
  const db = readDb();
  
  // Check if username already exists
  if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('اسم المستخدم موجود بالفعل');
  }

  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync(password, salt);

  const newUser = {
    id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    fullName,
    username: username.toLowerCase(),
    password: hashedPassword,
    role, // 'teacher' or 'student'
    teacherId, // If student, links to the teacher who created this account
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  writeDb(db);
  
  // Return user without password
  const { password: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
}

function authenticateUser(username, password) {
  const db = readDb();
  const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (!user) return null;
  
  const isValid = bcrypt.compareSync(password, user.password);
  if (!isValid) return null;

  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

function getStudentsForTeacher(teacherId) {
  const db = readDb();
  return db.users
    .filter(u => u.role === 'student' && u.teacherId === teacherId)
    .map(({ password, ...user }) => user);
}

// --- ASSIGNMENT OPERATIONS ---

function createAssignment(teacherId, bookName, startPage, endPage, targetDate) {
  const db = readDb();
  
  const newAssignment = {
    id: 'assign_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    teacherId,
    bookName,
    startPage: parseInt(startPage),
    endPage: parseInt(endPage),
    targetDate, // Format: YYYY-MM-DD
    createdAt: new Date().toISOString()
  };

  db.assignments.push(newAssignment);
  writeDb(db);
  return newAssignment;
}

function getAssignmentsForTeacher(teacherId) {
  const db = readDb();
  return db.assignments
    .filter(a => a.teacherId === teacherId)
    .sort((a, b) => b.targetDate.localeCompare(a.targetDate));
}

function getAssignmentForStudentToday(studentId) {
  const db = readDb();
  const student = db.users.find(u => u.id === studentId);
  if (!student || !student.teacherId) return null;

  const todayStr = new Date().toLocaleDateString('sv'); // YYYY-MM-DD
  
  return db.assignments.find(a => a.teacherId === student.teacherId && a.targetDate === todayStr) || null;
}

function getAssignmentsHistoryForStudent(studentId) {
  const db = readDb();
  const student = db.users.find(u => u.id === studentId);
  if (!student || !student.teacherId) return [];

  return db.assignments
    .filter(a => a.teacherId === student.teacherId)
    .sort((a, b) => b.targetDate.localeCompare(a.targetDate));
}

// --- SUBMISSION OPERATIONS ---

function submitProgress(studentId, assignmentId, isCompleted, questions = '', freeSpace = '') {
  const db = readDb();
  
  // Check if assignment exists
  const assignment = db.assignments.find(a => a.id === assignmentId);
  if (!assignment) throw new Error('الورد المحدد غير موجود');

  // Check if already submitted
  let submissionIndex = db.submissions.findIndex(s => s.studentId === studentId && s.assignmentId === assignmentId);

  const submissionData = {
    id: submissionIndex !== -1 ? db.submissions[submissionIndex].id : 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    studentId,
    assignmentId,
    isCompleted: !!isCompleted,
    questions: questions.trim(),
    freeSpace: freeSpace.trim(),
    submittedAt: new Date().toISOString()
  };

  if (submissionIndex !== -1) {
    db.submissions[submissionIndex] = submissionData;
  } else {
    db.submissions.push(submissionData);
  }

  writeDb(db);
  return submissionData;
}

function getSubmissionsForTeacherDashboard(teacherId) {
  const db = readDb();
  
  // Get all students of this teacher
  const studentIds = db.users
    .filter(u => u.role === 'student' && u.teacherId === teacherId)
    .map(u => u.id);

  // Get all assignments by this teacher
  const assignmentIds = db.assignments
    .filter(a => a.teacherId === teacherId)
    .map(a => a.id);

  // Filter submissions
  return db.submissions
    .filter(s => studentIds.includes(s.studentId) && assignmentIds.includes(s.assignmentId))
    .map(sub => {
      const student = db.users.find(u => u.id === sub.studentId);
      const assignment = db.assignments.find(a => a.id === sub.assignmentId);
      return {
        ...sub,
        studentName: student ? student.fullName : 'طالب محذوف',
        bookName: assignment ? assignment.bookName : 'كتاب غير معروف',
        pages: assignment ? `${assignment.startPage} - ${assignment.endPage}` : '',
        targetDate: assignment ? assignment.targetDate : ''
      };
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

function getSubmissionsForStudent(studentId) {
  const db = readDb();
  return db.submissions.filter(s => s.studentId === studentId);
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
