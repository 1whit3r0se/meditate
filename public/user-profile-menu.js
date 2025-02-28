// This file contains the shared user profile menu component
// It will be included in both admin.html and index.html

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
        
        .avatar-selection {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          padding: 10px 15px;
        }
        
        .avatar-option {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid transparent;
          transition: var(--transition);
        }
        
        .avatar-option:hover, .avatar-option.selected {
          border-color: var(--primary);
        }
        
        .avatar-option img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }
        
        .custom-avatar-upload {
          display: none;
        }
        
        .custom-avatar-label {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background-color: #f5f5f5;
          cursor: pointer;
          transition: var(--transition);
        }
        
        .dark-mode .custom-avatar-label {
          background-color: #333;
        }
        
        .custom-avatar-label:hover {
          background-color: #e0e0e0;
        }
        
        .dark-mode .custom-avatar-label:hover {
          background-color: #444;
        }
      </style>
      
      <button class="user-profile-button" id="userProfileButton">
        <div class="avatar" id="userAvatar">U</div>
        <span class="user-email" id="userEmail">Loading...</span>
        <i class="fas fa-chevron-down"></i>
      </button>
      
      <div class="dropdown-menu" id="userDropdown">
        <div class="dropdown-item" id="showAvatarSelection">
          <i class="fas fa-user-circle"></i>
          <span>Change Avatar</span>
        </div>
        
        <div class="avatar-selection" id="avatarSelection" style="display: none;">
          <div class="avatar-option" data-avatar="zeus">
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=zeus" alt="Zeus">
          </div>
          <div class="avatar-option" data-avatar="poseidon">
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=poseidon" alt="Poseidon">
          </div>
          <div class="avatar-option" data-avatar="hades">
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=hades" alt="Hades">
          </div>
          <div class="avatar-option" data-avatar="apollo">
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=apollo" alt="Apollo">
          </div>
          <div class="avatar-option" data-avatar="athena">
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=athena" alt="Athena">
          </div>
          <div class="avatar-option" data-avatar="hermes">
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=hermes" alt="Hermes">
          </div>
          <div class="avatar-option" data-avatar="artemis">
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=artemis" alt="Artemis">
          </div>
          <label class="custom-avatar-label" for="customAvatarUpload">
            <i class="fas fa-plus"></i>
            <input type="file" id="customAvatarUpload" class="custom-avatar-upload" accept="image/*">
          </label>
        </div>
        
        <div class="dropdown-divider"></div>
        
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
    const showAvatarSelection = menuContainer.querySelector("#showAvatarSelection")
    const avatarSelection = menuContainer.querySelector("#avatarSelection")
    const avatarOptions = menuContainer.querySelectorAll(".avatar-option")
    const customAvatarUpload = menuContainer.querySelector("#customAvatarUpload")
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
  
    // Toggle avatar selection
    showAvatarSelection.addEventListener("click", () => {
      avatarSelection.style.display = avatarSelection.style.display === "none" ? "grid" : "none"
    })
  
    // Handle avatar selection
    avatarOptions.forEach((option) => {
      option.addEventListener("click", () => {
        const avatarName = option.dataset.avatar
        if (avatarName) {
          // Remove selected class from all options
          avatarOptions.forEach((opt) => opt.classList.remove("selected"))
          // Add selected class to clicked option
          option.classList.add("selected")
  
          // Update avatar in UI
          userAvatar.innerHTML = ""
          const avatarImg = document.createElement("img")
          avatarImg.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarName}`
          avatarImg.alt = avatarName
          avatarImg.style.width = "100%"
          avatarImg.style.height = "100%"
          avatarImg.style.borderRadius = "50%"
          userAvatar.appendChild(avatarImg)
  
          // Save avatar preference
          localStorage.setItem("userAvatar", avatarName)
        }
      })
    })
  
    // Handle custom avatar upload
    customAvatarUpload.addEventListener("change", (e) => {
      const file = e.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          // Update avatar in UI
          userAvatar.innerHTML = ""
          const avatarImg = document.createElement("img")
          avatarImg.src = event.target.result
          avatarImg.alt = "Custom Avatar"
          avatarImg.style.width = "100%"
          avatarImg.style.height = "100%"
          avatarImg.style.borderRadius = "50%"
          userAvatar.appendChild(avatarImg)
  
          // Save avatar preference
          localStorage.setItem("userAvatarCustom", event.target.result)
        }
        reader.readAsDataURL(file)
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
  
          // Set initial avatar
          const savedAvatar = localStorage.getItem("userAvatar")
          const savedCustomAvatar = localStorage.getItem("userAvatarCustom")
  
          if (savedCustomAvatar) {
            userAvatar.innerHTML = ""
            const avatarImg = document.createElement("img")
            avatarImg.src = savedCustomAvatar
            avatarImg.alt = "Custom Avatar"
            avatarImg.style.width = "100%"
            avatarImg.style.height = "100%"
            avatarImg.style.borderRadius = "50%"
            userAvatar.appendChild(avatarImg)
          } else if (savedAvatar) {
            userAvatar.innerHTML = ""
            const avatarImg = document.createElement("img")
            avatarImg.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${savedAvatar}`
            avatarImg.alt = savedAvatar
            avatarImg.style.width = "100%"
            avatarImg.style.height = "100%"
            avatarImg.style.borderRadius = "50%"
            userAvatar.appendChild(avatarImg)
  
            // Mark the selected avatar
            const selectedOption = document.querySelector(`.avatar-option[data-avatar="${savedAvatar}"]`)
            if (selectedOption) {
              selectedOption.classList.add("selected")
            }
          } else {
            // Set initial based on email
            userAvatar.textContent = data.user.email.charAt(0).toUpperCase()
          }
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
  
            sessionTimeRemaining.textContent = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  
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
  
  