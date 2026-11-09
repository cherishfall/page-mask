/**
 * UI copy · English (#57). Mirrors messages.zh.ts key for key; the type annotation makes any
 * missing / extra key a compile error, and core/i18n.test.ts compares both tables recursively.
 *
 * Wording follows GLOSSARY.md: "Shown your way" / "As the site is", hide methods
 * Disappear / Keep space / Cover, "may be broken", tab title / tab icon, "cover" / "restore".
 *
 * Copy discipline (0.4.1, see AGENTS.md): name the action and the object, never invent a term.
 * One name per thing across the whole product. No "authorize", "take effect", "rule" or "process"
 * in the interface — say "allow access", "work", "hidden item", "change".
 * Keep it short: the popup is 320px wide and English runs longer than Chinese.
 */
import type { Messages } from './messages.zh';

export const en: Messages = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    undo: 'Undo',
    close: 'Close',
    gotIt: 'Got it',
    loading: 'Loading…',
    opening: 'Opening…',
    resetTitleIcon: 'Use the site’s own title and icon',
    shortcutBlocked: 'This page can’t be covered',
    resetTitleIconHint: 'Only the title and icon — hidden items stay as they are.',
    clean: 'Your settings',
    original: 'As is',
    cleanMode: 'Show this site your way',
    quickFill: 'Ready-made titles',
    quickTitle: 'Ready-made titles',
    unnamedElement: 'Unnamed element',
    languageNameZh: '简体中文',
    languageNameEn: 'English',
    deleted: (name: string) => `Deleted “${name}”`,
    deleteNamed: (name: string) => `Delete “${name}”`,
    strategy: {
      remove: 'Disappear',
      blank: 'Keep space',
      mask: 'Cover',
    },
    strategyHint: {
      remove: 'Gone, and the content below moves up',
      blank: 'Invisible, but the space stays',
      mask: 'A block in the page colour sits on top',
    },
    scope: {
      all: 'The whole site',
      include: (label: string) => `Only these pages: ${label}`,
      exclude: (label: string) => `Except these pages: ${label}`,
    },
    scopePattern: {
      home: (host: string) => `the home page of ${host}`,
      under: (host: string, path: string) => `pages under ${path} on ${host}`,
    },
    elementName: {
      nav: 'Nav bar',
      header: 'Header',
      footer: 'Footer',
      aside: 'Sidebar',
      main: 'Main content',
      form: 'Form',
      button: 'Button',
      search: 'Search box',
      video: 'Video',
      audio: 'Audio',
      canvas: 'Canvas',
      image: (alt: string) => `Image: ${alt}`,
      fallback: (tag: string) => `${tag} element`,
    },
    listSeparator: ', ',
    stale: 'May be broken',
    staleCount: (n: number) => (n === 1 ? '1 item may be broken' : `${n} items may be broken`),
    hiddenCount: (n: number) => (n === 1 ? '1 item set to hide' : `${n} items set to hide`),
    hiddenNone: 'Nothing set to hide',
  },

  /** Pictures & videos gray (0.8.0, #131): one set of labels shared by the capsule media button / popup / site settings */
  media: {
    heading: 'Pictures & videos',
    mediaGray: 'Turn pictures & videos gray',
    mediaGrayHint: 'Pictures and videos turn black & white — same place, still readable, links still work. Videos that autoplay are paused; click a video to watch it.',
    /** Site settings card footnote: 0.8.3 — the gray switch is independent of the main switch; images still load, plain and honest */
    hint: 'Works on its own, independent of ‘Your settings’: switching to ‘As is’ restores what’s hidden and the tab title/icon, while the gray follows this switch. Images still load in the background — this only removes the color.',
    hintShort: 'Works on its own: switching to “As is” keeps pictures and videos gray, while hidden items and the tab title and icon return to normal.',
    /** Unconfigured sites: turning it on goes through first-time-style permission and creates a gray-only profile (0.8.5, #134) */
    hintNew: 'Turning it on asks for this site’s access, just like first-time setup; pictures and videos then turn black & white (same place, still readable) and autoplaying videos are paused.',
    /** Hover / screen-reader label for the capsule media button */
    mediaTitle: 'Turn pictures & videos gray',
    saveFailed: "Couldn't save this change. Please try again.",
  },

  popup: {
    loading: 'Reading this page…',
    unsupportedFallback: 'PageMask can’t be used on this page',
    unsupported: {
      unparsable: 'This address can’t be recognized',
      internal: 'Chrome’s own pages don’t let extensions change them. Try a normal web page',
      localFile: 'Extensions can’t change files on your computer. Open a page on the web instead',
      webStore: 'Chrome Web Store pages don’t let extensions change them',
      other: 'Extensions can’t change this kind of page',
    },
    pendingBadge: 'Needs access',
    /** One short line for an unset site; the blue primary button in the card is the first step (#148) */
    newSiteHint: 'This site isn’t set up yet.',
    pendingHint: 'The browser took away access to this site. Your settings are still here and come back once you allow access again.',
    reauthorize: 'Allow access',
    reauthorizing: 'Waiting for you to allow…',
    setupMore: 'Hide items',
    /** The "Title & icon" entry: a one-step form, saved with Save (#81) */
    editTitle: 'Title & icon',
    /** Hint under the mask-card header: what the switch governs, and that gray is separate (#148) */
    cardSwitchHint: 'Controls hidden items and the tab title and icon. Pictures & videos gray is a separate switch.',
    /** On an unset site there is no switch; instead say what it will do once set up (#148) */
    cardSwitchHintNew: 'Once set up, use this switch to move between the site as it is and your settings.',
    coverPage: 'Cover this page',
    /** Cover card: say this is temporary and changes no settings (#148) */
    coverHint: 'This only covers the page for now — reloading or leaving restores it and changes none of your settings.',
    /** Show-capsule switch (#112): label + one-line hint under the switch */
    showToggle: 'Floating button',
    showToggleHint: 'Turn it off and the floating button no longer appears on this site’s pages. The popup settings and the “Cover this page” shortcut still work.',
    /** On an unset site there is no switch; say the button appears once set up (#148) */
    showToggleHintNew: 'Once this site is set up, a floating button appears on its pages.',
    /** The "View the guide" text link in the header (0.8.11 #139 entry, moved to the title row in 0.8.15 #148) */
    replayIntro: 'View the guide',
    /** Full accessible name for the short header link (#148) */
    replayIntroAria: 'View the PageMask guide',
    /** Delete site settings (#112): same copy as the site settings page / capsule menu (core/site-delete.ts) */
    deleting: 'Deleting…',
    deleteFailed: "Couldn't delete this site's settings, please try again.",
    restorePage: 'Restore this page',
    covering: 'Covering…',
    restoring: 'Restoring…',
    manageAll: 'All site settings',
    settings: 'Settings',
    error: {
      tabMismatch: 'The page changed. Go back to the site you want and click PageMask again',
      notGranted: 'Access to this site wasn’t granted. Click again and choose “Allow”',
      injectFailed: 'Couldn’t start on this page. Reload it and try again',
      denied: 'PageMask needs access to this site to change its title and hide things. Click again and choose “Allow”',
      gestureLost: 'Couldn’t open the permission prompt. Click PageMask again',
      toggleFailed: 'Couldn’t switch how the site is shown. Please try again',
      editFailed: 'Couldn’t open “Title & icon”. Reload this page and try again',
      coverFailed: 'Couldn’t cover this page. Reload it and try again',
    },
  },

  management: {
    pageTitle: 'PageMask · All site settings',
    appSub: 'These are the sites you added. Open one to change its tab title and icon, or see what it hides.',

    sitesTitle: 'All site settings',
    sitesHint: 'Pick a site to open its settings. PageMask never touches sites you didn’t add.',
    /** Row-end "more" button (#113): accessible name carries the host so rows never blur together */
    moreActions: (label: string) => `More actions: ${label}`,
    sitesEmpty: 'No sites yet. Open a site you want to tidy up and click the PageMask icon in the toolbar to start.',
    pendingAll: (n: number) =>
      n === 1
        ? '1 site hasn’t been allowed yet. Until you allow it, its settings do nothing.'
        : `${n} sites haven’t been allowed yet. Until you allow them, their settings do nothing.`,
    authorizeAll: 'Allow all',
    pendingBadge: 'Needs access',
    pendingHint: 'The browser hasn’t allowed PageMask to open this site. Your settings are kept and apply once you allow it.',
    authorize: 'Allow access',

    back: '← All site settings',
    backShort: 'Back to all site settings',
    missingTitle: 'No settings for this site',
    missingHint: 'Open this site and click the PageMask icon in the toolbar to set it up.',

    titleHeading: 'Tab title',
    titleIntro: 'Once saved, this site’s tab shows this text. With the switch on “As is”, the site’s own title comes back.',
    titleUnsetPlaceholder: 'Not set: the tab keeps the site’s own title',
    titleFootnoteUnset: 'Type here and save, and this site starts using your title.',
    titleFootnote: (fallback: string) =>
      `Saved automatically once you stop typing. Leave it empty to use “${fallback}” — a title can’t be blank, or Chrome shows the address instead.`,

    iconHeading: 'Tab icon',
    iconIntro: 'When the “Shown your way” switch at the top is on, this site’s tab uses the icon you pick here.',
    iconSite: "The site's own icon",
    iconNone: 'No icon',
    iconPreset: 'Use a different icon',
    iconPickLabel: 'Pick an icon',
    iconPresets: {
      doc: 'Document',
      sheet: 'Spreadsheet',
      mail: 'Mail',
      cal: 'Calendar',
      code: 'Code',
      meet: 'Meeting',
      chat: 'Chat',
      drive: 'Drive',
      book: 'Knowledge base',
      chart: 'Report',
    },

    rulesHeading: 'Hidden items',
    rulesEmpty: 'Nothing is hidden yet.',
    ruleStaleNote: (name: string) =>
      `“${name}” can’t be found on the site any more — the site may have changed. Open the site and pick it again.`,
    rulesEditHint:
      'To change how something is hidden or pick it again, do it on the site itself: click the PageMask icon in the toolbar, then “Hide items”.',

    deleteSite: {
      heading: 'Delete this site’s settings',
      action: 'Delete settings',
      title: (label: string) => `Delete the settings for ${label}?`,
      impact:
        'Its tab title, icon and hidden items will be deleted, PageMask’s access to this site will be withdrawn, and it will disappear from the list.',
    },

    error: {
      auth: 'Access wasn’t granted and your site settings are kept. Click again when needed and choose “Allow”',
      toggle: 'Couldn’t switch how the site is shown. Please try again',
      rules: 'Couldn’t save this change. Please try again',
      icon: 'Couldn’t save the icon. Please try again',
      reset: 'Couldn’t delete this site’s settings. Please try again',
    },

    import: {
      done: (parts: string, mode: string) => `Import finished: ${parts} (${mode})`,
      partAdded: (n: number) => `${n} added`,
      partUpdated: (n: number) => `${n} updated`,
      partRemoved: (n: number) => `${n} local sites removed`,
      partSkipped: (n: number) => `${n} malformed sites skipped`,
      partSkippedRules: (n: number) => `${n} unreadable hidden items ignored`,
      modeMerge: 'merged',
      modeReplace: 'replaced',
      cancelled: 'Import cancelled. Nothing on this computer changed',
    },
  },

  settings: {
    pageTitle: 'PageMask · Settings',
    title: 'Settings',
    sub: 'These are shared by every site.',
    back: 'All site settings',

    titleHeading: 'Default title',
    titleIntro: 'Pre-filled when you open “Title & icon” for a site. Also used when you cover a page on a site that has no title of its own.',
    titleLabel: 'Default tab title',
    titleFootnote: (fallback: string) =>
      `Leave it empty to use “${fallback}” (follows the browser language). A title can’t be blank, or Chrome shows the address instead.`,


    toggleHeading: 'Floating button',
    toggleIntro:
      'Opacity is how faint it sits when idle; it turns fully clear as soon as you hover, focus it with the keyboard, or drag it.',
    toggleOpacityLabel: 'Opacity',
    toggleOpacityLowHint: 'The fainter you set it, the harder it is to find; hover over where it was and it turns clear.',
    toggleOpacityError: "Couldn't save the opacity, please try again.",
    toggleHint: 'Only this button. The “Restore” button on a covered page stays as it is.',

    shortcutHeading: 'Keyboard shortcut',
    shortcutIntro: 'When someone walks up, no need to hunt for the mouse: press it to cover the page, press again to restore.',
    shortcutLabel: 'Cover / restore',
    shortcutUnbound: 'No shortcut assigned — another extension may have taken it',
    shortcutChange: 'Change in Chrome',
    shortcutHint:
      'Default: Ctrl+Shift+X on Windows/Linux, ⌘+Shift+X on Mac. Shortcuts are changed on Chrome’s own page; this line follows whatever you set there.',
    shortcutOpenFailed: 'This browser won’t let the extension open that page. Type chrome://extensions/shortcuts in a new tab.',

    transferHeading: 'Export / Import',
    transferIntro: 'Saves every site’s settings plus these preferences into one file. Import it after switching computers or reinstalling the browser to restore.',
    exportAll: 'Export all settings',
    importModeLegend: 'Import mode',
    merge: 'Merge (recommended)',
    mergeHint: 'Hidden items of the same site are combined; settings already on this computer are kept',
    replace: 'Replace everything',
    replaceHint: 'Deletes all settings on this computer first, then uses the file’s (you’ll confirm once more)',
    chooseFile: 'Choose an export file to import',

    aboutHeading: 'About',
    version: 'Version',
    repo: 'Repository',
    feedback: 'Feedback',
    feedbackLink: 'Report an issue on GitHub',

    languageHeading: 'Language',
    languageIntro:
      'Every open PageMask page switches right away — no reload needed. The default tab title still follows the browser language.',
    languageAuto: (current: string) => `Automatic (now ${current})`,
    languageZh: '简体中文',
    languageEn: 'English',

    replaceDialog: {
      title: 'Replace all current settings with this file?',
      localSites: (sites: number, rules: number) =>
        `All ${sites} sites and ${rules} hidden items on this computer will be replaced`,
      removed: (n: number, rules: number, list: string) =>
        `${n} of them are not in the file and will be dropped (${rules} hidden items): ${list}`,
      incoming: (sites: number, rules: number) => `Becomes the file’s ${sites} sites and ${rules} hidden items`,
      settings: 'The settings here (the default title) are replaced by the file’s too',
      irreversible: 'This can’t be undone. If unsure, cancel first and use “Export all settings” for a copy',
      confirm: 'Replace',
    },
  },

  onboarding: {
    pageTitle: 'PageMask · Getting started',
    title: 'Welcome to PageMask',
    sub: 'A few clicks on the sites you read, and the parts you don’t want are gone. PageMask never touches sites you didn’t add.',
    done: '(done)',
    prev: 'Back',
    next: 'Next',
    start: 'Start using it',
    tip: 'Both settings entries sit at the bottom of the popup: all site settings, and the extension settings.',
    /** Screen-reader announcement for the current step (#108): updated on step change, never steals focus */
    stepStatus: (n: number, m: number, title: string) => `Step ${n} of ${m}: ${title}`,
    steps: [
      {
        title: 'Pin PageMask to the toolbar',
        text: 'Open the puzzle menu, find PageMask and click the pin.',
        features: [],
      },
      {
        title: 'Four things the popup does',
        text: 'Click PageMask in the toolbar — this is the popup.',
        features: [
          'Hide items: click the parts of a page you don’t want; they disappear.',
          'Title & icon: give the tab a neutral name and icon.',
          'Turn pictures & videos gray: the whole page goes black & white like a quiet article — an independent switch, on and off any time.',
          'Cover this page: one click covers the whole page; when you’re back, click “Restore” and it returns (the button shows the shortcut for your platform).',
        ],
      },
      {
        title: 'The floating button on the page',
        text: 'On sites you’ve added it stays on the page: click the mask icon to switch “Your settings / As is”, the picture icon turns the page gray (“Turn pictures & videos gray”), the closed-eye button covers the page, ⋯ opens more actions. Press and drag it anywhere — window size changes pull it back on screen.',
        features: [],
      },
    ],
  },

  /** Two independent flows (ui/wizard, #81): "Title & icon" is a one-step form, "Hide items" is pick → check */
  wizard: {
    heading: {
      title: 'Title & icon',
      pick: 'Pick what to hide',
      preview: 'Check the result',
    },
    progress: (index: number, total: number) => `Step ${index} of ${total}`,
    titleHint: (fallback: string) =>
      `Whatever you type here is what the tab shows, right now. Leave it empty to use “${fallback}” — a title can’t be blank, or Chrome would show the address instead.`,
    pickLead: [
      'Click something on the page to pick it.',
      'Click it again to unpick. You can pick several in a row.',
      'Everything you pick is listed below, and you can unpick any of it at any time.',
    ],
    adjustGroup: 'Adjust the last pick',
    adjustNow: 'Adjusting',
    adjustEmpty: 'Nothing picked yet. Click the item you want to adjust on the page first.',
    adjustTarget: (seq: number, name: string) => `Item ${seq} (${name})`,
    bigger: 'Bigger',
    smaller: 'Smaller',
    listTitle: (n: number) => (n > 0 ? `${n} picked` : 'Picked items'),
    listEmpty: 'Nothing picked yet.',
    clearAll: 'Deselect all',
    deleteOne: (seq: number, name: string) => `Deselect item ${seq}: ${name}`,
    previewHint:
      'Scroll the page to check the result (Cover should stay glued to its element). Rename any row right here; open Adjust to change how it hides or where it applies.',
    draftsLabel: 'What will be hidden',
    adjust: 'Adjust',
    /** Row in the preview with "similar" checked: jump back to picking to inspect the group (#88) */
    inspectSame: 'Check matches',
    staleSummary: 'May be broken · can’t be found on this page',
    /** Shown after tapping "Pick again" on a broken row: names the next action */
    reselectHint: 'Click where this item sits on the page now',
    rowScopeLegend: 'Where it applies',
    rowScopeAll: 'The whole site',
    rowScopeInclude: 'Only these pages',
    rowScopeExclude: 'All but these pages',
    reselect: 'Pick again',
    advancedSummary: 'Advanced: the selector itself',
    advancedHint: 'One per line; each line is checked against this page before saving',
    selectorAria: (name: string) => `Selectors for “${name}”, one per line`,
    saveSelectors: 'Save selectors',
    errorEmpty: 'A selector can’t be empty',
    errorInvalid: (line: number) => `Line ${line} isn’t a valid selector: one per line, no { } ; @ or commas`,
    errorNoHit: (line: number) => `Line ${line} matches nothing on this page, so it can’t be saved`,
    staleWhy: (name: string, scope: string) =>
      `“${name}” can’t be found any more — the site may have changed. Where it applies: ${scope}`,
    draftsEmpty: 'Nothing to hide on this page right now. Go back a step to pick some.',
    nameLabel: (seq: number) => `Name of item ${seq}; leave empty to name it automatically`,
    methodLegend: 'Hide method',
    /** Lives inline in the picked-items list since #82; checking lights up that one group at a time */
    sameGroupToggle: (n: number) => `Also hide the other ${n} like this one`,
    /** Step through the similar members (0.8.11, #140): nav position text and the two buttons; a11y names carry context */
    sameNavPosition: (i: number, n: number) => `${i} of ${n}`,
    sameNavPrev: 'Previous',
    sameNavNext: 'Next',
    sameNavPrevAria: 'Previous similar item',
    sameNavLive: (i: number, n: number) => `Similar item: ${i} of ${n}`,
    sameNavNextAria: 'Next similar item',
    /** Checked rows repeat the exact count in their summary (n = the whole group, this one included) */
    sameGroupSummary: (n: number) => `${n} in total with the others like it`,
    scopeHintHash: 'This site tells pages apart by what follows #, so for now the whole site is the only choice',
    backToPick: 'Back: pick again',
    nextToPreview: (n: number) => `Next: check result (${n})`,
    save: 'Save',
    saving: 'Saving…',
    exit: 'Exit setup',
    exitTitle: 'Exit setup?',
    exitBodySelected: (n: number) =>
      `The ${n} picked items won’t be saved. After you exit, the tab goes back to its real name and the page to its original look.`,
    exitBodyRemoved:
      'The items you removed are still in your settings. After you exit, the tab goes back to its real name and the page to its original look.',
    exitBodyPlain:
      'The title and icon you changed won’t be saved. After you exit, the tab goes back to its real name and the page to its original look.',
    exitBodyNoChanges: 'Nothing here is unsaved yet — exiting won’t change your current settings.',
    exitStay: 'Keep setting up',
    exitConfirm: 'Exit',
    notSavedTitle: 'Not saved',
    zeroRuleNotice: (title: string) => `Saved — the tab is now named “${title}”`,
    titleResetNotice: 'Back to the site’s own title and icon',
    warnTooBig: 'That’s almost the whole page — probably not what you want. Try “Smaller”',
    warnUnstable: 'This element can’t be found reliably once switched back, so the previous setting was kept',
    warnUnsavable: (index: number) =>
      `Item ${index} can’t be found reliably. Click the ✕ next to it to skip it, then use “Bigger” to pick again`,
    warnPreviewFailed: 'The effect didn’t show up. Try again',
    warnPreviewClearFailed: 'The preview couldn’t be removed. Reload the page to get back to normal',
    warnNotCleared: 'The preview couldn’t be removed, so nothing was saved. Reload the page and try again',
    warnSaveFailed: (reason: string) => `Saving failed (${reason}). You can click save again`,
    warnSaveFailedTitleOnly: (reason: string) => `Saving failed (${reason}). You can click again`,
    noticeGone: 'This site’s settings were deleted elsewhere, so this change wasn’t saved. Start again from the extension icon.',
    noticeGoneRules: 'This site’s settings were deleted elsewhere, so this selection wasn’t saved. Start again from the extension icon.',
    noticeOk: 'Got it',
    dragAria: 'Move the toolbar (arrow keys work too)',
    dragTitle: 'Drag to move the toolbar',
    badgeJump: (seq: number) => `Jump to item ${seq} in the list`,
  },


  toggle: {
    moveAria: 'Floating button (drag it, or move with arrow keys)',
    tipOn: 'Click to see the site as it is',
    tipOff: 'Click to use your settings',
    coverAria: 'Cover this page',
    moreAria: 'More actions',
    menuTitle: 'Title & icon',
    menuContent: 'Hide items',
    menuOpacity: 'Adjust opacity',
    menuResetPos: 'Move button back to the corner',
    menuDelete: 'Delete this site’s settings',
  },

  notice: {
    saveFailed: 'Couldn’t save this change. Please try again',
    deleteFailed: 'Couldn’t delete this site’s settings. Please try again',
    settingsFailed: 'Couldn’t open the extension settings. Please try again',
  },

  curtain: {
    restoreAria: 'Remove the cover and go back to the page',
    restore: 'Restore',
  },

  errors: {
    invalidExportFile: 'This file isn’t a settings file exported by PageMask',
    newerImport: 'This file comes from a newer PageMask. Update PageMask before importing',
    noSitesInFile: (base: string) => `${base}: it has no site settings to import, so nothing was changed`,
    invalidProfile: 'The site settings are malformed and weren’t saved',
    invalidOrigin: (origin: string) => `Invalid site address: ${origin}`,
    importFailed: (reason: string) => `Import failed: ${reason}`,
    importFailedGeneric: 'Import failed: it couldn’t be completed. Please try again',
  },
};
