// Teacher Dashboard Logic

// Protect Route
window.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  if (!isLoggedIn() || !user || user.role !== 'teacher') {
    logout();
    return;
  }

  // Set name
  document.getElementById('teacherName').textContent = `المعلم: ${user.fullName}`;
  
  // Set default target date to today
  const targetDateInput = document.getElementById('targetDate');
  if (targetDateInput) {
    targetDateInput.value = new Date().toLocaleDateString('sv');
  }

  // Initial Load
  loadDashboardData();
});

function loadDashboardData() {
  loadStudents();
  loadAssignments();
  loadSubmissions();
  loadPendingStudents();
}

async function loadStudents() {
  try {
    const response = await fetch(`${API_BASE}/teacher/students`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (response.ok) {
      document.getElementById('statTotalStudents').textContent = data.students.length;
    }
  } catch (error) {
    console.error('Error loading students:', error);
  }
}

async function loadPendingStudents() {
  try {
    const response = await fetch(`${API_BASE}/teacher/pending-students`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (response.ok) {
      const pendingCount = data.students.length;
      document.getElementById('statPendingStudents').textContent = pendingCount;

      const card = document.getElementById('pendingStudentsCard');
      const listEl = document.getElementById('pendingStudentsList');

      if (pendingCount === 0) {
        card.style.display = 'none';
        return;
      }

      card.style.display = 'block';
      listEl.innerHTML = data.students.map(student => {
        const date = new Date(student.createdAt).toLocaleDateString('ar-EG', {
          year: 'numeric', month: 'short', day: 'numeric'
        });
        return `
          <div class="pending-student-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--surface); border-radius: 10px; margin-bottom: 10px; border-right: 4px solid #f59e0b;">
            <div>
              <div style="font-weight: 700; color: var(--text-primary);">${escapeHtml(student.fullName)}</div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">@${escapeHtml(student.username)} · سجّل في ${date}</div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button onclick="approveStudent('${student.id}')" class="btn btn-primary" style="width: auto; padding: 8px 18px; font-size: 0.85rem;">✓ قبول</button>
              <button onclick="rejectStudent('${student.id}')" class="btn btn-secondary" style="width: auto; padding: 8px 18px; font-size: 0.85rem; background: #ef4444; border-color: #ef4444; color: white;">✗ رفض</button>
            </div>
          </div>
        `;
      }).join('');
    }
  } catch (error) {
    console.error('Error loading pending students:', error);
  }
}

async function approveStudent(studentId) {
  try {
    const response = await fetch(`${API_BASE}/teacher/approve-student`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ studentId })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showAlert('teacherAlert', data.message, 'success');
    loadDashboardData();
  } catch (error) {
    showAlert('teacherAlert', error.message, 'danger');
  }
}

async function rejectStudent(studentId) {
  if (!confirm('هل أنت متأكد من رفض هذا الطالب؟ سيتم حذف حسابه نهائياً.')) return;

  try {
    const response = await fetch(`${API_BASE}/teacher/reject-student`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ studentId })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showAlert('teacherAlert', 'تم رفض الطالب وحذف حسابه.', 'success');
    loadDashboardData();
  } catch (error) {
    showAlert('teacherAlert', error.message, 'danger');
  }
}

async function loadAssignments() {
  try {
    const response = await fetch(`${API_BASE}/teacher/assignments`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (response.ok) {
      const listEl = document.getElementById('assignmentsList');
      if (data.assignments.length === 0) {
        listEl.innerHTML = `
          <tr>
            <td colspan="4" class="empty-state">
              <div class="empty-state-icon">📅</div>
              لا توجد أوراد قراءة مجدولة بعد. أضف ورداً من القائمة الجانبية.
            </td>
          </tr>`;
        return;
      }

      listEl.innerHTML = data.assignments.map(a => `
        <tr>
          <td style="font-weight: 700;">${escapeHtml(a.bookName)}</td>
          <td>${a.startPage}</td>
          <td>${a.endPage}</td>
          <td><span class="user-badge" style="background-color: var(--primary-glow);">${a.targetDate}</span></td>
        </tr>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading assignments:', error);
  }
}

async function loadSubmissions() {
  try {
    const response = await fetch(`${API_BASE}/teacher/submissions`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();
    if (response.ok) {
      document.getElementById('statTotalSubmissions').textContent = data.submissions.length;
      
      const listEl = document.getElementById('submissionsList');
      if (data.submissions.length === 0) {
        listEl.innerHTML = `
          <tr>
            <td colspan="6" class="empty-state">
              <div class="empty-state-icon">📥</div>
              لا توجد إنجازات مرسلة بعد. سيظهر إنجاز الطلاب هنا فور إرساله.
            </td>
          </tr>`;
        return;
      }

      listEl.innerHTML = data.submissions.map(sub => {
        let statusBadge = '';
        if (sub.isCompleted) {
          statusBadge = '<span class="badge badge-success">أنجز القراءة ✓</span>';
        } else {
          statusBadge = '<span class="badge badge-danger">لم ينجز القراءة ✗</span>';
        }

        // Generate details section for questions/freeSpace if present
        let detailsHtml = '';
        if (sub.questions) {
          detailsHtml += `
            <div class="detail-box">
              <div class="detail-box-title">❓ سؤال من الطالب:</div>
              <div>${escapeHtml(sub.questions)}</div>
            </div>`;
        }
        if (sub.freeSpace) {
          detailsHtml += `
            <div class="detail-box">
              <div class="detail-box-title">📝 مساحة حرة / تلخيص:</div>
              <div>${escapeHtml(sub.freeSpace)}</div>
            </div>`;
        }

        if (!detailsHtml) {
          detailsHtml = '<span style="color: var(--text-muted); font-size: 0.9rem;">لا توجد ملاحظات</span>';
        }

        const dateFormatted = new Date(sub.submittedAt).toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit'
        }) + ' - ' + new Date(sub.submittedAt).toLocaleDateString('ar-EG');

        return `
          <tr>
            <td style="font-weight: 700; color: var(--primary);">${escapeHtml(sub.studentName)}</td>
            <td>
              <div style="font-weight: 600;">${escapeHtml(sub.bookName)}</div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">صفحة: ${sub.pages}</div>
            </td>
            <td><span class="user-badge" style="font-size:0.8rem;">${sub.targetDate}</span></td>
            <td>${statusBadge}</td>
            <td style="max-width: 300px;">${detailsHtml}</td>
            <td style="font-size: 0.85rem; color: var(--text-muted);">${dateFormatted}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (error) {
    console.error('Error loading submissions:', error);
  }
}

async function handleCreateAssignment(e) {
  e.preventDefault();
  const bookName = document.getElementById('bookName').value;
  const startPage = document.getElementById('startPage').value;
  const endPage = document.getElementById('endPage').value;
  const targetDate = document.getElementById('targetDate').value;

  try {
    const response = await fetch(`${API_BASE}/teacher/assignments`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ bookName, startPage, endPage, targetDate })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showAlert('teacherAlert', 'تم نشر الورد اليومي بنجاح!', 'success');
    document.getElementById('assignmentForm').reset();
    document.getElementById('targetDate').value = new Date().toLocaleDateString('sv');
    loadDashboardData();
  } catch (error) {
    showAlert('teacherAlert', error.message, 'danger');
  }
}

async function handleCreateStudent(e) {
  e.preventDefault();
  const fullName = document.getElementById('studentFullName').value;
  const username = document.getElementById('studentUsername').value;
  const password = document.getElementById('studentPassword').value;

  try {
    const response = await fetch(`${API_BASE}/teacher/students`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ fullName, username, password })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showAlert('teacherAlert', `تم إنشاء حساب الطالب "${fullName}" بنجاح!`, 'success');
    document.getElementById('studentForm').reset();
    loadDashboardData();
  } catch (error) {
    showAlert('teacherAlert', error.message, 'danger');
  }
}

async function handleCreateTeacher(e) {
  e.preventDefault();
  const fullName = document.getElementById('newTeacherFullName').value;
  const username = document.getElementById('newTeacherUsername').value;
  const password = document.getElementById('newTeacherPassword').value;

  try {
    const response = await fetch(`${API_BASE}/teacher/create-teacher`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ fullName, username, password })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showAlert('teacherAlert', `تم إنشاء حساب المعلم "${fullName}" بنجاح!`, 'success');
    document.getElementById('teacherForm').reset();
  } catch (error) {
    showAlert('teacherAlert', error.message, 'danger');
  }
}

// Simple HTML escaping helper for security
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
