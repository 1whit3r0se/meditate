function createUserProfileMenu() {
    // Create the menu container
    const menuContainer = document.createElement("div")
    menuContainer.className = "user-profile-container"
    menuContainer.innerHTML = `
      <style>
        .user-profile-container {
          position: relative;
          display: inline-block;
        }
        
        .user-profile-button {
          display: flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 5px 10px;
          border-radius: var(--border-radius);
          transition: var(--transition);
          color: var(--dark);
        }
        
        .dark-mode .user-profile-button {
          color: var(--light);
        }
        
        .user-profile-button:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }
        
        .dark-mode .user-profile-button:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }
        
        .avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: var(--primary);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
        }
        
        .user-email {
          max-width: 150px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .dropdown-menu {
          position: absolute;
          top: 100%;
          right: 0;
          background-color: white;
          border-radius: var(--border-radius);
          box-shadow: var(--box-shadow);
          min-width: 200px;
          z-index: 1000;
          display: none;
          animation: fadeIn 0.2s ease;
          border: 1px solid #e0e0e0;
        }
        
        .dark-mode .dropdown-menu {
          background-color: #2a2a2a;
          border-color: #444;
        }
        
        .dropdown-menu.active {
          display: block;
        }
        
        .dropdown-item {
          padding: 10px 15px;
          cursor: pointer;
          transition: var(--transition);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .dropdown-item:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }
        
        .dark-mode .dropdown-item:hover {
          background-color: rgba(255, 255, 255, 0.1);
        }
        
        .dropdown-divider {
          height: 1px;
          background-color: #e0e0e0;
          margin: 5px 0;
        }
        
        .dark-mode .dropdown-divider {
          background-color: #444;
        }
        
        .session-info {
          padding: 10px 15px;
          font-size: 0.8rem;
          color: var(--gray);
          text-align: center;
        }
      </style>
      
      <button class="user-profile-button" id="userProfileButton">
        <div class="avatar" id="userAvatar">U</div>
        <span class="user-email" id="userEmail">Loading...</span>
        <i class="fas fa-chevron-down"></i>
      </button>
      
      <div class="dropdown-menu" id="userDropdown">
        <div class="session-info" id="sessionInfo">
          Session expires in: <span id="sessionTimeRemaining">--:--:--</span>
        </div>
        
        <div class="dropdown-divider"></div>
        
        <div class="dropdown-item" id="logoutButton">
          <i class="fas fa-sign-out-alt"></i>
          <span>Logout</span>
        </div>
      </div>
    `
  
    // Get DOM elements
    const userProfileButton = menuContainer.querySelector("#userProfileButton")
    const userDropdown = menuContainer.querySelector("#userDropdown")
    const userAvatar = menuContainer.querySelector("#userAvatar")
    const userEmail = menuContainer.querySelector("#userEmail")
    const logoutButton = menuContainer.querySelector("#logoutButton")
    const sessionTimeRemaining = menuContainer.querySelector("#sessionTimeRemaining")
  
    // Toggle dropdown
    userProfileButton.addEventListener("click", () => {
      userDropdown.classList.toggle("active")
    })
  
    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!menuContainer.contains(e.target)) {
        userDropdown.classList.remove("active")
      }
    })
  
    // Handle logout
    logoutButton.addEventListener("click", async () => {
      try {
        const response = await fetch("/api/auth/logout", {
          method: "POST",
        })
  
        if (response.ok) {
          window.location.href = "/login"
        } else {
          console.error("Logout failed")
        }
      } catch (error) {
        console.error("Logout error:", error)
      }
    })
  
    // Load user data
    async function loadUserData() {
      try {
        const response = await fetch("/api/auth/user")
        const data = await response.json()
  
        if (data.authenticated) {
          // Set user email
          userEmail.textContent = data.user.email
  
          // Set avatar
          userAvatar.textContent = data.user.email.charAt(0).toUpperCase()
        }
      } catch (error) {
        console.error("Error loading user data:", error)
      }
    }
  
    // Update session time remaining
    function updateSessionTime() {
      // Get token expiration from JWT
      const token = getCookie("token")
      if (token) {
        try {
          // Decode JWT to get expiration time
          const payload = JSON.parse(atob(token.split(".")[1]))
          const expirationTime = payload.exp * 1000 // Convert to milliseconds
  
          // Update timer every second
          const updateTimer = () => {
            const now = Date.now()
            const timeRemaining = expirationTime - now
  
            if (timeRemaining <= 0) {
              sessionTimeRemaining.textContent = "Expired"
              return
            }
  
            // Format time remaining
            const hours = Math.floor(timeRemaining / (1000 * 60 * 60))
            const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60))
            const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000)
  
            sessionTimeRemaining.textContent = `${hours.toString().padStart(2, "0")}:${minutes
              .toString()
              .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  
            // Schedule next update
            setTimeout(updateTimer, 1000)
          }
  
          // Start timer
          updateTimer()
        } catch (error) {
          console.error("Error decoding token:", error)
          sessionTimeRemaining.textContent = "Unknown"
        }
      } else {
        sessionTimeRemaining.textContent = "Not available"
      }
    }
  
    // Helper function to get cookie value
    function getCookie(name) {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop().split(";").shift()
      return null
    }
  
    // Initialize
    loadUserData()
    updateSessionTime()
  
    return menuContainer
  }
  
  // Export the function so it can be used in other files
  window.createUserProfileMenu = createUserProfileMenu
  
  