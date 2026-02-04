# BetterMyEfrei
UI/UX tweaks for MyEfrei

## Install

1. Install the [TamperMonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo) extension for Chrome.
2. Right-click the extension.
3. Left-click "Manage Extension."
4. Enable "Developer Mode."
5. Enable "Allow user scripts."
6. **One-click install**: Click this link to Install Better MyEfrei directly: [**Install Better MyEfrei**](https://github.com/RemiVibert/BetterMyEfrei/raw/refs/heads/main/BetterMyEfrei.user.js)

   TamperMonkey will automatically detect the userscript and prompt you to Install it.
8. Refresh the [myefrei.fr](https://myefrei.fr) webpage.

## Changes

- Adds user profile picture
- Better planning
  - Larger size
  - Remove sunday
  - Better colors
  - Show course type on planning page, without clicking on the course
  - Better course modal
  - **Cropped schedule view** (by @RemiVibert): Display only hours between configurable start and end times without scrolling
  - **Settings menu** (by @RemiVibert): Customization popup accessible via the gear icon in the bottom-right corner
- Better Grades
  - Modern card-based layout for modules
  - Automatic average and ECTS tracking
  - Integrated "Rattrapage" (retake) grades display
  - Advanced PDF Viewer for exam copies
    - Zoom controls
    - Booklet mode reordering (A3 format)
    - Dark/Light mode compatible
- Show main contact on home page

## Fork by RemiVibert

This fork adds the following features:

### Cropped Planning View
The schedule is no longer scrollable and displays fully visible, showing only the configured time range. This makes it easier to see the entire day at a glance without scrolling.

### Settings Menu (v0.7.0)
A customization menu accessible via a **gear icon** in the bottom-right corner of the page. Features:

- **Time Range Slider**: A dual-handle slider to customize the visible time range on the planning
  - Default: 7:30 AM to 8:00 PM
  - Range: 00:00 to 24:00
  - Snaps to 15-minute intervals
  - **Live update**: Changes apply immediately without page refresh
  - Settings persist in localStorage across sessions
- Uses the site's native color theme for seamless integration

> More customization options will be added to this menu in future versions.
