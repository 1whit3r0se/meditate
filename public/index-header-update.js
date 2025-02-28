// This script will be added to index.html to update the header with the user profile menu

document.addEventListener('DOMContentLoaded', function() {
    // Create the user profile menu
    // Assuming createUserProfileMenu is defined elsewhere or imported
    // For example:
    // import { createUserProfileMenu } from './user-profile-menu';
    // Or:
    function createUserProfileMenu() {
      // Replace this with the actual implementation of createUserProfileMenu
      const menu = document.createElement('div');
      menu.textContent = 'User Profile Menu (Placeholder)';
      return menu;
    }
    const userProfileMenu = createUserProfileMenu();
    
    // Find the header element
    const header = document.querySelector('header');
    
    // Insert the user profile menu before the theme toggle button
    header.insertBefore(userProfileMenu, header.querySelector('.theme-toggle'));
  });
  