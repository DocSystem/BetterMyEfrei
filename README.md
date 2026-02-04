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
  - **Improved navigation** (by @RemiVibert): date indicator and navigation buttons swapped for better UX - all navigation controls (prev/today/next) are now grouped together in a single bordered container
  - **Settings menu** (by @RemiVibert): Customization popup accessible via the profile menu
  - **Event color customization** (by @RemiVibert): Personalize colors for each course type (CM, TD, TP, etc.)
  - **Profile picture toggle** (by @RemiVibert): Option to hide your profile picture
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
A customization menu accessible via the **"Better myEfrei" button** in the profile dropdown menu (click on your profile picture in the top-right corner).

#### Time Range
- **Dual-handle slider** to customize the visible time range on the planning
- Default: 7:30 AM to 8:00 PM
- Range: 00:00 to 23:45
- Snaps to 15-minute intervals
- **Live update**: Changes apply immediately without page refresh
- Settings persist in localStorage across sessions

#### Improved Navigation
- **Swapped layout**: The week indicator and "Aujourd'hui" button positions have been swapped
- **Unified navigation group**: All navigation buttons (previous week, today, next week) are now grouped in a single bordered container
- **Better UX**: The week indicator now has a fixed position (doesn't shift when text changes), preventing the navigation buttons from moving around
- **Hover effects**: Each button has its own hover effect that stays within its boundaries
- **Ripple animation**: Click animations are contained within each individual button

#### Event Colors Customization
- **Per-type color customization**: Personalize colors for each course type:
  - CM (Cours magistral)
  - TD (Travaux dirigés)
  - TP (Travaux pratiques)
  - PRJ (Projet)
  - TPA (TP en autonomie)
  - IE (Évaluation)
  - CLG (Cours de langue)
  - COMM (Communication)
- **Simple mode**: Pick one color and all states (normal, hover, active, border) are auto-generated
- **Advanced mode**: Fine-tune each color state individually
- **Live preview**: Interactive preview showing normal, hover, and click states
- **Individual reset buttons**: Reset any single course type to default colors
- **Full reset**: Reset all settings to defaults

#### Profile Settings
- **Profile picture toggle**: Show or hide your profile picture
- When hidden, displays a default avatar icon placeholder
