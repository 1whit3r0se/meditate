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

// DOM elements
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const resultsContainer = document.getElementById('resultsContainer');
const resultsList = document.getElementById('resultsList');
const resultsCount = document.getElementById('resultsCount');
const contentContainer = document.getElementById('contentContainer');

// Loading indicator
function showLoading() {
  document.getElementById('loading').classList.add('show');
}

function hideLoading() {
  document.getElementById('loading').classList.remove('show');
}

// Highlight search terms in text
function highlightText(text, searchTerms) {
  if (!text) return '';
  
  let result = text;
  searchTerms.forEach(term => {
    if (term.length > 2) { // Only highlight terms with more than 2 characters
      const regex = new RegExp(term, 'gi');
      result = result.replace(regex, match => `<span class="highlight">${match}</span>`);
    }
  });
  
  return result;
}

// Search functionality
async function performSearch(query) {
  if (!query.trim()) return;
  
  try {
    showLoading();
    
    const response = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    
    const data = await response.json();
    
    // Clear previous results
    resultsList.innerHTML = '';
    contentContainer.innerHTML = '';
    
    if (data.articles && data.articles.length > 0) {
      // Show results container
      resultsContainer.classList.add('show');
      
      // Update results count
      resultsCount.textContent = `${data.articles.length} result${data.articles.length > 1 ? 's' : ''} found`;
      
      // Extract search terms
      const searchTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0);
      
      // Create result items
      data.articles.forEach((article, index) => {
        const resultItem = document.createElement('div');
        resultItem.className = 'result-item';
        resultItem.dataset.id = article.id;
        
        const highlightedTitle = highlightText(article.title, searchTerms);
        const highlightedQuestion = highlightText(article.question, searchTerms);
        
        resultItem.innerHTML = `
          <div class="result-header">
            <h3 class="result-title">${highlightedTitle || 'Untitled'}</h3>
          </div>
          <div class="result-preview">
            <p>${highlightedQuestion || ''}</p>
          </div>
        `;
        
        resultItem.addEventListener('click', () => {
          // Show content for this article
          showArticleContent(article, searchTerms);
          
          // Highlight the selected item
          document.querySelectorAll('.result-item').forEach(item => {
            item.classList.remove('active');
          });
          resultItem.classList.add('active');
        });
        
        resultsList.appendChild(resultItem);
        
        // Automatically show the first result
        if (index === 0) {
          resultItem.classList.add('active');
          showArticleContent(article, searchTerms);
        }
      });
    } else {
      // Show no results message
      resultsContainer.classList.add('show');
      resultsList.innerHTML = `
        <div class="no-results">
          <i class="fas fa-search"></i>
          <h3>No results found</h3>
          <p>Try different keywords or check your spelling</p>
        </div>
      `;
      resultsCount.textContent = '0 results found';
    }
  } catch (error) {
    console.error('Error:', error);
    resultsContainer.classList.add('show');
    resultsList.innerHTML = `
      <div class="no-results">
        <i class="fas fa-exclamation-circle"></i>
        <h3>An error occurred</h3>
        <p>Please try again later</p>
      </div>
    `;
    resultsCount.textContent = '';
  } finally {
    hideLoading();
  }
}

// Show article content
function showArticleContent(article, searchTerms) {
  const highlightedQuestion = highlightText(article.question, searchTerms);
  const highlightedAnswer = highlightText(article.answer, searchTerms);
  const highlightedContent = highlightText(article.content, searchTerms);
  
  contentContainer.innerHTML = `
    <div class="result-content show">
      <h2>${article.title || 'Untitled'}</h2>
      <div class="result-question">${highlightedQuestion || ''}</div>
      <div class="result-answer">${highlightedAnswer || ''}</div>
      <div class="result-full-content">${highlightedContent || ''}</div>
    </div>
  `;
  
  // Scroll to content on mobile
  if (window.innerWidth < 768) {
    contentContainer.scrollIntoView({ behavior: 'smooth' });
  }
}

// Handle search form submission
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  
  if (query) {
    performSearch(query);
  }
});

// Handle input changes (for real-time search)
let debounceTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const query = searchInput.value.trim();
    if (query.length >= 3) {
      performSearch(query);
    } else if (query.length === 0) {
      resultsContainer.classList.remove('show');
      contentContainer.innerHTML = '';
    }
  }, 500);
});
