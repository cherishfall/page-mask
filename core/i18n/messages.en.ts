/**
 * UI copy · English (#57). Mirrors messages.zh.ts key for key; the type annotation makes any
 * missing / extra key a compile error, and core/i18n.test.ts compares both tables recursively.
 *
 * Wording follows GLOSSARY.md: "Your settings" / "As is" (the full label "Show this site your way"
 * only on the switch itself), hide methods Disappear / Keep space / Cover, "may be broken",
 * tab title / tab icon, "cover" / "restore".
 *
 * Copy discipline (0.4.1, see AGENTS.md): name the action and the object, never invent a term.
 * One name per thing across the whole product. No "authorize", "take effect", "apply", "rule" or
 * "process" in the interface — say "allow access", "work", "shown your way", "hidden item", "change".
 * Keep it short: the popup is 320px wide and English runs longer than Chinese.
 */
import type { Messages } from './messages.zh';

/**
 * The "a title can't be blank" caveat used to be copy-pasted into three keys (0.8.15 #151).
 * One source of truth; declared outside the object because an object literal can't reference itself.
 */
const titleBlankHint = 'if you clear it completely, Chrome will show the address instead';

/**
 * "Couldn't save" was copy-pasted into four keys (media / notice / management.error.rules / common,
 * #172) with small drift: a straight apostrophe here, a final period there. One shared const.
 */
const saveFailed = 'Couldn’t save this change. Please try again';

export const en: Messages = {
  common: {
    cancel: 'Cancel',
    undo: 'Undo',
    gotIt: 'Got it',
    loading: 'Loading…',
    opening: 'Opening…',
    saveFailed,
    resetTitleIcon: 'Use the site’s own title and icon',
    shortcutBlocked: 'This page can’t be covered',
    /** Gray command on an unsupported page (0.9.2): same badge treatment */
    shortcutBlockedGray: 'This page can’t be turned gray',
    resetTitleIconHint: 'Only the title and icon — hidden items stay as they are',
    /** Back-out entry (#160), symmetric with #99; same action, same words in both places */
    resetSiteContent: 'Use the site’s own content',
    resetSiteContentHint: 'Only hidden items — the title and icon stay as they are',
    resetSiteContentTitle: 'Use the site’s own content?',
    resetSiteContentImpact: (n: number) =>
      n === 1 ? '1 item set to hide will be deleted.' : `All ${n} items set to hide will be deleted.`,
    resetSiteContentConfirm: 'Restore content',
    clean: 'Your settings',
    original: 'As is',
    cleanMode: 'Show this site your way',
    /** Hint beside the main switch when there is nothing for it to apply (#158); same meaning, not a literal translation */
    switchNoEffectHint: 'Nothing changes on the page',
    quickTitle: 'Common titles',
    /** Accessible name for the ⓘ info tag (#161): shared key, used by popup / management / settings / wizard */
    infoLabel: 'More information',
    /** Blank-title caveat shared by three keys (see the const above) */
    titleBlankHint,
    unnamedElement: 'Unnamed item',
    languageNameZh: '简体中文',
    languageNameEn: 'English',
    deleted: (name: string) => `Deleted “${name}”`,
    deleteNamed: (name: string) => `Delete “${name}”`,
    /** Delete-site-settings failure shared by the popup / page notice / management page (0.8.15 #151) */
    deleteSiteFailed: 'Couldn’t delete this site’s settings. Please try again',
    strategy: {
      remove: 'Disappear',
      blank: 'Keep space',
      mask: 'Cover',
    },
    strategyHint: {
      remove: 'Gone, and the content below moves up',
      blank: 'Invisible, but the space stays',
      mask: 'A block in the page color sits on top',
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

  /**
   * Whole-page grayscale (0.8.0, #131; upgraded to whole-page gray in 0.8.18, #156): one set of
   * labels shared by the capsule media button / popup / site settings.
   * `heading` is the card / group name and must name the same thing as the `mediaGray` switch label.
   */
  media: {
    heading: 'Whole-page gray',
    mediaGray: 'Turn the whole page gray',
    /** One short line per switch, kept short (#161); follows the switch it explains, not folded into ⓘ */
    mediaGrayHint: 'The whole page turns black & white, same place, links still work',
    /** Must stay visible (#153): the gray switch is independent of the main switch + "not unloaded" boundary. #161 keeps it to one short sentence; 0.9.3 drops the invented "keeps its own setting" phrasing */
    hint: 'Not affected by the “Show this site your way” switch; the page still loads as usual, just without color',
    /** One short line in the popup (#153): independence only. 0.9.3 names the other switch instead of pointing "above", and no longer mixes persistence into the same line */
    hintShort: 'Not affected by the “Show this site your way” switch',
    /** Unconfigured sites: turning it on goes through first-time-style permission and creates a gray-only profile (0.8.5, #134) */
    hintNew: 'Turning it on first asks you to allow access to this site',
    /** Hover / screen-reader label for the capsule media button */
    mediaTitle: 'Turn the whole page gray',
    saveFailed,
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
    /** The stale mark in the summary is now clickable (#175): the screen-reader name spells out where it goes, the visible text stays the short form */
    staleAction: (n: number) =>
      n === 1
        ? '1 item may be broken. Open “Hide items” to pick it again'
        : `${n} items may be broken. Open “Hide items” to pick it again`,
    /** One short line for an unset site; the two edit buttons in the card are the first step (#148) */
    newSiteHint: 'This site isn’t set up yet',
    pendingHint: 'The browser took away access to this site; your settings are still here and come back once you allow access again',
    /** The site was allowed, but this page isn’t covered (#162: allowed weibo.com, now on s.weibo.com) */
    pageNotAllowed: 'This page isn’t allowed yet',
    reauthorize: 'Allow access',
    reauthorizing: 'Waiting for you to allow…',
    setupMore: 'Hide items',
    /** The "Title & icon" entry: a one-step form, saved with Save (#81) */
    editTitle: 'Title & icon',
    /** Hint under the mask-card header: what the switch governs, and that gray is separate (#148) */
    cardSwitchHintNew: 'Once set up, a switch appears here',
    /** ⓘ popover (0.8.16, #153): details cut from the short hint live here, shown on hover / focus */
    mediaTooltip: 'The whole page turns black & white: same place, still readable, links still work. Autoplaying videos pause; click a video to watch it.',
    /** Page not ready but the profile is created (0.8.16, #154): an explanation, not an error */
    mediaNotReady: 'This page hasn’t finished loading. Once it’s open, the whole page turns gray automatically.',
    coverPage: 'Cover this page',
    /** Cover card: only the restore moment the user needs to judge (#148; #153; 0.9.3 drops "temporary", which repeats the button, and "changes no settings", which is jargon) */
    coverHint: 'Reloading or leaving this page restores it',
    /** Show-capsule switch (#112): 0.9.3 leaves just the label, switch and ⓘ — the old line only restated the label.
     *  #184: switch labels in English are action phrases, like the other two switches on this card */
    showToggle: 'Show the floating button',
    /** ⓘ popover (0.8.16, #153): what still works after turning it off, available on demand; the only place for it now */
    showToggleTooltip: 'The popup settings and the “Cover this page” shortcut keep working.',
    /** The "View the guide" text link in the header (0.8.11 #139 entry, moved to the title row in 0.8.15 #148) */
    replayIntro: 'View the guide',
    /** Full accessible name for the short header link (#148) */
    replayIntroAria: 'View the PageMask guide',
    /** Delete site settings (#112): same copy as the site settings page / capsule menu (core/site-delete.ts) */
    deleting: 'Deleting…',
    restorePage: 'Restore this page',
    covering: 'Covering…',
    restoring: 'Restoring…',
    manageAll: 'All site settings',
    settings: 'Settings',
    error: {
      tabMismatch: 'The page changed. Go back to the site you want to set up and click PageMask again',
      notGranted: 'The browser didn’t allow access to this site. Click again and choose “Allow”',
      injectFailed: 'Couldn’t start on this page. Reload it and try again',
      /** Storage read failed (#168): never stuck on "loading" — fall to the empty state plus this line; reopening the popup retries */
      loadFailed: 'Couldn’t read the settings. Reopen the popup and try again',
      denied: 'PageMask needs access to this site to change its title and hide items. Click again and choose “Allow”',
      gestureLost: 'Couldn’t open the permission prompt. Click PageMask again',
      toggleFailed: 'Couldn’t switch between “Your settings” and “As is”. Please try again',
      editFailed: 'Couldn’t open “Title & icon”. Reload this page and try again',
      coverFailed: 'Couldn’t cover this page. Reload it and try again',
    },
  },

  management: {
    pageTitle: 'PageMask · All site settings',

    sitesTitle: 'All site settings',
    sitesHint: 'PageMask never touches sites you didn’t add',
    /** Row-end "more" button (#113): accessible name carries the host so rows never blur together */
    moreActions: (label: string) => `More actions: ${label}`,
    sitesEmpty: 'No sites yet. Open a site you want to set up and click the PageMask icon in the toolbar to start',
    pendingAll: (n: number) =>
      n === 1
        ? '1 site hasn’t been allowed yet; until you allow it, its settings do nothing'
        : `${n} sites haven’t been allowed yet; until you allow them, their settings do nothing`,
    authorizeAll: 'Allow access to all',
    pendingBadge: 'Needs access',
    /** Pending site (#184): the switch may be on “As is” right now, so don’t promise “shown your way”
     *  once allowed — only that the settings are kept and come back; the switch decides what shows */
    pendingHint: 'The browser hasn’t allowed PageMask to open this site; your settings are kept and come back once you allow access',
    authorize: 'Allow access',

    back: '← All site settings',
    backShort: 'Back to all site settings',
    missingTitle: 'No settings for this site',
    missingHint: 'Open this site and click the PageMask icon in the toolbar to set it up',

    // “Title & icon” (#182): the card heading on the site settings page — same term as the popup
    // entry, the capsule menu item and the wizard (guarded by the same-key rule in surfaces test)
    titleIconHeading: 'Title & icon',
    titleHeading: 'Tab title',
    // The two intros (#182) follow their own fields and name the switch instead of “the switch
    // above” — the switch lives in the page header, not in this card (copy audit, 0.9.4)
    titleIntro: 'When “Show this site your way” is off, the site’s own title comes back',
    titleUnsetPlaceholder: 'Not set: the tab keeps the site’s own title',
    titleFootnoteUnset: 'Type here and save, and this site starts using your title',
    titleFootnote: (fallback: string) =>
      `Saved automatically once you stop typing; leave it empty to use “${fallback}” — ${titleBlankHint}`,

    iconHeading: 'Tab icon',
    // #191: "uses this icon" read oddly with “No icon” picked — the choice covers all three
    // kinds (site's own / none / a preset), so say "the icon follows what is picked here"
    iconIntro: 'When “Show this site your way” is on, the tab icon is whatever is picked here',
    iconSite: 'The site’s own icon',
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
      drive: 'Cloud drive',
      book: 'Knowledge base',
      chart: 'Report',
    },

    rulesHeading: 'Hidden items',
    rulesEmpty: 'Nothing set to hide',
    ruleStaleNote: (name: string) =>
      `“${name}” can’t be found on the site any more — the site may have changed; open the site and pick it again`,
    /** Read-only list on this page (#184): a plain sentence that doesn’t presume the reader has met
     *  “hide method”, and uses the registered “pick again” verb */
    rulesEditHint:
      'Hidden items are changed on the site’s own page: click the PageMask icon in the toolbar, then “Hide items”',

    deleteSite: {
      heading: 'Delete this site’s settings',
      action: 'Delete settings',
      title: (label: string) => `Delete the settings for ${label}?`,
      impact:
        'Its tab title, icon and hidden items will be deleted, PageMask’s access to this site will be withdrawn, and the site will disappear from the list.',
    },

    error: {
      auth: 'Access wasn’t allowed and your site settings are kept. Click again when needed and choose “Allow”',
      toggle: 'Couldn’t switch between “Your settings” and “As is”. Please try again',
      rules: saveFailed,
      icon: 'Couldn’t save the icon. Please try again',
    },

    import: {
      done: (parts: string, mode: string) => `Import finished: ${parts} (${mode})`,
      partAdded: (n: number) => (n === 1 ? '1 site added' : `${n} sites added`),
      partUpdated: (n: number) => (n === 1 ? '1 site updated' : `${n} sites updated`),
      partRemoved: (n: number) => (n === 1 ? '1 local site removed' : `${n} local sites removed`),
      partSkipped: (n: number) => (n === 1 ? '1 site skipped (format not recognized)' : `${n} sites skipped (format not recognized)`),
      partSkippedRules: (n: number) =>
        n === 1
          ? '1 item set to hide couldn’t be read and was skipped'
          : `${n} items set to hide couldn’t be read and were skipped`,
      modeMerge: 'merged',
      modeReplace: 'replaced',
      cancelled: 'Import cancelled. Nothing on this computer changed',
    },
  },

  settings: {
    pageTitle: 'PageMask · Settings',
    title: 'Settings',
    back: 'All site settings',

    titleHeading: 'Default title',
    titleIntro: 'Pre-filled when you open “Title & icon” for a site. Also used when you cover a page on a site that has no title of its own',
    titleLabel: 'Default title',
    titleFootnote: (fallback: string) =>
      `Leave it empty to use “${fallback}” (follows the browser language) — ${titleBlankHint}`,


    toggleHeading: 'Floating button',
    toggleOpacityLabel: 'Opacity',
    toggleOpacityLowHint: 'The fainter you set it, the harder it is to find; hover over where it was and it turns clear',
    toggleOpacityError: 'Couldn’t save the opacity, please try again.',
    toggleHint: 'How faint this button sits when idle (lower = fainter); hover brings it back instantly. The button that appears on a covered page is unaffected — always clearly visible.',

    shortcutHeading: 'Keyboard shortcuts',
    shortcutIntro:
      'Covering is temporary — reloading or leaving the page restores it; turning the whole page gray is remembered per site, press again to turn back to color',
    shortcutLabel: 'Cover / Restore',
    shortcutGrayLabel: 'Gray / Back to color',
    shortcutUnbound: 'No shortcut assigned — the system or another extension may have taken it',
    shortcutChange: 'Manage shortcuts in Chrome',
    shortcutOpenFailed: 'This browser won’t let the extension open that page. Type chrome://extensions/shortcuts in a new tab.',

    transferHeading: 'Export / Import',
    transferIntro: 'Saves every site’s settings plus these settings into one file. Import it after switching computers or reinstalling the browser to restore.',
    exportAll: 'Export all settings',
    importModeLegend: 'Import mode',
    merge: 'Merge (recommended)',
    mergeHint: 'Items set to hide for the same site are combined; settings already on this computer are kept',
    replace: 'Replace everything',
    replaceHint: 'Deletes all settings on this computer first, then uses the settings from the file (you’ll confirm once more)',
    chooseFile: 'Choose an export file to import',

    aboutHeading: 'About',
    version: 'Version',
    repo: 'Repository',
    feedback: 'Feedback',
    feedbackLink: 'Report an issue on GitHub',

    languageHeading: 'Language',
    languageIntro:
      'Every open PageMask page switches right away; the default tab title still follows the browser language',
    languageAuto: (current: string) => `Automatic (now: ${current})`,
    languageZh: '简体中文',
    languageEn: 'English',

    replaceDialog: {
      title: 'Replace all current settings with this file?',
      localSites: (sites: number, rules: number) =>
        `All ${sites} sites and ${rules} items set to hide on this computer will be replaced`,
      removed: (n: number, rules: number, list: string) =>
        `${n} of them are not in the file and will be dropped (${rules} items set to hide): ${list}`,
      incoming: (sites: number, rules: number) => `Replaced by the ${sites} sites and ${rules} items set to hide in the file`,
      settings: 'The settings here (the default title) are replaced with the ones in the file too',
      irreversible: 'This can’t be undone. If unsure, cancel first and use “Export all settings” for a copy',
      confirm: 'Replace',
    },
  },

  onboarding: {
    pageTitle: 'PageMask · Getting started',
    title: 'Welcome to PageMask',
    sub: 'Pick the parts you don’t want on the sites you visit often and hide them. PageMask never touches sites you didn’t add.',
    prev: 'Back',
    next: 'Next',
    start: 'Start using it',
    skip: 'Skip this guide',
    tip: 'Both settings entries sit at the bottom of the popup: “All site settings” and “Settings”.',
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
          // #187: follow the canonical order in docs/design-surfaces.md §三 (1 = title & icon,
          // 2 = hide items), matching the real popup embedded on the same screen; the order is
          // guarded by tests/onboarding-sync.test.ts against the surfaces table
          'Title & icon: give the tab a name and icon of your choosing.',
          'Hide items: click the parts of a page you don’t want; they disappear.',
          'Turn the whole page gray: the page turns black & white, same place.',
          'Cover this page: covers it for now; reloading restores it.',
        ],
      },
      {
        title: 'The floating button on the page',
        // #191: cover the third capsule segment (whole-page gray) that was missing, and
        // state which state the illustration shows — the embedded real capsule renders
        // "Your settings" on (the two states look different, #152)
        text: 'On sites you’ve added, a floating button sits on the page: click it to switch “Your settings / As is” or cover this page. Drag it to move it anywhere. Another button on it turns the whole page gray: one click makes the page black & white, another click brings the colors back. The picture shows “Your settings” turned on.',
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
      `Whatever you type here is what the tab shows, right now; leave it empty to use “${fallback}” — ${titleBlankHint}`,
    pickLead: [
      'Click something on the page to pick it',
      'Click it again to deselect it; you can pick several in a row',
      'Everything you pick is listed below',
    ],
    adjustGroup: 'Adjust the last pick',
    adjustNow: 'Adjusting',
    /** #161: drop the "nothing picked yet" line duplicated with listEmpty; keep only the next action */
    adjustPickFirst: 'Click the item you want to adjust on the page first',
    adjustTarget: (seq: number, name: string) => `Item ${seq} (${name})`,
    bigger: 'Bigger',
    smaller: 'Smaller',
    listTitle: (n: number) => (n > 0 ? `${n} picked` : 'Picked items'),
    listEmpty: 'Nothing picked yet',
    clearAll: 'Deselect all',
    deleteOne: (seq: number, name: string) => `Deselect item ${seq}: ${name}`,
    previewHint:
      'Rename any row; use Adjust to change how it is hidden and where it applies',
    draftsLabel: (n: number) => `What will be hidden (${n} ${n === 1 ? 'item' : 'items'})`,
    adjust: 'Adjust',
    /** Row in the preview with "similar" checked: jump back to picking to inspect the group (#88) */
    inspectSame: 'Check the ones like it',
    staleSummary: 'May be broken · can’t be found on this page',
    /** Shown after tapping "Pick again" on a broken row: names the next action */
    reselectHint: 'Click where this item sits on the page now',
    rowScopeLegend: 'Where it applies',
    rowScopeAll: 'The whole site',
    rowScopeInclude: 'Only these pages',
    rowScopeExclude: 'Except these pages',
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
    draftsEmpty: 'Nothing to hide on this page right now. Go back a step to pick some',
    nameLabel: (seq: number) => `Name of item ${seq}; leave empty to name it automatically`,
    methodLegend: 'Hide method',
    /** Lives inline in the picked-items list since #82; checking lights up that one group at a time */
    sameGroupToggle: (n: number) => `Also hide the other ${n} like this one`,
    /** Step through the similar members (0.8.11, #140): nav position text and the two buttons; a11y names carry context */
    sameNavPosition: (i: number, n: number) => `${i} of ${n}`,
    sameNavPrev: 'Previous',
    sameNavNext: 'Next',
    sameNavPrevAria: 'Previous one like it',
    sameNavLive: (i: number, n: number) => `One like this: ${i} of ${n}`,
    sameNavNextAria: 'Next one like it',
    /** Checked rows repeat the exact count in their summary (n = the whole group, this one included) */
    sameGroupSummary: (n: number) => `${n} in total with the others like it`,
    scopeHintHash: 'This site tells pages apart by what follows #, so for now the whole site is the only choice',
    backToPick: 'Back: pick what to hide',
    nextToPreview: (n: number) => `Next: check the result (${n})`,
    save: 'Save',
    saving: 'Saving…',
    exit: 'Exit setup',
    exitTitle: 'Exit setup?',
    exitBodySelected: (n: number) =>
      n === 1
        ? 'The item you picked won’t be saved. After you exit, the tab goes back to the site’s own title and the page to its original look.'
        : `The ${n} picked items won’t be saved. After you exit, the tab goes back to the site’s own title and the page to its original look.`,
    exitBodyPlain:
      'The title and icon you changed won’t be saved. After you exit, the tab goes back to the site’s own title and the page to its original look.',
    exitBodyNoChanges: 'Nothing has been changed yet this time; exiting won’t change your current settings.',
    exitStay: 'Keep setting up',
    exitConfirm: 'Exit',
    notSavedTitle: 'Not saved',
    /** Choice before saving on an as-is site (#159): both paths save; only “Turn it on” flips the switch.
     *  #184: “it” pointed at nothing — name what won’t be visible */
    openTitle: 'You won’t see the result after saving',
    openBody: '“Show this site your way” is off. Turn it on now?',
    openStay: 'Save, keep as is',
    openConfirm: 'Save, turn it on now',
    zeroRuleNotice: (title: string) => `Saved — the tab is now named “${title}”`,
    titleResetNotice: 'Back to the site’s own title and icon',
    /** Page notice after restoring hidden items (#160): the wizard is closed, so one short line says what just happened */
    rulesResetNotice: 'Back to the site’s own content',
    warnTooBig: 'That’s almost the whole page — probably not what you want. Try “Smaller”',
    /** Nested-area detection (#167): the notice design.md promised. Say what happens, no jargon */
    warnNestedShadow: 'This part sits inside a nested widget area. Hide settings can’t reach it, so it wasn’t picked',
    warnNestedIframe: 'This part sits inside a page embedded in this page. Hide settings can’t reach it, so it wasn’t picked',
    warnUnstable: 'This group can’t be found reliably, so the previous selection was kept',
    warnUnsavable: (index: number) =>
      `Item ${index} can’t be found reliably. Click the ✕ next to it to deselect it, then use “Bigger” to pick again`,
    warnPreviewFailed: 'The effect didn’t show up. Try again',
    warnPreviewClearFailed: 'The preview couldn’t be removed. Reload the page to get back to normal',
    warnNotCleared: 'The preview couldn’t be removed, so nothing was saved. Reload the page and try again',
    warnSaveFailed: (reason: string) => `Saving failed (${reason}). You can click save again`,
    warnSaveFailedTitleOnly: (reason: string) => `Saving failed (${reason}). You can click again`,
    noticeGone: 'This site’s settings were deleted elsewhere, so this change wasn’t saved. Start again from the extension icon.',
    noticeGoneRules: 'This site’s settings were deleted elsewhere, so this selection wasn’t saved. Start again from the extension icon.',
    noticeOk: 'Got it',
    dragAria: 'Move this panel (arrow keys work too)',
    dragTitle: 'Drag to move the panel',
    collapse: 'Collapse panel',
    expand: 'Expand panel',
    collapseAria: 'Collapse panel so you can click the page',
    expandAria: 'Expand panel to get the full form back',
    badgeJump: (seq: number) => `Jump to item ${seq} in the list`,
  },


  toggle: {
    moveAria: 'Floating button (press and drag it, or move it with arrow keys)',
    tipOn: 'Click to switch to “As is”',
    tipOff: 'Click to switch to “Your settings”',
    coverAria: 'Cover this page',
    moreAria: 'More actions',
    menuTitle: 'Title & icon',
    menuContent: 'Hide items',
    menuOpacity: 'Adjust opacity',
    menuResetPos: 'Move the floating button back to the bottom-right corner',
    menuDelete: 'Delete this site’s settings',
  },

  notice: {
    saveFailed,
    settingsFailed: 'Couldn’t open the extension settings. Please try again',
    /** Reading the profile failed and the wizard didn’t open (#168): one line beats a dead click */
    loadFailed: 'Couldn’t read the settings, so “Hide items” didn’t open. Try again later',
  },

  curtain: {
    restoreAria: 'Remove the cover and go back to the page you were on (press and drag it, or move it with arrow keys)',
    restore: 'Restore',
  },

  errors: {
    invalidExportFile: 'This file isn’t a settings file exported by PageMask',
    newerImport: 'This file comes from a newer PageMask. Update PageMask before importing',
    noSitesInFile: (base: string) => `${base}: it has no site settings to import, so nothing on this computer was changed`,
    invalidProfile: 'The site settings are malformed and weren’t saved',
    invalidOrigin: (origin: string) => `Invalid site address: ${origin}`,
    importFailed: (reason: string) => `Import failed: ${reason}`,
    importFailedGeneric: 'Import failed: it couldn’t be completed. Please try again',
  },
};
