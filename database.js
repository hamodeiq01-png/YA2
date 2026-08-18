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

  // جلب جميع الأوراد (بدون حد زمني) — الطالب يقدر ينجز أي ورد سابق
  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('*')
    .lte('target_date', todayStr)
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

  // لا يوجد حد زمني — الطالب يقدر ينجز أي ورد سابق (بدون نقاط إذا تأخر أكثر من يومين)

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
    bookImage: assignment.book_image || null,
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

// جلب أسماء الكتب الفريدة
async function getUniqueBookNames() {
  const { data: assignments, error } = await supabase
    .from('assignments')
    .select('book_name');

  if (error || !assignments) return [];

  const uniqueNames = [...new Set(assignments.map(a => a.book_name))];
  return uniqueNames.sort();
}

// تعيين صورة لكتاب (رفع إلى Supabase Storage)
async function setBookImage(bookName, imageBase64) {
  if (!bookName || !imageBase64) {
    throw new Error('اسم الكتاب والصورة مطلوبان');
  }

  try {
    let publicUrl;

    // إذا كانت الصورة base64 نرفعها إلى Storage
    if (imageBase64.startsWith('data:')) {
      // استخراج نوع الملف والبيانات
      const matches = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        throw new Error('صيغة الصورة غير صحيحة');
      }

      const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');

      // إنشاء اسم فريد للملف (ASCII فقط لأن Supabase Storage لا يقبل العربي)
      const crypto = require('crypto');
      const nameHash = crypto.createHash('md5').update(bookName.trim()).digest('hex').substring(0, 12);
      const fileName = `book_${nameHash}_${Date.now()}.${ext}`;

      // حذف الصور القديمة لنفس الكتاب
      const prefix = `book_${nameHash}_`;
      const { data: existingFiles } = await supabase.storage
        .from('book-covers')
        .list('', { limit: 100 });

      if (existingFiles && existingFiles.length > 0) {
        const oldFiles = existingFiles
          .filter(f => f.name.startsWith(prefix))
          .map(f => f.name);
        if (oldFiles.length > 0) {
          await supabase.storage.from('book-covers').remove(oldFiles);
        }
      }

      // رفع الصورة الجديدة
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('book-covers')
        .upload(fileName, buffer, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('حدث خطأ أثناء رفع الصورة: ' + uploadError.message);
      }

      // الحصول على الرابط العام
      const { data: urlData } = supabase.storage
        .from('book-covers')
        .getPublicUrl(fileName);

      publicUrl = urlData.publicUrl;
    } else {
      // إذا كانت URL عادي نستخدمها مباشرة
      publicUrl = imageBase64.trim();
    }

    // حفظ الرابط في قاعدة البيانات
    const { data, error } = await supabase
      .from('assignments')
      .update({ book_image: publicUrl })
      .eq('book_name', bookName.trim())
      .select();

    if (error) throw new Error('حدث خطأ أثناء تعيين صورة الكتاب');
    if (!data || data.length === 0) throw new Error('لم يتم العثور على أوراد بهذا الاسم');

    return { bookName: bookName.trim(), updatedCount: data.length, imageUrl: publicUrl };
  } catch (err) {
    if (err.message.includes('اسم الكتاب') || err.message.includes('لم يتم') || err.message.includes('صيغة') || err.message.includes('رفع الصورة')) {
      throw err;
    }
    console.error('setBookImage error:', err);
    throw new Error('حدث خطأ غير متوقع أثناء تعيين صورة الكتاب');
  }
}

// تعديل اسم كتاب (تحديث جميع الأوراد بالاسم القديم)
async function renameBook(oldName, newName) {
  if (!oldName || !newName || oldName.trim() === '' || newName.trim() === '') {
    throw new Error('اسم الكتاب القديم والجديد مطلوبان');
  }

  if (oldName.trim() === newName.trim()) {
    throw new Error('الاسم الجديد مطابق للاسم القديم');
  }

  const { data, error } = await supabase
    .from('assignments')
    .update({ book_name: newName.trim() })
    .eq('book_name', oldName.trim())
    .select();

  if (error) throw new Error('حدث خطأ أثناء تعديل اسم الكتاب');
  if (!data || data.length === 0) throw new Error('لم يتم العثور على أوراد بهذا الاسم');

  return { oldName: oldName.trim(), newName: newName.trim(), updatedCount: data.length };
}

// حفظ اقتراح أو ملاحظة من المستخدم (معلم/طالب) للمبرمج
async function saveFeedback(feedbackData) {
  const fs = require('fs');
  const path = require('path');
  const feedbacksFilePath = path.join(__dirname, 'feedbacks.json');

  let savedItem = null;

  // 1. الحفظ في Supabase
  try {
    const { data, error } = await supabase
      .from('feedbacks')
      .insert([{
        sender_name: feedbackData.senderName || 'غير محدد',
        sender_role: feedbackData.senderRole || 'مستخدم',
        type: feedbackData.type || 'اقتراح',
        subject: feedbackData.subject || '',
        message: feedbackData.message || ''
      }])
      .select()
      .single();

    if (!error && data) {
      savedItem = {
        id: data.id.toString(),
        senderName: data.sender_name,
        senderRole: data.sender_role,
        type: data.type,
        subject: data.subject,
        message: data.message,
        createdAt: data.created_at
      };
    }
  } catch (err) {
    console.error('Supabase saveFeedback error:', err);
  }

  // إذا لم يتوفر من Supabase ننشئ كائن محلي
  if (!savedItem) {
    savedItem = {
      id: Date.now().toString(),
      senderName: feedbackData.senderName || 'غير محدد',
      senderRole: feedbackData.senderRole || 'مستخدم',
      type: feedbackData.type || 'اقتراح',
      subject: feedbackData.subject || '',
      message: feedbackData.message || '',
      createdAt: new Date().toISOString()
    };
  }

  // 2. الحفظ في ملف feedbacks.json المحلي كنسخة احتياطية
  try {
    let list = [];
    if (fs.existsSync(feedbacksFilePath)) {
      const fileData = fs.readFileSync(feedbacksFilePath, 'utf8');
      list = JSON.parse(fileData || '[]');
    }
    list.unshift(savedItem);
    fs.writeFileSync(feedbacksFilePath, JSON.stringify(list, null, 2), 'utf8');
  } catch (err) {
    console.error('Local file save error:', err);
  }

  return savedItem;
}

// جلب الملاحظات والاقتراحات
async function getFeedbacks() {
  const fs = require('fs');
  const path = require('path');
  const feedbacksFilePath = path.join(__dirname, 'feedbacks.json');

  // 1. جلب من Supabase
  try {
    const { data, error } = await supabase
      .from('feedbacks')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      return data.map(item => ({
        id: item.id.toString(),
        senderName: item.sender_name,
        senderRole: item.sender_role,
        type: item.type,
        subject: item.subject,
        message: item.message,
        createdAt: item.created_at
      }));
    }
  } catch (err) {
    console.error('Supabase getFeedbacks error:', err);
  }

  // 2. الرجوع للملف المحلي في حال تعذر Supabase
  try {
    if (fs.existsSync(feedbacksFilePath)) {
      const fileData = fs.readFileSync(feedbacksFilePath, 'utf8');
      return JSON.parse(fileData || '[]');
    }
  } catch (e) {
    console.error('Error reading feedbacks from file:', e);
  }

  return [];
}

// حذف ملاحظة أو اقتراح
async function deleteFeedback(id) {
  const fs = require('fs');
  const path = require('path');
  const feedbacksFilePath = path.join(__dirname, 'feedbacks.json');

  // 1. حذف من Supabase
  try {
    await supabase.from('feedbacks').delete().eq('id', id);
  } catch (e) {
    console.error('Supabase deleteFeedback error:', e);
  }

  // 2. حذف من الملف المحلي
  try {
    if (fs.existsSync(feedbacksFilePath)) {
      const fileData = fs.readFileSync(feedbacksFilePath, 'utf8');
      let list = JSON.parse(fileData || '[]');
      list = list.filter(item => item.id.toString() !== id.toString());
      fs.writeFileSync(feedbacksFilePath, JSON.stringify(list, null, 2), 'utf8');
    }
  } catch (e) {
    console.error('Error deleting feedback from file:', e);
  }

  return { success: true };
}

// ==========================================
// --- نظام المراسلة والمحادثات المباشرة ---
// ==========================================

function mapMessageKeys(msg) {
  if (!msg) return null;
  return {
    id: msg.id.toString(),
    senderId: msg.sender_id.toString(),
    receiverId: msg.receiver_id.toString(),
    content: msg.content,
    isRead: Boolean(msg.is_read),
    createdAt: msg.created_at
  };
}

// إرسال رسالة
async function sendMessage(senderId, receiverId, content) {
  if (!content || !content.trim()) {
    throw new Error('نص الرسالة مطلوب');
  }
  if (!receiverId) {
    throw new Error('المستلم مطلوب');
  }
  if (senderId.toString() === receiverId.toString()) {
    throw new Error('لا يمكن إرسال رسالة لنفسك');
  }

  // التأكد من وجود المستلم
  const { data: receiver, error: recErr } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('id', receiverId)
    .single();

  if (recErr || !receiver) {
    throw new Error('المستخدم المستلم غير موجود');
  }

  const { data, error } = await supabase
    .from('messages')
    .insert([{
      sender_id: senderId.toString(),
      receiver_id: receiverId.toString(),
      content: content.trim(),
      is_read: false
    }])
    .select()
    .single();

  if (error) {
    console.error('Supabase sendMessage error:', error);
    throw new Error('حدث خطأ أثناء إرسال الرسالة');
  }

  return mapMessageKeys(data);
}

// جلب سجل المحادثة بين مستخدمين
async function getChatMessages(userId1, userId2) {
  const u1 = userId1.toString();
  const u2 = userId2.toString();

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${u1},receiver_id.eq.${u2}),and(sender_id.eq.${u2},receiver_id.eq.${u1})`)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Supabase getChatMessages error:', error);
    return [];
  }

  return (data || []).map(mapMessageKeys);
}

// تحديد رسائل محادثة معينة كمقروءة
async function markChatAsRead(currentUserId, otherUserId) {
  const cUser = currentUserId.toString();
  const oUser = otherUserId.toString();

  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('receiver_id', cUser)
    .eq('sender_id', oUser)
    .eq('is_read', false);

  if (error) {
    console.error('Supabase markChatAsRead error:', error);
  }
  return { success: true };
}

// جلب عدد الرسائل غير المقروءة لمستخدم
async function getUnreadMessagesCount(userId) {
  const uid = userId.toString();
  const { data, error, count } = await supabase
    .from('messages')
    .select('id', { count: 'exact' })
    .eq('receiver_id', uid)
    .eq('is_read', false);

  if (error) {
    return 0;
  }
  return typeof count === 'number' ? count : (data ? data.length : 0);
}

// جلب قائمة المحادثات مع آخر رسالة وعدد غير المقروء
async function getConversationsList(currentUserId, userRole) {
  const uid = currentUserId.toString();

  let contacts = [];
  if (userRole === 'teacher') {
    // المعلم يرى جميع الطلاب المعتمدين
    const { data: students } = await supabase
      .from('users')
      .select('id, full_name, username, role, points')
      .eq('is_approved', true)
      .order('points', { ascending: false });
    contacts = (students || []).filter(u => u.id.toString() !== uid);
  } else {
    // الطالب يرى جميع المعلمين
    const { data: teachers } = await supabase
      .from('users')
      .select('id, full_name, username, role')
      .eq('role', 'teacher');
    contacts = teachers || [];
  }

  // جلب جميع الرسائل المرتبطة بالمستخدم
  const { data: allMessages } = await supabase
    .from('messages')
    .select('*')
    .or(`sender_id.eq.${uid},receiver_id.eq.${uid}`)
    .order('created_at', { ascending: false });

  const messagesList = (allMessages || []).map(mapMessageKeys);

  // تجميع المحادثات
  const conversations = contacts.map(contact => {
    const contactId = contact.id.toString();
    const chatMsgs = messagesList.filter(
      m => (m.senderId === contactId && m.receiverId === uid) || (m.senderId === uid && m.receiverId === contactId)
    );

    const lastMessage = chatMsgs.length > 0 ? chatMsgs[0] : null;
    const unreadCount = chatMsgs.filter(m => m.receiverId === uid && !m.isRead).length;

    return {
      user: {
        id: contact.id.toString(),
        fullName: contact.full_name,
        username: contact.username,
        role: contact.role,
        points: contact.points || 0
      },
      lastMessage,
      unreadCount
    };
  });

  // ترتيب: المحادثات ذات الرسائل غير المقروءة أولاً، ثم الأحدث
  conversations.sort((a, b) => {
    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
    if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
    const timeA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const timeB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  return conversations;
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
  getAllTeachers,
  getUniqueBookNames,
  setBookImage,
  renameBook,
  saveFeedback,
  getFeedbacks,
  deleteFeedback,
  sendMessage,
  getChatMessages,
  markChatAsRead,
  getUnreadMessagesCount,
  getConversationsList
};



