// Theme toggle functionality
const themeToggle = document.getElementById('themeToggle');
const htmlElement = document.documentElement;

// Check for saved theme preference
if (localStorage.getItem('darkMode') === 'true') {
  htmlElement.classList.add('dark-mode');
  themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
}

themeToggle.addEventListener('click', () => {
  htmlElement.classList.toggle('dark-mode');
  const isDarkMode = htmlElement.classList.contains('dark-mode');
  localStorage.setItem('darkMode', isDarkMode);
  
  themeToggle.innerHTML = isDarkMode 
    ? '<i class="fas fa-sun"></i>' 
    : '<i class="fas fa-moon"></i>';
});

// Initialize Quill editor
var quill = new Quill('#editor', {
  theme: 'snow',
  placeholder: 'Write your content here...',
  modules: {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ 'header': 1 }, { 'header': 2 }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'direction': 'rtl' }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'font': [] }],
      [{ 'align': [] }],
      ['clean'],
      ['link', 'image']
    ]
  }
});

var answerQuill = new Quill('#answerEditor', {
  theme: 'snow',
  placeholder: 'Write your answer here...',
  modules: {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ 'header': 1 }, { 'header': 2 }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      ['link']
    ]
  }
});

// Toast notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const toastIcon = toast.querySelector('.toast-icon');
  
  toast.className = 'toast';
  toast.classList.add(`toast-${type}`);
  
  toastIcon.className = 'toast-icon';
  toastIcon.innerHTML = type === 'success' 
    ? '<i class="fas fa-check-circle"></i>' 
    : '<i class="fas fa-exclamation-circle"></i>';
  
  toastMessage.textContent = message;
  
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Loading indicator
function showLoading() {
  document.getElementById('loading').classList.add('show');
}

function hideLoading() {
  document.getElementById('loading').classList.remove('show');
}

// Load knowledge entries
async function loadKnowledge() {
  try {
    showLoading();
    const response = await fetch('/api/admin/knowledge');
    const data = await response.json();
    
    const tableBody = document.querySelector('#knowledgeTable tbody');
    tableBody.innerHTML = '';
    
    if (data.knowledge && data.knowledge.length > 0) {
      data.knowledge.forEach((item, index) => {
        const row = document.createElement('tr');
        row.className = 'knowledge-item';
        row.style.animationDelay = `${index * 0.1}s`;
        
        row.innerHTML = `
          <td>${item.id}</td>
          <td>${escapeHtml(item.title || '')}</td>
          <td>${escapeHtml(item.question || '')}</td>
          <td class="content-preview">${item.answer ? item.answer.substring(0, 50) + '...' : ''}</td>
          <td class="content-preview">${item.content ? item.content.substring(0, 50) + '...' : ''}</td>
          <td>
            <button class="btn btn-danger action-btn delete-btn" data-id="${item.id}">
              <i class="fas fa-trash-alt"></i> Delete
            </button>
          </td>
        `;
        
        tableBody.appendChild(row);
      });
      
      document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', deleteKnowledge);
      });
    } else {
      tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No knowledge entries found</td></tr>';
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('An error occurred while loading knowledge', 'error');
  } finally {
    hideLoading();
  }
}

// Add knowledge
document.getElementById('knowledgeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const title = document.getElementById('title').value;
  const question = document.getElementById('question').value;
  const answer = answerQuill.root.innerHTML;
  const content = quill.root.innerHTML;
  
  if (!title || !question || !answer || !content) {
    showToast('Please fill in all fields', 'error');
    return;
  }
  
  try {
    showLoading();
    const response = await fetch('/api/admin/knowledge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, content, question, answer }),
    });
    
    if (response.ok) {
      document.getElementById('title').value = '';
      document.getElementById('question').value = '';
      answerQuill.setContents([]);
      quill.setContents([]);
      
      loadKnowledge();
      
      showToast('Knowledge added successfully!');
    } else {
      const data = await response.json();
      showToast(`Error: ${data.error || 'Failed to add knowledge'}`, 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('An error occurred while adding knowledge', 'error');
  } finally {
    hideLoading();
  }
});

// Delete knowledge
async function deleteKnowledge() {
  const id = this.getAttribute('data-id');
  const row = this.closest('tr');
  
  if (confirm('Are you sure you want to delete this knowledge entry?')) {
    try {
      showLoading();
      const response = await fetch(`/api/admin/knowledge/${id}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // Add fade out animation before removing
        row.style.transition = 'opacity 0.5s, transform 0.5s';
        row.style.opacity = '0';
        row.style.transform = 'translateX(20px)';
        
        setTimeout(() => {
          loadKnowledge();
        }, 500);
        
        showToast('Knowledge deleted successfully!');
      } else {
        const data = await response.json();
        showToast(`Error: ${data.error || 'Failed to delete knowledge'}`, 'error');
      }
    } catch (error) {
      console.error('Error:', error);
      showToast('An error occurred while deleting knowledge', 'error');
    } finally {
      hideLoading();
    }
  }
}

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Load knowledge on page load
document.addEventListener('DOMContentLoaded', loadKnowledge);
