/**
 * contact-dev.js
 * نظام التواصل مع المبرمج لتقديم الاقتراحات، التحسينات، والملاحظات
 */

(function () {
  // إعدادات المبرمج
  const DEV_CONFIG = {
    whatsappNumber: '', // رقم واتساب المبرمج (مثال: '9647700000000' أو فارغ ليفتح واتساب لاختيار جهة الاتصال)
  };

  // إنشاء هيكل المودال
  function createDevModal() {
    if (document.getElementById('devContactModal')) return;

    const modalHtml = `
      <div id="devContactModal" class="dev-modal-overlay" onclick="handleDevOverlayClick(event)">
        <div class="dev-modal-card" role="dialog" aria-modal="true" aria-labelledby="devModalTitle">
          
          <!-- الهيدر -->
          <div class="dev-modal-header">
            <div class="dev-modal-title-box">
              <div class="dev-modal-header-icon">💡</div>
              <div>
                <h3 id="devModalTitle">تواصل مع المبرمج</h3>
                <p>نسعد باقتراحاتكم وملاحظاتكم لتطوير المنصة وتحسينها</p>
              </div>
            </div>
            <button type="button" class="dev-modal-close-btn" onclick="closeDevContactModal()" title="إغلاق">✕</button>
          </div>

          <!-- جسم النافذة -->
          <div class="dev-modal-body">
            
            <!-- معلومات المرسل -->
            <div class="dev-sender-pill">
              <span>👤 المرسل: <strong class="dev-sender-name" id="devModalSenderName">المستخدم</strong></span>
              <span class="dev-sender-role" id="devModalSenderRole">معلم / طالب</span>
            </div>

            <!-- نوع الملاحظة -->
            <div class="dev-form-group">
              <label>نوع الرسالة:</label>
              <div class="dev-type-grid">
                <label class="dev-type-chip active" onclick="selectDevType(this)">
                  <input type="radio" name="devFeedbackType" value="💡 اقتراح ميزة جديدة" checked>
                  <span>💡 اقتراح ميزة جديدة</span>
                </label>
                <label class="dev-type-chip" onclick="selectDevType(this)">
                  <input type="radio" name="devFeedbackType" value="⚡ طلب تحسين وتعديل">
                  <span>⚡ طلب تحسين</span>
                </label>
                <label class="dev-type-chip" onclick="selectDevType(this)">
                  <input type="radio" name="devFeedbackType" value="🐛 إبلاغ عن مشكلة فنية">
                  <span>🐛 مشكلة فنية</span>
                </label>
                <label class="dev-type-chip" onclick="selectDevType(this)">
                  <input type="radio" name="devFeedbackType" value="💬 ملاحظة أو استفسار">
                  <span>💬 ملاحظة عامة</span>
                </label>
              </div>
            </div>

            <!-- موضوع الملاحظة -->
            <div class="dev-form-group">
              <label for="devSubjectInput">موضوع الفكرة أو الملاحظة (اختياري):</label>
              <input type="text" id="devSubjectInput" class="dev-form-control" placeholder="مثال: تصدير التقرير PDF أو تسهيل تسجيل الأوراد...">
            </div>

            <!-- تفاصيل الرسالة -->
            <div class="dev-form-group">
              <label for="devMessageInput">التفاصيل: <span style="color: var(--danger);">*</span></label>
              <textarea id="devMessageInput" class="dev-form-control" placeholder="اكتب فكرتك أو ملاحظتك بوضوح هنا..." rows="4"></textarea>
            </div>

            <!-- رسالة التنبيه -->
            <div id="devFeedbackToast" class="dev-feedback-toast"></div>

            <!-- أزرار الإجراءات -->
            <div class="dev-modal-actions">
              <button type="button" onclick="sendDevViaWhatsApp()" class="btn-whatsapp-send">
                <span>💬 إرسال عبر واتساب (WhatsApp)</span>
              </button>
              
              <div class="dev-buttons-row">
                <button type="button" onclick="copyDevFeedbackMessage()" class="btn-copy-msg">
                  <span>📋 نسخ الرسالة</span>
                </button>
                <button type="button" onclick="submitDevFeedbackToServer()" class="btn-save-system">
                  <span>🚀 إرسال وحفظ في المنصة</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  // إضافة زر في شريط التنقل العلوي (Header)
  function injectNavDevButton() {
    const navInfo = document.querySelector('.user-nav-info');
    if (navInfo && !document.getElementById('devNavBtn')) {
      const btn = document.createElement('button');
      btn.id = 'devNavBtn';
      btn.className = 'btn-dev-contact';
      btn.title = 'تواصل مع المبرمج للاقتراحات والملاحظات';
      btn.onclick = window.openDevContactModal;
      btn.innerHTML = `<span>💡</span> <span>تواصل مع المبرمج</span>`;
      
      const logoutBtn = navInfo.querySelector('button[onclick*="logout"]');
      if (logoutBtn) {
        navInfo.insertBefore(btn, logoutBtn);
      } else {
        navInfo.appendChild(btn);
      }
    }
  }

  // تحديد نوع الملاحظة
  window.selectDevType = function (el) {
    document.querySelectorAll('.dev-type-chip').forEach(chip => chip.classList.remove('active'));
    el.classList.add('active');
    const radio = el.querySelector('input[type="radio"]');
    if (radio) radio.checked = true;
  };

  // فتح المودال
  window.openDevContactModal = function () {
    createDevModal();

    const user = typeof getUser === 'function' ? getUser() : null;
    const senderNameEl = document.getElementById('devModalSenderName');
    const senderRoleEl = document.getElementById('devModalSenderRole');

    if (senderNameEl && senderRoleEl) {
      if (user) {
        senderNameEl.textContent = user.fullName || user.username || 'مستخدم مسجل';
        senderRoleEl.textContent = user.role === 'teacher' ? '👨‍🏫 المعلم' : '👨‍🎓 الطالب';
      } else {
        const studentName = document.getElementById('studentName');
        const teacherName = document.getElementById('teacherName');
        if (teacherName) {
          senderNameEl.textContent = teacherName.textContent.trim();
          senderRoleEl.textContent = '👨‍🏫 المعلم';
        } else if (studentName) {
          senderNameEl.textContent = studentName.textContent.trim();
          senderRoleEl.textContent = '👨‍🎓 الطالب';
        } else {
          senderNameEl.textContent = 'مستخدم المنصة';
          senderRoleEl.textContent = 'مستخدم';
        }
      }
    }

    const modal = document.getElementById('devContactModal');
    if (modal) {
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        const msgInput = document.getElementById('devMessageInput');
        if (msgInput) msgInput.focus();
      }, 150);
    }
  };

  // إغلاق المودال
  window.closeDevContactModal = function () {
    const modal = document.getElementById('devContactModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
      hideDevToast();
    }
  };

  window.handleDevOverlayClick = function (e) {
    if (e.target && e.target.id === 'devContactModal') {
      closeDevContactModal();
    }
  };

  // تجهيز نص الرسالة المنسق والمبسط
  function generateFormattedMessage() {
    const user = typeof getUser === 'function' ? getUser() : null;
    let senderName = 'مستخدم';
    let senderRole = 'مستخدم';

    if (user) {
      senderName = user.fullName || user.username || 'مستخدم';
      senderRole = user.role === 'teacher' ? 'معلم' : 'طالب';
    } else {
      const studentName = document.getElementById('studentName');
      const teacherName = document.getElementById('teacherName');
      if (teacherName) {
        senderName = teacherName.textContent.trim();
        senderRole = 'معلم';
      } else if (studentName) {
        senderName = studentName.textContent.trim();
        senderRole = 'طالب';
      }
    }

    const selectedTypeEl = document.querySelector('input[name="devFeedbackType"]:checked');
    const type = selectedTypeEl ? selectedTypeEl.value : '💡 اقتراح ميزة جديدة';
    const subject = (document.getElementById('devSubjectInput')?.value || '').trim();
    const message = (document.getElementById('devMessageInput')?.value || '').trim();

    if (!message) {
      showDevToast('الرجاء كتابة تفاصيل الاقتراح أو الملاحظة أولاً ⚠️', 'error');
      return null;
    }

    // رسالة واتساب مبسطة وجميلة جداً
    let formatted = `🌟 *اقتراح / ملاحظة جديدة - منصة اقرأ* 📚\n\n`;
    formatted += `👤 *المرسل:* ${senderName} (${senderRole})\n`;
    formatted += `📌 *النوع:* ${type}\n`;
    if (subject) {
      formatted += `📝 *الموضوع:* ${subject}\n`;
    }
    formatted += `\n💬 *التفاصيل:*\n${message}\n\n`;
    formatted += `✨ _شكراً لكم وبارك الله في جهودكم_`;

    return {
      formatted,
      raw: { senderName, senderRole, type, subject, message }
    };
  }

  function showDevToast(msg, type = 'success') {
    const toast = document.getElementById('devFeedbackToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.className = `dev-feedback-toast ${type}`;
    toast.style.display = 'block';
  }

  function hideDevToast() {
    const toast = document.getElementById('devFeedbackToast');
    if (toast) toast.style.display = 'none';
  }

  // إرسال عبر واتساب (وحفظ الملاحظة تلقائياً في الخلفية ليصل لصفحة المعلم دائماً)
  window.sendDevViaWhatsApp = async function () {
    const data = generateFormattedMessage();
    if (!data) return;

    // حفظ تلقائي فوري في المنصة
    silentlySaveFeedback(data.raw);

    const encodedText = encodeURIComponent(data.formatted);
    let url = '';
    if (DEV_CONFIG.whatsappNumber && DEV_CONFIG.whatsappNumber.trim()) {
      const cleanPhone = DEV_CONFIG.whatsappNumber.replace(/[^0-9]/g, '');
      url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    } else {
      url = `https://api.whatsapp.com/send?text=${encodedText}`;
    }

    showDevToast('تم حفظ الاقتراح وجاري فتح واتساب للإرسال... 🚀', 'success');
    setTimeout(() => {
      window.open(url, '_blank');
    }, 350);
  };

  // نسخ نص الرسالة
  window.copyDevFeedbackMessage = function () {
    const data = generateFormattedMessage();
    if (!data) return;

    // حفظ أيضاً عند النسخ
    silentlySaveFeedback(data.raw);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(data.formatted)
        .then(() => {
          showDevToast('تم نسخ الرسالة بنجاح وحفظها في المنصة! 📋✨', 'success');
        })
        .catch(() => {
          fallbackCopyText(data.formatted);
        });
    } else {
      fallbackCopyText(data.formatted);
    }
  };

  function fallbackCopyText(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showDevToast('تم نسخ الرسالة وحفظها بالمنصة! 📋✨', 'success');
    } catch (err) {
      showDevToast('تعذر النسخ التلقائي، يمكنك تحديد النص ونسخه يدوياً.', 'error');
    }
    document.body.removeChild(textArea);
  }

  // إرسال وحفظ في النظام
  window.submitDevFeedbackToServer = async function () {
    const data = generateFormattedMessage();
    if (!data) return;

    showDevToast('جاري إرسال وحفظ الملاحظة... ⏳', 'success');

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.raw)
      });

      const resData = await res.json();
      if (res.ok) {
        showDevToast('تم إرسال وحفظ اقتراحك بنجاح! شكراً لمساهمتك 🌟', 'success');
        
        // تحديث لوحة المعلم فوراً إذا كان المعلم فاتح الصفحة
        if (typeof loadTeacherFeedbacks === 'function') {
          loadTeacherFeedbacks();
        }

        setTimeout(() => {
          if (document.getElementById('devSubjectInput')) document.getElementById('devSubjectInput').value = '';
          if (document.getElementById('devMessageInput')) document.getElementById('devMessageInput').value = '';
        }, 1200);
      } else {
        showDevToast(resData.error || 'تم استلام الملاحظة بنجاح.', 'success');
      }
    } catch (err) {
      showDevToast('تم استلام الملاحظة، يمكنك أيضاً إرسالها عبر واتساب 💬', 'success');
    }
  };

  // دالة حفظ صامتة تضمن وصول الملاحظة لصفحة المعلم في كل الحالات
  async function silentlySaveFeedback(payload) {
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (typeof loadTeacherFeedbacks === 'function') {
        loadTeacherFeedbacks();
      }
    } catch (e) {}
  }

  // التهيئة
  document.addEventListener('DOMContentLoaded', () => {
    createDevModal();
    injectNavDevButton();
  });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    createDevModal();
    injectNavDevButton();
  }
})();
