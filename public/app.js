document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const chatTab = document.getElementById('chatTab');
    const knowledgeTab = document.getElementById('knowledgeTab');
    const historyTab = document.getElementById('historyTab');
    
    const chatSection = document.getElementById('chatSection');
    const knowledgeSection = document.getElementById('knowledgeSection');
    const historySection = document.getElementById('historySection');
    
    const chatMessages = document.getElementById('chatMessages');
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    
    const topicInput = document.getElementById('topicInput');
    const contentInput = document.getElementById('contentInput');
    const addKnowledgeButton = document.getElementById('addKnowledgeButton');
    
    const knowledgeList = document.getElementById('knowledgeList');
    const historyList = document.getElementById('historyList');
    
    // Tab Navigation
    chatTab.addEventListener('click', () => {
      setActiveTab(chatTab, chatSection);
    });
    
    knowledgeTab.addEventListener('click', () => {
      setActiveTab(knowledgeTab, knowledgeSection);
      loadKnowledgeBase();
    });
    
    historyTab.addEventListener('click', () => {
      setActiveTab(historyTab, historySection);
      loadChatHistory();
    });
    
    function setActiveTab(tab, section) {
      // Reset all tabs and sections
      [chatTab, knowledgeTab, historyTab].forEach(t => t.classList.remove('active'));
      [chatSection, knowledgeSection, historySection].forEach(s => s.classList.remove('section-active'));
      
      // Set active tab and section
      tab.classList.add('active');
      section.classList.add('section-active');
    }
    
    // Chat Functionality
    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
    
    async function sendMessage() {
      const message = userInput.value.trim();
      if (!message) return;
      
      // Add user message to chat
      addMessageToChat('user', message);
      userInput.value = '';
      
      // Add loading indicator
      const loadingId = addLoadingMessage();
      
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message })
        });
        
        const data = await response.json();
        
        // Remove loading indicator
        removeLoadingMessage(loadingId);
        
        // Add AI response to chat
        addMessageToChat('ai', data.response);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
      } catch (error) {
        console.error('Error sending message:', error);
        removeLoadingMessage(loadingId);
        addMessageToChat('ai', 'Sorry, there was an error processing your request.');
      }
    }
    
    function addMessageToChat(sender, text) {
      const messageDiv = document.createElement('div');
      messageDiv.classList.add('message');
      messageDiv.classList.add(sender === 'user' ? 'user-message' : 'ai-message');
      messageDiv.textContent = text;
      chatMessages.appendChild(messageDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function addLoadingMessage() {
      const loadingDiv = document.createElement('div');
      loadingDiv.classList.add('message', 'ai-message', 'loading');
      loadingDiv.textContent = 'Thinking...';
      chatMessages.appendChild(loadingDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
      return Date.now(); // Use timestamp as ID
    }
    
    function removeLoadingMessage(id) {
      const loadingMessages = document.querySelectorAll('.loading');
      if (loadingMessages.length > 0) {
        loadingMessages[loadingMessages.length - 1].remove();
      }
    }
    
    // Knowledge Base Functionality
    addKnowledgeButton.addEventListener('click', addKnowledge);
    
    async function addKnowledge() {
      const topic = topicInput.value.trim();
      const content = contentInput.value.trim();
      
      if (!topic || !content) {
        alert('Please enter both topic and content');
        return;
      }
      
      try {
        const response = await fetch('/api/knowledge', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ topic, content })
        });
        
        if (response.ok) {
          topicInput.value = '';
          contentInput.value = '';
          alert('Knowledge added successfully!');
          loadKnowledgeBase();
        } else {
          alert('Failed to add knowledge');
        }
      } catch (error) {
        console.error('Error adding knowledge:', error);
        alert('Error adding knowledge');
      }
    }
    
    async function loadKnowledgeBase() {
      try {
        knowledgeList.innerHTML = '<div class="loading">Loading knowledge base...</div>';
        
        const response = await fetch('/api/knowledge');
        const data = await response.json();
        
        knowledgeList.innerHTML = '';
        
        if (data.length === 0) {
          knowledgeList.innerHTML = '<p>No knowledge entries yet.</p>';
          return;
        }
        
        data.forEach(item => {
          const knowledgeItem = document.createElement('div');
          knowledgeItem.classList.add('knowledge-item');
          
          const topic = document.createElement('div');
          topic.classList.add('knowledge-topic');
          topic.textContent = item.topic;
          
          const content = document.createElement('div');
          content.classList.add('knowledge-content');
          content.textContent = item.content;
          
          const timestamp = document.createElement('div');
          timestamp.classList.add('timestamp');
          timestamp.textContent = new Date(item.created_at).toLocaleString();
          
          knowledgeItem.appendChild(topic);
          knowledgeItem.appendChild(content);
          knowledgeItem.appendChild(timestamp);
          
          knowledgeList.appendChild(knowledgeItem);
        });
      } catch (error) {
        console.error('Error loading knowledge base:', error);
        knowledgeList.innerHTML = '<p>Error loading knowledge base</p>';
      }
    }
    
    // Chat History Functionality
    async function loadChatHistory() {
      try {
        historyList.innerHTML = '<div class="loading">Loading chat history...</div>';
        
        const response = await fetch('/api/history');
        const data = await response.json();
        
        historyList.innerHTML = '';
        
        if (data.length === 0) {
          historyList.innerHTML = '<p>No chat history yet.</p>';
          return;
        }
        
        data.forEach(item => {
          const historyItem = document.createElement('div');
          historyItem.classList.add('history-item');
          
          const userMessage = document.createElement('div');
          userMessage.classList.add('history-user');
          userMessage.textContent = 'User: ' + item.user_message;
          
          const aiResponse = document.createElement('div');
          aiResponse.classList.add('history-ai');
          aiResponse.textContent = 'AI: ' + item.ai_response;
          
          const timestamp = document.createElement('div');
          timestamp.classList.add('timestamp');
          timestamp.textContent = new Date(item.created_at).toLocaleString();
          
          historyItem.appendChild(userMessage);
          historyItem.appendChild(aiResponse);
          historyItem.appendChild(timestamp);
          
          historyList.appendChild(historyItem);
        });
      } catch (error) {
        console.error('Error loading chat history:', error);
        historyList.innerHTML = '<p>Error loading chat history</p>';
      }
    }
    
    // Initialize
    setActiveTab(chatTab, chatSection);
  });
  
  