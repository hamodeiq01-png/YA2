/**
 * تصحيح: التسليمات المتأخرة لأول يومين تستحق 5 نقاط (مو 10)
 * نبحث عن تسليمات أوراد 18 و 19 يوليو اللي سُلمت متأخرة وأعطيناها 10 ← نخليها 5
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const FIRST_DAYS = ['2026-07-18', '2026-07-19'];

async function fixLatePoints() {
  console.log('=== تصحيح نقاط التسليمات المتأخرة (10 → 5) ===\n');

  // 1. جلب أوراد أول يومين
  const { data: assignments, error: assErr } = await supabase
    .from('assignments')
    .select('id, target_date, book_name')
    .in('target_date', FIRST_DAYS);

  if (assErr || !assignments || assignments.length === 0) {
    console.log('لم يتم العثور على أوراد');
    return;
  }

  const assignmentMap = {};
  assignments.forEach(a => { assignmentMap[a.id] = a; });
  const assignmentIds = assignments.map(a => a.id);

  // 2. جلب جميع التسليمات المكتملة لهذه الأوراد اللي نقاطها 10
  const { data: submissions, error: subErr } = await supabase
    .from('submissions')
    .select('*')
    .in('assignment_id', assignmentIds)
    .eq('is_completed', true)
    .eq('points_awarded', 10);

  if (subErr || !submissions || submissions.length === 0) {
    console.log('لا توجد تسليمات للتصحيح');
    return;
  }

  // 3. جلب بيانات الطلاب
  const studentIds = [...new Set(submissions.map(s => s.student_id))];
  const { data: students } = await supabase
    .from('users')
    .select('id, full_name, points')
    .in('id', studentIds);

  const studentMap = {};
  students.forEach(s => { studentMap[s.id] = { ...s, pointsToDeduct: 0 }; });

  // 4. تحديد التسليمات المتأخرة (سُلمت بعد يوم الورد)
  const lateSubmissions = [];

  for (const sub of submissions) {
    const assignment = assignmentMap[sub.assignment_id];
    if (!assignment) continue;

    const submittedDateStr = new Date(sub.submitted_at).toISOString().split('T')[0];
    const targetDateStr = assignment.target_date;

    const diffDays = Math.floor((new Date(submittedDateStr) - new Date(targetDateStr)) / (1000 * 60 * 60 * 24));

    const student = studentMap[sub.student_id];
    const studentName = student ? student.full_name : 'غير معروف';

    if (diffDays > 0) {
      // متأخر - يجب تغيير من 10 إلى 5
      console.log(`🔄 ${studentName} | ${assignment.book_name} (${targetDateStr}) | سلّم: ${submittedDateStr} | متأخر ${diffDays} يوم | 10 → 5 نقاط`);
      lateSubmissions.push(sub);
      if (studentMap[sub.student_id]) {
        studentMap[sub.student_id].pointsToDeduct += 5; // الفرق بين 10 و 5
      }
    } else {
      console.log(`✅ ${studentName} | ${assignment.book_name} (${targetDateStr}) | سلّم: ${submittedDateStr} | في الوقت ✓ | 10 نقاط (صحيح)`);
    }
  }

  if (lateSubmissions.length === 0) {
    console.log('\n✅ لا توجد تسليمات متأخرة تحتاج تصحيح!');
    return;
  }

  // 5. ملخص التعديلات
  console.log('\n--- ملخص التصحيح ---');
  for (const [id, student] of Object.entries(studentMap)) {
    if (student.pointsToDeduct > 0) {
      const newPoints = (student.points || 0) - student.pointsToDeduct;
      console.log(`👤 ${student.full_name}: -${student.pointsToDeduct} نقطة (${student.points} → ${newPoints})`);
    }
  }

  // 6. تحديث التسليمات المتأخرة: 10 → 5
  console.log('\n⏳ جاري التحديث...\n');

  for (const sub of lateSubmissions) {
    const { error } = await supabase
      .from('submissions')
      .update({
        points_awarded: 5,
        is_late: true
      })
      .eq('id', sub.id);

    if (error) {
      console.error(`❌ خطأ في تحديث تسليم ${sub.id}:`, error.message);
    }
  }

  // 7. تحديث نقاط الطلاب (خصم الفرق)
  for (const [id, student] of Object.entries(studentMap)) {
    if (student.pointsToDeduct > 0) {
      const newPoints = Math.max(0, (student.points || 0) - student.pointsToDeduct);
      const { error } = await supabase
        .from('users')
        .update({ points: newPoints })
        .eq('id', id);

      if (error) {
        console.error(`❌ خطأ ${student.full_name}:`, error.message);
      } else {
        console.log(`✅ ${student.full_name}: ${student.points} → ${newPoints} نقطة (-${student.pointsToDeduct})`);
      }
    }
  }

  console.log('\n🎉 تم التصحيح بنجاح!');
}

fixLatePoints().catch(err => {
  console.error('خطأ:', err);
  process.exit(1);
});
