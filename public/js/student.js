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
  loadStudentPoints();
  loadTodayAssignments();
  loadHistory();
}

// --- تحميل نقاط الطالب ---
async function loadStudentPoints() {
  try {
    const response = await fetch(`${API_BASE}/student/points`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();

    if (response.ok) {
      const pointsEl = document.getElementById('studentPointsValue');
      const rankBadgeEl = document.getElementById('studentRankBadge');
      const rankTextEl = document.getElementById('studentRankText');
      const motivationEl = document.getElementById('pointsMotivation');

      // تحديث النقاط مع تأثير بصري
      pointsEl.textContent = data.points || 0;

      // تحديث الترتيب
      if (data.rank && data.totalStudents) {
        let rankEmoji = '';
        if (data.rank === 1) rankEmoji = '🥇';
        else if (data.rank === 2) rankEmoji = '🥈';
        else if (data.rank === 3) rankEmoji = '🥉';
        else rankEmoji = `#${data.rank}`;

        rankBadgeEl.textContent = rankEmoji;
        rankTextEl.textContent = `ترتيبك ${data.rank} من ${data.totalStudents} طالب`;
      }

      // رسائل تحفيزية حسب النقاط
      const points = data.points || 0;
      if (points === 0) {
        motivationEl.textContent = 'ابدأ رحلتك في القراءة واكسب أولى نقاطك! 🚀';
      } else if (points < 30) {
        motivationEl.textContent = 'بداية ممتازة! واصل القراءة واكسب المزيد! 💪';
      } else if (points < 70) {
        motivationEl.textContent = 'أحسنت! أنت في تقدم مستمر، واصل الهمة! 🌟';
      } else if (points < 150) {
        motivationEl.textContent = 'ما شاء الله! أنت من المتميزين في القراءة! 🏆';
      } else {
        motivationEl.textContent = 'بارك الله فيك! أنت قدوة في المثابرة والقراءة! 👑';
      }
    }
  } catch (error) {
    console.error('Error loading student points:', error);
  }
}

async function loadTodayAssignments() {
  const container = document.getElementById('assignmentsContainer');

  try {
    const response = await fetch(`${API_BASE}/student/assignments/today`, {
      headers: getAuthHeaders()
    });
    const data = await response.json();

    if (response.ok) {
      if (!data.assignments || data.assignments.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🌸</div>
            <p style="font-weight: 700; font-size: 1.1rem; color: var(--primary);">لا يوجد ورد قراءة مجدول لك اليوم.</p>
            <p style="color: var(--text-muted); font-size: 0.95rem; margin-top: 5px;">استرح اليوم، أو اقرأ قراءة حرة مفيدة!</p>
          </div>`;
        return;
      }

      container.innerHTML = data.assignments.map((item, index) => {
        const assign = item.assignment;
        const sub = item.submission;

        // حساب الفرق بالأيام
        const todayStr = new Date().toLocaleDateString('sv');
        const today = new Date(todayStr);
        const target = new Date(assign.targetDate);
        const diffDays = Math.floor((today - target) / (1000 * 60 * 60 * 24));

        // تحديد نوع الورد
        let assignType = 'today'; // اليوم
        let borderColor = 'var(--primary)';
        let pointsBadge = '<span class="badge badge-success">✨ 10 نقاط عند الإنجاز</span>';

        if (diffDays === 1) {
          assignType = 'late';
          borderColor = '#f59e0b';
          pointsBadge = '<span class="badge badge-warning">⏰ تسليم متأخر (5 نقاط بدلاً من 10)</span>';
        } else if (diffDays >= 2) {
          assignType = 'missed';
          borderColor = '#ef4444';
          pointsBadge = '<span class="badge badge-missed">📛 ورد فائت - بدون نقاط</span>';
        }

        let html = `
          <div class="assignment-block ${assignType === 'missed' ? 'assignment-missed' : ''}" style="padding: 16px; background: var(--surface); border-radius: 12px; margin-bottom: 16px; border-right: 4px solid ${borderColor};">`;

        // تنبيه خاص للأوراد الفائتة
        if (assignType === 'missed' && !sub) {
          html += `
            <div class="missed-alert">
              <div class="missed-alert-icon">📛</div>
              <div class="missed-alert-text">
                <strong>ورد فائت</strong> - يمكنك إنجازه لكن بدون نقاط
              </div>
            </div>`;
        }

        html += `
            <div style="font-size: 1.2rem; font-weight: 800; color: var(--primary); margin-bottom: 8px;">
              📖 كتاب: ${escapeHtml(assign.bookName)}
            </div>
            <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 12px; flex-wrap: wrap;">
              <div style="font-size: 1rem; font-weight: 700; color: var(--accent);">
                صفحات الورد: من ${assign.startPage} إلى ${assign.endPage}
              </div>
              <span class="user-badge" style="background-color: var(--primary-glow);">
                مجدول لتاريخ: ${assign.targetDate}
              </span>
              ${pointsBadge}
            </div>`;

        if (sub) {
          // Already submitted
          let subDetails = '';
          if (sub.questions) {
            subDetails += `
              <div class="detail-box">
                <div class="detail-box-title">❓ سؤالك المرسل:</div>
                <div>${escapeHtml(sub.questions)}</div>
              </div>`;
          }
          if (sub.freeSpace) {
            subDetails += `
              <div class="detail-box">
                <div class="detail-box-title">📝 مساحتك الحرة / تلخيصك:</div>
                <div>${escapeHtml(sub.freeSpace)}</div>
              </div>`;
          }

          html += `
            <div style="background-color: rgba(16, 185, 129, 0.08); border: 1.5px solid var(--success); border-radius: 8px; padding: 16px; margin-top: 8px;">
              <h4 style="color: var(--success); font-weight: 800; display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                ✓ تم إرسال إنجاز هذا الورد بنجاح!
              </h4>
              <p style="font-size: 0.9rem; color: var(--text-main);">
                لقد أرسلت إنجازك للمعلم، بارك الله في همتك.
                ${sub.pointsAwarded > 0 ? `<span class="points-badge" style="margin-right: 8px;">+${sub.pointsAwarded} ⭐</span>` : '<span class="badge badge-missed" style="margin-right: 8px;">بدون نقاط</span>'}
                ${sub.isLate ? '<span class="badge badge-warning" style="margin-right: 4px;">متأخر</span>' : ''}
              </p>
              ${subDetails}
            </div>`;
        } else {
          // Show submission form
          const submitBtnText = assignType === 'missed'
            ? 'إرسال الإنجاز (بدون نقاط)'
            : 'إرسال الإنجاز للمعلم';
          const submitBtnStyle = assignType === 'missed'
            ? 'style="background: linear-gradient(135deg, #6B7280, #9CA3AF);"'
            : '';

          html += `
            <div style="border-top: 1px solid var(--border); padding-top: 12px; margin-top: 8px;">
              <h4 style="font-weight: 700; margin-bottom: 10px; color: var(--text-primary);">✍️ تسجيل إنجازك</h4>
              <form onsubmit="handleSubmitProgress(event, '${assign.id}', ${index})">
                <div class="form-group">
                  <label class="checkbox-label">
                    <input type="checkbox" id="isCompleted_${index}">
                    <span>أؤكد أنني قرأت هذا الورد كاملاً وبتركيز.</span>
                  </label>
                </div>
                <div class="form-group">
                  <label>هل لديك أسئلة حول ما قرأت؟ (اختياري)</label>
                  <textarea id="questions_${index}" class="form-control" placeholder="اكتب سؤالك هنا..."></textarea>
                </div>
                <div class="form-group">
                  <label>مساحة حرة (تلخيص، خواطر) (اختياري)</label>
                  <textarea id="freeSpace_${index}" class="form-control" placeholder="اكتب ما يجول في خاطرك..."></textarea>
                </div>
                <button type="submit" class="btn btn-primary" ${submitBtnStyle}>${submitBtnText}</button>
              </form>
            </div>`;
        }

        html += '</div>';
        return html;
      }).join('');
    }
  } catch (error) {
    console.error('Error loading today\'s assignments:', error);
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        حدث خطأ أثناء تحميل أوراد اليوم. يرجى إعادة تحميل الصفحة.
      </div>`;
  }
}

async function handleSubmitProgress(e, assignmentId, index) {
  e.preventDefault();
  const isCompleted = document.getElementById(`isCompleted_${index}`).checked;
  const questions = document.getElementById(`questions_${index}`).value;
  const freeSpace = document.getElementById(`freeSpace_${index}`).value;

  if (!isCompleted) {
    showAlert('studentAlert', 'يرجى تأكيد أنك قرأت الورد أولاً بوضع علامة ✓', 'danger');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/student/submit`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ assignmentId, isCompleted, questions, freeSpace })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error);

    showAlert('studentAlert', data.message, 'success');
    loadStudentDashboard();
  } catch (error) {
    showAlert('studentAlert', error.message, 'danger');
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
            <td colspan="5" class="empty-state">
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
          if (item.isLate && item.isCompleted) {
            statusBadge += ' <span class="badge badge-warning">متأخر</span>';
          }
        } else {
          statusBadge = '<span class="badge badge-danger" style="background-color: #F3F4F6; color: #9CA3AF;">لم يسجل</span>';
        }

        // النقاط
        let pointsDisplay = '';
        if (item.pointsAwarded > 0) {
          pointsDisplay = `<span class="points-badge-sm">+${item.pointsAwarded} ⭐</span>`;
        } else {
          pointsDisplay = '<span style="color: var(--text-muted);">-</span>';
        }

        return `
          <tr>
            <td style="font-weight: 700; color: var(--primary);">${escapeHtml(item.bookName)}</td>
            <td>${item.startPage} - ${item.endPage}</td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${item.targetDate}</td>
            <td>${statusBadge}</td>
            <td>${pointsDisplay}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (error) {
    console.error('Error loading student history:', error);
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
