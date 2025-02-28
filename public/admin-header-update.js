document.addEventListener("DOMContentLoaded", () => {
    // Create the user profile menu
    const userProfileMenu = createUserProfileMenu()
  
    // Find the header element
    const header = document.querySelector("header")
  
    // Find the div containing the theme toggle button
    const themeToggleContainer = header.querySelector("div")
  
    // Insert the user profile menu before the theme toggle button
    themeToggleContainer.insertBefore(userProfileMenu, themeToggleContainer.firstChild)
  })
  
  function createUserProfileMenu() {
    // Create the menu container
    const menu = document.createElement("div")
    menu.classList.add("user-profile-menu")
  
    // Create the user icon
    const userIcon = document.createElement("i")
    userIcon.classList.add("fas", "fa-user-circle", "user-icon")
    menu.appendChild(userIcon)
  
    // Create the dropdown content
    const dropdownContent = document.createElement("div")
    dropdownContent.classList.add("dropdown-content")
  
    // Create the profile link
    const profileLink = document.createElement("a")
    profileLink.href = "/profile"
    profileLink.textContent = "Profile"
    dropdownContent.appendChild(profileLink)
  
    // Create the logout link
    const logoutLink = document.createElement("a")
    logoutLink.href = "/logout"
    logoutLink.textContent = "Logout"
    dropdownContent.appendChild(logoutLink)
  
    // Append the dropdown content to the menu
    menu.appendChild(dropdownContent)
  
    // Add event listener to toggle dropdown visibility
    menu.addEventListener("click", (event) => {
      event.stopPropagation() // Prevent the event from bubbling up to the document
      dropdownContent.classList.toggle("show")
    })
  
    // Close the dropdown when clicking outside the menu
    document.addEventListener("click", () => {
      dropdownContent.classList.remove("show")
    })
  
    return menu
  }
  
  