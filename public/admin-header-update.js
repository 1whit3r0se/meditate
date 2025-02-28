// This script will be added to admin.html to update the header with the user profile menu

document.addEventListener('DOMContentLoaded', function() {
    // Create the user profile menu
    function createUserProfileMenu() {
      // This is a placeholder. Replace with your actual implementation.
      const menu = document.createElement('div');
      menu.textContent = 'User Profile Menu (Placeholder)';
      return menu;
    }
    const userProfileMenu = createUserProfileMenu();
    
    // Find the header element
    const header = document.querySelector('header');
    
    // Find the div containing the theme toggle button
    const themeToggleContainer = header.querySelector('div');
    
    // Insert the user profile menu before the theme toggle button
    themeToggleContainer.insertBefore(userProfileMenu, themeToggleContainer.firstChild);
  });
  