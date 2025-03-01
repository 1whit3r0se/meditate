document.addEventListener("DOMContentLoaded", () => {
  // Create the user profile menu
  // Assuming createUserProfileMenu is defined elsewhere or imported
  // For example: import { createUserProfileMenu } from './user-profile-menu';
  // If it's defined in the same file, uncomment the following:
  // function createUserProfileMenu() {
  //   // Implementation of createUserProfileMenu
  //   const menu = document.createElement('div');
  //   menu.textContent = 'User Profile Menu'; // Placeholder
  //   return menu;
  // }

  const userProfileMenu = createUserProfileMenu()

  // Find the header element
  const header = document.querySelector("header")

  // Insert the user profile menu before the theme toggle button
  header.insertBefore(userProfileMenu, header.querySelector(".theme-toggle"))
})

