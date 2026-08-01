/**
 * سكربت لإصلاح النقاط المفقودة
 * يبحث عن التسليمات المكتملة التي لم تُحسب لها نقاط، ويحسبها ويضيفها
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function fixMissingPoints() {
  console.log('=== بدء إصلاح النقاط المفقودة ===\n');

  // 1. جلب جميع التسليمات المكتملة التي نقاطها 0 أو null
  const { data: submissions, error: subErr } = await supabase
    .from('submissions')
    .select('*')
    .eq('is_completed', true)
    .or('points_awarded.eq.0,points_awarded.is.null');

  if (subErr) {
    console.error('خطأ في جلب التسليمات:', subErr.message);
    return;
  }

  if (!submissions || submissions.length === 0) {
    console.log('✅ لا توجد تسليمات بدون نقاط. كل شيء تمام!');
    return;
  }

  console.log(`🔍 تم العثور على ${submissions.length} تسليم مكتمل بدون نقاط\n`);

  // 2. جلب بيانات الأوراد المرتبطة
  const assignmentIds = [...new Set(submissions.map(s => s.assignment_id))];
  const { data: assignments, error: assErr } = await supabase
    .from('assignments')
    .select('id, target_date, book_name')
    .in('id', assignmentIds);

  if (assErr) {
    console.error('خطأ في جلب الأوراد:', assErr.message);
    return;
  }

  // 3. جلب بيانات الطلاب
  const studentIds = [...new Set(submissions.map(s => s.student_id))];
  const { data: students, error: stuErr } = await supabase
    .from('users')
    .select('id, full_name, points')
    .in('id', studentIds);

  if (stuErr) {
    console.error('خطأ في جلب الطلاب:', stuErr.message);
    return;
  }

  // Map للوصول السريع
  const assignmentMap = {};
  assignments.forEach(a => { assignmentMap[a.id] = a; });

  const studentMap = {};
  students.forEach(s => { studentMap[s.id] = { ...s, pointsToAdd: 0 }; });

  // 4. حساب النقاط لكل تسليم
  const updates = [];

  for (const sub of submissions) {
    const assignment = assignmentMap[sub.assignment_id];
    if (!assignment) continue;

    const submittedAt = new Date(sub.submitted_at);
    const targetDate = new Date(assignment.target_date);

    // حساب الفرق بالأيام بين تاريخ التسليم وتاريخ الورد
    const submittedDateStr = submittedAt.toISOString().split('T')[0];
    const targetDateStr = assignment.target_date;

    const submittedDay = new Date(submittedDateStr);
    const targetDay = new Date(targetDateStr);
    const diffDays = Math.floor((submittedDay - targetDay) / (1000 * 60 * 60 * 24));

    let pointsToAward = 0;
    let isLate = false;

    if (diffDays <= 0) {
      // تسليم في نفس اليوم أو قبله
      pointsToAward = 10;
      isLate = false;
    } else if (diffDays === 1) {
      // تسليم متأخر يوم واحد
      pointsToAward = 5;
      isLate = true;
    } else {
      // أكثر من يوم - بدون نقاط
      pointsToAward = 0;
      isLate = true;
    }

    if (pointsToAward > 0) {
      const studentInfo = studentMap[sub.student_id];
      const studentName = studentInfo ? studentInfo.full_name : 'غير معروف';

      console.log(`📖 ${studentName} | ${assignment.book_name} (${targetDateStr}) | سلّم: ${submittedDateStr} | فرق: ${diffDays} يوم | النقاط: ${pointsToAward}${isLate ? ' (متأخر)' : ''}`);

      updates.push({
        submissionId: sub.id,
        studentId: sub.student_id,
        pointsToAward,
        isLate
      });

      if (studentMap[sub.student_id]) {
        studentMap[sub.student_id].pointsToAdd += pointsToAward;
      }
    } else {
      const studentInfo = studentMap[sub.student_id];
      const studentName = studentInfo ? studentInfo.full_name : 'غير معروف';
      console.log(`⏭️  ${studentName} | ${assignment.book_name} (${targetDateStr}) | سلّم: ${submittedDateStr} | فرق: ${diffDays} يوم | بدون نقاط (فائت)`);
    }
  }

  if (updates.length === 0) {
    console.log('\n✅ لا توجد نقاط مستحقة للإضافة.');
    return;
  }

  console.log(`\n--- ملخص النقاط المستحقة ---`);
  for (const [id, student] of Object.entries(studentMap)) {
    if (student.pointsToAdd > 0) {
      console.log(`👤 ${student.full_name}: +${student.pointsToAdd} نقطة (الرصيد الحالي: ${student.points || 0})`);
    }
  }

  // 5. تحديث التسليمات بالنقاط
  console.log('\n⏳ جاري تحديث قاعدة البيانات...\n');

  for (const update of updates) {
    const { error } = await supabase
      .from('submissions')
      .update({
        points_awarded: update.pointsToAward,
        is_late: update.isLate
      })
      .eq('id', update.submissionId);

    if (error) {
      console.error(`❌ خطأ في تحديث التسليم ${update.submissionId}:`, error.message);
    }
  }

  // 6. تحديث نقاط الطلاب
  for (const [id, student] of Object.entries(studentMap)) {
    if (student.pointsToAdd > 0) {
      const newPoints = (student.points || 0) + student.pointsToAdd;
      const { error } = await supabase
        .from('users')
        .update({ points: newPoints })
        .eq('id', id);

      if (error) {
        console.error(`❌ خطأ في تحديث نقاط ${student.full_name}:`, error.message);
      } else {
        console.log(`✅ ${student.full_name}: ${student.points || 0} → ${newPoints} نقطة (+${student.pointsToAdd})`);
      }
    }
  }

  console.log('\n🎉 تم إصلاح النقاط المفقودة بنجاح!');
}

fixMissingPoints().catch(err => {
  console.error('حدث خطأ غير متوقع:', err);
  process.exit(1);
});
