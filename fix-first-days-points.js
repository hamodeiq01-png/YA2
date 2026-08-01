/**
 * سكربت لإضافة 10 نقاط لكل طالب أنجز أوراد أول يومين (18 و 19 يوليو)
 * بغض النظر عن تاريخ التسليم، لأن نظام النقاط لم يكن مفعلاً وقتها
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const FIRST_DAYS = ['2026-07-18', '2026-07-19'];

async function fixFirstDaysPoints() {
  console.log('=== إضافة 10 نقاط لأوراد أول يومين (18 و 19 يوليو) ===\n');

  // 1. جلب أوراد أول يومين
  const { data: assignments, error: assErr } = await supabase
    .from('assignments')
    .select('id, target_date, book_name')
    .in('target_date', FIRST_DAYS);

  if (assErr || !assignments || assignments.length === 0) {
    console.log('لم يتم العثور على أوراد لهذه التواريخ');
    return;
  }

  console.log(`📚 عدد الأوراد في أول يومين: ${assignments.length}`);
  const assignmentIds = assignments.map(a => a.id);

  // 2. جلب التسليمات المكتملة لهذه الأوراد التي نقاطها 0 أو null
  const { data: submissions, error: subErr } = await supabase
    .from('submissions')
    .select('*')
    .in('assignment_id', assignmentIds)
    .eq('is_completed', true)
    .or('points_awarded.eq.0,points_awarded.is.null');

  if (subErr) {
    console.error('خطأ في جلب التسليمات:', subErr.message);
    return;
  }

  if (!submissions || submissions.length === 0) {
    console.log('✅ جميع التسليمات المكتملة لأول يومين لديها نقاط بالفعل!');
    return;
  }

  console.log(`🔍 عدد التسليمات المكتملة بدون نقاط: ${submissions.length}\n`);

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

  const studentMap = {};
  students.forEach(s => { studentMap[s.id] = { ...s, pointsToAdd: 0 }; });

  const assignmentMap = {};
  assignments.forEach(a => { assignmentMap[a.id] = a; });

  // 4. عرض التفاصيل وحساب النقاط
  for (const sub of submissions) {
    const assignment = assignmentMap[sub.assignment_id];
    const student = studentMap[sub.student_id];
    if (!assignment || !student) continue;

    const submittedDate = new Date(sub.submitted_at).toISOString().split('T')[0];
    console.log(`📖 ${student.full_name} | ${assignment.book_name} (${assignment.target_date}) | سلّم: ${submittedDate} | ← +10 نقاط`);

    studentMap[sub.student_id].pointsToAdd += 10;
  }

  // 5. ملخص
  console.log('\n--- ملخص النقاط المستحقة ---');
  for (const [id, student] of Object.entries(studentMap)) {
    if (student.pointsToAdd > 0) {
      console.log(`👤 ${student.full_name}: +${student.pointsToAdd} نقطة (الرصيد الحالي: ${student.points || 0} → الجديد: ${(student.points || 0) + student.pointsToAdd})`);
    }
  }

  // 6. تحديث التسليمات
  console.log('\n⏳ جاري التحديث...\n');

  for (const sub of submissions) {
    const { error } = await supabase
      .from('submissions')
      .update({
        points_awarded: 10,
        is_late: false
      })
      .eq('id', sub.id);

    if (error) {
      console.error(`❌ خطأ في تحديث تسليم ${sub.id}:`, error.message);
    }
  }

  // 7. تحديث نقاط الطلاب
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

  console.log('\n🎉 تم إضافة النقاط بنجاح!');
}

fixFirstDaysPoints().catch(err => {
  console.error('خطأ:', err);
  process.exit(1);
});
