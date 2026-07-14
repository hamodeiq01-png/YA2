// Student Dashboard Logic

// Protect Route
window.addEventListener('DOMContentLoaded', () => {
  const user = getUser();
  if (!isLoggedIn() || !user || user.role !== 'student') {
    logout();
    return;
  }

  // Set name
  document.getElementById('studentName').textContent = `الطالب: ${user.fullName}`;

  // Load dashboard data
  loadStudentDashboard();
});

function loadStudentDashboard() {
  loadTodayAssignment();
  loadHistory();
}

async function loadTodayAssignment() {
  const detailsEl = document.getElementById('assignmentDetails');
  const submissionCard = document.getElementById('submissionCard');

  try {
    const response = await fetch(`${API_BASE}/student/assignment/today`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();

    if (response.ok) {
      if (!data.assignment) {
        detailsEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🌸</div>
            <p style="font-weight: 700; font-size: 1.1rem; color: var(--primary);">لا يوجد ورد قراءة مجدول لك اليوم.</p>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 5px;">استرح اليوم، أو اقرأ قراءة حرة مفيدة!</p>
          </div>`;
        submissionCard.style.display = 'none';
        return;
      }

      const assign = data.assignment;
      document.getElementById('assignmentId').value = assign.id;

      let contentHtml = `
        <div style="padding: 10px 0;">
          <div style="font-size: 1.4rem; font-weight: 800; color: var(--primary); margin-bottom: 10px;">
            📖 كتاب: ${escapeHtml(assign.bookName)}
          </div>
          <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 15px;">
            <div style="font-size: 1.1rem; font-weight: 700; color: var(--accent);">
              صفحات الورد: من ${assign.startPage} إلى ${assign.endPage}
            </div>
            <div class="user-badge" style="background-color: var(--primary-glow);">
              مجدول لتاريخ: ${assign.targetDate}
            </div>
          </div>
        </div>`;

      // Check if student already submitted progress for today
      if (data.submission) {
        submissionCard.style.display = 'none';
        
        let subDetails = '';
        if (data.submission.questions) {
          subDetails += `
            <div class="detail-box">
              <div class="detail-box-title">❓ سؤالك المرسل:</div>
              <div>${escapeHtml(data.submission.questions)}</div>
            </div>`;
        }
        if (data.submission.freeSpace) {
          subDetails += `
            <div class="detail-box">
              <div class="detail-box-title">📝 مساحتك الحرة / تلخيصك:</div>
              <div>${escapeHtml(data.submission.freeSpace)}</div>
            </div>`;
        }

        contentHtml += `
          <div style="background-color: rgba(16, 185, 129, 0.08); border: 1.5px solid var(--success); border-radius: 8px; padding: 20px; margin-top: 15px;">
            <h4 style="color: var(--success); font-weight: 800; display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              ✓ تم إرسال إنجاز الورد بنجاح!
            </h4>
            <p style="font-size: 0.95rem; color: var(--text-main);">لقد أرسلت إنجازك للمعلم، بارك الله في همتك ونفع بك.</p>
            ${subDetails}
          </div>`;
      } else {
        // Show submission form
        submissionCard.style.display = 'block';
      }

      detailsEl.innerHTML = contentHtml;
    }
  } catch (error) {
    console.error('Error loading today\'s assignment:', error);
    detailsEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        حدث خطأ أثناء تحميل تكليف اليوم. يرجى إعادة تحميل الصفحة.
      </div>`;
  }
}

async function loadHistory() {
  const historyEl = document.getElementById('historyList');
  try {
    const response = await fetch(`${API_BASE}/student/assignments/history`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();

    if (response.ok) {
      if (data.history.length === 0) {
        historyEl.innerHTML = `
          <tr>
            <td colspan="4" class="empty-state">
              لا توجد أوراد سابقة مسجلة.
            </td>
          </tr>`;
        return;
      }

      historyEl.innerHTML = data.history.map(item => {
        let statusBadge = '';
        if (item.submittedAt) {
          statusBadge = item.isCompleted 
            ? '<span class="badge badge-success">تم الإنجاز ✓</span>'
            : '<span class="badge badge-danger">لم ينجز ✗</span>';
        } else {
          statusBadge = '<span class="badge badge-danger" style="background-color: #F3F4F6; color: #9CA3AF;">لم يسجل</span>';
        }

        return `
          <tr>
            <td style="font-weight: 700; color: var(--primary);">${escapeHtml(item.bookName)}</td>
            <td>${item.startPage} - ${item.endPage}</td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${item.targetDate}</td>
            <td>${statusBadge}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (error) {
    console.error('Error loading student history:', error);
  }
}

async function handleSubmitProgress(e) {
  e.preventDefault();
  const assignmentId = document.getElementById('assignmentId').value;
  const isCompleted = document.getElementById('isCompleted').checked;
  const questions = document.getElementById('questions').value;
  const freeSpace = document.getElementById('freeSpace').value;

  try {
    const response = await fetch(`${API_BASE}/student/submit`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ assignmentId, isCompleted, questions, freeSpace })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showAlert('studentAlert', 'تم تسجيل وإرسال إنجازك بنجاح. هنيئاً لك!', 'success');
    document.getElementById('submissionForm').reset();
    loadStudentDashboard();
  } catch (error) {
    showAlert('studentAlert', error.message, 'danger');
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
