/**
 * 界面文案 · 简体中文（#57）。**全项目唯一的中文文案出处**：组件、core 里的提示都从这里取，
 * 不再把中文散落在各个界面文件里。
 *
 * 写法约定：
 * - 纯文字写成字符串；带数字 / 名字的写成函数（例如 `staleCount(n)`），中英各自处理语序与单复数
 * - 键按界面分组（common / popup / management / settings / onboarding / wizard / editor / toggle /
 *   notice / curtain / errors）。`common` 放跨界面共用的几个词（保存 / 取消 / 上传图标…），
 *   避免同一个词在四个界面各写一份、改一处漏三处
 * - 界面用词以 GLOSSARY.md 为准：「收起项」「清爽 / 原样」「遮住」「恢复」「可能失效」…
 * - 本文件是键集合的**基准**：`Messages = typeof zh`，messages.en.ts 必须一一对应
 *   （单测 core/i18n.test.ts 会递归比较两边的键）
 */
export const zh = {
  /** 跨界面共用的小词与通用标签 */
  common: {
    save: '保存',
    cancel: '取消',
    delete: '删除',
    undo: '撤销',
    close: '关闭',
    gotIt: '知道了',
    loading: '正在读取…',
    opening: '正在打开…',
    processing: '正在处理…',
    uploadIcon: '上传图标',
    replaceIcon: '换一张图标',
    clearIcon: '清除图标',
    /** 清爽 / 原样两态（GLOSSARY「清爽态 / 原样态」） */
    clean: '清爽',
    original: '原样',
    /** 开关的名字 */
    cleanMode: '清爽模式',
    quickFill: '快捷填入',
    quickTitle: '快捷标题',
    /** 坏数据里没有名字的规则 */
    unnamedElement: '未命名元素',
    /** 语言名各用本语言书写，不翻译 */
    languageNameZh: '简体中文',
    languageNameEn: 'English',
    deleted: (name: string) => `已删除「${name}」`,
    deleteNamed: (name: string) => `删除「${name}」`,
    /** 收起方式（GLOSSARY「收起方式」）——全项目唯一的三个名字 */
    strategy: {
      remove: '消失',
      blank: '留空',
      mask: '盖住',
    },
    /** 每种收起方式下面的一行白话解释 */
    strategyHint: {
      remove: '下面的内容往上补',
      blank: '位置留着不动',
      mask: '盖一块和背景同色的板',
    },
    /** 给人看的生效范围（不用「整站 / 仅 / 除外」这类缩写） */
    scope: {
      all: '整个网站',
      include: (label: string) => `只在这类页面：${label}`,
      exclude: (label: string) => `除了这类页面：${label}`,
    },
    /** 一句话里的短范围（失效提示用：「最近在 … 没找到目标」） */
    scopeShort: {
      all: '整站',
      include: (label: string) => `仅 ${label}`,
      exclude: (label: string) => `除 ${label} 外`,
    },
    /** 「这类页面」的自动推导结果（写进配置，界面上显示） */
    scopePattern: {
      home: (host: string) => `${host} 的首页`,
      under: (host: string, path: string) => `${host} 上 ${path} 下的页面`,
    },
    /** 元素自动命名（core/naming.ts）：语义标签 → 人话名字 */
    elementName: {
      nav: '导航栏',
      header: '页头',
      footer: '页脚',
      aside: '侧栏',
      main: '主内容区',
      form: '表单',
      button: '按钮',
      search: '搜索框',
      video: '视频',
      audio: '音频',
      canvas: '画布',
      image: (alt: string) => `图片：${alt}`,
      fallback: (tag: string) => `${tag} 元素`,
    },
    /** 界面里列举多项时的分隔符（中文顿号，英文逗号加空格） */
    listSeparator: '、',
    /** 失效体检的结论 */
    stale: '可能失效',
    staleCount: (n: number) => `${n} 项可能失效`,
    hiddenCount: (n: number) => `已收起 ${n} 项`,
    hiddenNone: '没有收起任何内容',
  },

  /** 插件弹窗（entrypoints/popup） */
  popup: {
    loading: '正在读取当前网页…',
    unsupportedFallback: '这个页面无法使用清爽模式',
    /** 不支持的原因（core/origin.ts 的 isSupportedPage 按 code 取） */
    unsupported: {
      unparsable: '无法识别的网址',
      internal: '浏览器内部页面无法使用清爽模式',
      localFile: '本地文件无法使用清爽模式',
      webStore: 'Chrome 应用商店页面无法使用清爽模式',
      other: '这类页面无法使用清爽模式',
    },
    pendingBadge: '待授权',
    newSiteHint: '这个网站还没有设置过，开启后 PageMask 才会处理它。',
    pendingHint: '浏览器收回了这个网站的访问权限，设置都还在，重新授权后立即恢复。',
    reauthorize: '重新授权',
    reauthorizing: '正在授权…',
    setupMore: '收起更多内容',
    setupNew: '为当前网站开启清爽模式',
    editSite: '编辑当前网站',
    coverPage: '遮住本页',
    restorePage: '恢复本页',
    covering: '正在遮住…',
    restoring: '正在恢复…',
    manageAll: '管理全部网站',
    settings: '插件设置',
    /** 失败提示：不暴露内部错误 */
    error: {
      tabMismatch: '页面已经换了，请回到要设置的网站再点一次 PageMask',
      notGranted: '还没有拿到这个网站的访问权限，请再点一次并选择「允许」',
      injectFailed: '没能在这个页面启动，刷新页面后再试一次',
      denied: '需要允许访问这个网站，才能开启清爽模式。可以再点一次并选择「允许」',
      gestureLost: '没能打开权限弹窗，请再点一次 PageMask',
      toggleFailed: '没能切换清爽模式，请稍后再试一次',
      editFailed: '没能打开编辑面板，刷新这个页面后再试一次',
      coverFailed: '没能遮住这个页面，刷新这个页面后再试一次',
      restoreFailed: '没能恢复这个页面，刷新这个页面后再试一次',
    },
  },

  /** 管理页：网站列表、站点设置页，以及它们共用的 store（entrypoints/management） */
  management: {
    pageTitle: 'PageMask 管理页',
    appSub: '管理你添加的网站：清爽模式开关、标签页标题和图标，以及收起项的状态。',

    sitesTitle: '你添加的网站',
    sitesHint: '点一个网站进入它的设置页；没有添加的网站，PageMask 完全不碰。',
    sitesEmpty: '还没有添加任何网站。打开想变清爽的网站，点浏览器工具栏上的 PageMask 图标，就能开始设置。',
    pendingAll: (n: number) => `${n} 个网站待授权，授权前这些网站的设置不会生效。`,
    authorizeAll: '一次授权全部',
    pendingBadge: '待授权',
    pendingHint: '浏览器没有这个网站的访问权限，设置都还在，授权后立即生效。',
    authorize: '授权并启用',

    back: '← 返回网站列表',
    backShort: '回到网站列表',
    missingTitle: '没有这个网站的设置',
    missingHint: '打开这个网站，点浏览器工具栏上的 PageMask 图标，就能为它开启清爽模式。',

    titleHeading: '标签页标题',
    titleIntro: '清爽模式下，这个网站的标签页显示这段文字。',
    titleFootnote: (fallback: string) =>
      `停止输入后自动保存。留空则用「${fallback}」；标题不会留成空白——空白时 Chrome 会改为显示网址。`,

    iconHeading: '标签页图标',
    iconIntro: '清爽模式下替换这个网站的标签页图标。',
    currentIcon: '当前图标',
    currentIconAlt: '当前的标签页图标',
    iconUnsetDefault: '未设置：用插件设置里的默认图标',
    iconUnsetBlank: '未设置：标签页上不显示图标',
    iconHint: 'PNG、JPG、GIF、WebP 或 ICO，不超过 5MB，会自动缩小成 32×32。没有单独设置时用插件设置里的默认图标。',

    rulesHeading: '收起的内容',
    rulesEmpty: '没有收起任何内容。点下面的「在页面上编辑」到网站上挑要收起的东西。',
    ruleStaleNote: (name: string) => `「${name}」最近没找到，可能网站改版了；打开这个网站重新选一次。`,
    editOnPage: '在页面上编辑',
    editHint: '换收起方式、重新选元素都要页面上下文，在网站的页面上改，改动即时生效。',
    editOpened: '已在那个网站的标签页里打开编辑面板。',
    editNoTab: '这个网站没有打开的标签页：先打开它，再回来点「在页面上编辑」。',
    editFailed: '没能打开编辑面板，刷新那个网站的页面后再试一次。',

    /** 站点设置页页脚与 ⋯ 菜单里的同一件事（改一处两处一起改） */
    deleteSite: {
      heading: '删除这个网站的设置',
      action: '删除设置',
      title: (label: string) => `删除 ${label} 的设置？`,
      impact:
        '标签页标题、图标、收起的内容都会删掉，浏览器给 PageMask 的访问权限也会收回，它会从「你添加的网站」里消失。',
    },

    /** 写入失败 / 授权被拒 */
    error: {
      auth: '没有拿到访问权限，网站设置仍然保留；需要时再点一次并选择「允许」',
      toggle: '没能切换清爽模式，请稍后再试一次',
      rules: '没能保存这次改动，请稍后再试一次',
      reset: '没能删除这个网站的设置，请稍后再试一次',
    },

    /** 导出 / 导入的结果（如实报告） */
    import: {
      done: (parts: string, mode: string) => `导入完成：${parts}（${mode}）`,
      partAdded: (n: number) => `新增 ${n} 个网站`,
      partUpdated: (n: number) => `更新 ${n} 个网站`,
      partRemoved: (n: number) => `删掉 ${n} 个本机网站`,
      partSkipped: (n: number) => `跳过 ${n} 个无效网站`,
      partSkippedRules: (n: number) => `忽略 ${n} 个无效收起项`,
      modeMerge: '合并',
      modeReplace: '整体替换',
      cancelled: '已取消导入，本机设置没有改动',
    },
  },

  /** 插件设置页（entrypoints/settings） */
  settings: {
    pageTitle: 'PageMask 插件设置',
    title: '插件设置',
    sub: '这里的设置对所有网站生效。',
    back: '← 你添加的网站',

    titleHeading: '默认标题',
    titleIntro: '网站没有单独设置标题时，清爽模式的标签页显示这段文字。',
    titleLabel: '默认标签页标题',
    titleFootnote: (fallback: string) =>
      `留空则用「${fallback}」（跟随浏览器语言）。标签页标题不会留成空白：空白时 Chrome 会改为显示网址。`,

    iconHeading: '默认图标',
    iconIntro: '网站自己没有设置图标时，清爽模式的标签页用这张图。改这里，没单独设过图标的网站会一起变。',
    currentIcon: '当前默认图标',
    currentIconAlt: '当前的默认图标',
    iconUnset: '未设置：标签页上不显示图标',
    iconHint:
      'PNG、JPG、GIF、WebP 或 ICO，不超过 5MB，会自动缩小成 32×32。网站自己的图标优先，这里和网站都没设时标签页上不显示图标。',

    transferHeading: '导出 / 导入',
    transferIntro: '把全部网站的设置和这里的插件设置存成一个文件；换电脑或重装浏览器后导入，就能恢复。',
    exportAll: '导出全部设置',
    importModeLegend: '导入方式',
    merge: '合并（推荐）',
    mergeHint: '同一网站的收起项会合在一起，本机已有的设置不会丢',
    replace: '整体替换',
    replaceHint: '先删掉本机现有的全部设置，再换成文件里的（导入前会再确认一次）',
    chooseFile: '选择导出文件并导入',

    aboutHeading: '关于',
    version: '版本',
    repo: '仓库',
    feedback: '反馈',
    feedbackLink: '在 GitHub 上反馈问题',

    /** 界面语言（#57）：三选一，语言名各用本语言书写 */
    languageHeading: '界面语言',
    languageIntro: '切换后所有已经打开的 PageMask 页面立即生效，不需要刷新。标签页的默认标题仍然跟随浏览器语言。',
    languageAuto: (current: string) => `自动（当前：${current}）`,
    languageZh: '简体中文',
    languageEn: 'English',

    replaceDialog: {
      title: '用这个文件整体替换现有设置？',
      localSites: (sites: number, rules: number) => `本机现有的 ${sites} 个网站、${rules} 个收起项会全部被替换`,
      removed: (n: number, rules: number, list: string) =>
        `其中 ${n} 个网站在文件里没有，本机不再保留（共 ${rules} 个收起项）：${list}`,
      incoming: (sites: number, rules: number) => `换成文件里的 ${sites} 个网站、${rules} 个收起项`,
      settings: '插件设置（默认标题、默认图标）也会换成文件里的',
      irreversible: '这一步不能撤销；不放心的话，先取消并「导出全部设置」留一份',
      confirm: '确认替换',
    },
  },

  /** 首次引导（entrypoints/onboarding） */
  onboarding: {
    pageTitle: 'PageMask 新手引导',
    title: '欢迎使用 PageMask',
    sub: '点选网页上的干扰内容收起它们，给自己一个清爽、专注的阅读界面。你不设置的网站，PageMask 完全不碰。',
    done: '（已完成）',
    prev: '上一步',
    next: '下一步',
    start: '开始使用',
    tip: '小提示：「管理全部网站」和「插件设置」（导出 / 导入、界面语言都在里面）就在面板底部。',
    steps: [
      {
        title: '把 PageMask 固定到工具栏',
        text: '新装的扩展默认收在菜单里。点浏览器右上角的拼图图标（扩展程序），在列表里找到 PageMask，点它右边的图钉，图标就会一直显示在工具栏上。',
      },
      {
        title: '认识工具栏的面板',
        text: '点工具栏的 PageMask 图标打开面板：主按钮「为当前网站开启清爽模式」，开启后这个网站的页面立刻变清爽。底部并排两个入口——「管理全部网站」和「插件设置」；「遮住本页」能把整个页面连同标签页标题一起临时遮住，再点「恢复本页」就回来。',
      },
      {
        title: '三步向导，一次走完',
        text: '开启后进入三步向导：第 1 步填标签页标题和图标（只想改标题也可以，填完直接完成）；第 2 步在页面上点选要收起的内容，选中的都列成清单、可逐项删掉；第 3 步「看效果」——确认满意、定好生效范围，点保存即完成。',
      },
      {
        title: '之后的每一天',
        text: '页面右下角的小胶囊是日常开关：一点就在清爽和原样之间切换；胶囊上的「⋯」菜单能就地改标签页标题和图标、编辑收起的内容。有人走近时，用面板或胶囊上的「遮住」挡住整页——页面上会留一颗小眼睛按钮，点它就恢复。',
      },
    ],
  },

  /** 三步向导（ui/wizard） */
  wizard: {
    heading: {
      title: '标签页标题和图标',
      pick: '点选要收起的内容',
      preview: '看效果',
    },
    progress: (index: number, total: number) => `第 ${index} 步 / 共 ${total} 步`,
    titleHint: (fallback: string) =>
      `上面写什么，标签页就显示什么，现在就能看到。留空会用「${fallback}」——标题不会留成空白，空白时 Chrome 会改为显示网址。`,
    iconHintWithDefault: '图标可以不传；不传时用插件设置里的默认图标。',
    iconHintNoDefault: '图标可以不传；不传时标签页上的图标位留空。',
    /** 第 2 步的说明：一行一件事 */
    pickLead: ['点一下页面上的东西，就选中它。', '再点一下取消，可以连着选好几个。', '选中的都列在下面，随时能删。'],
    adjustGroup: '调整选中的那一项',
    adjustNow: '现在调的是',
    adjustEmpty: '还没选中东西。先在页面上点一下要调整的那一项。',
    adjustTarget: (seq: number, name: string) => `第 ${seq} 项（${name}）`,
    bigger: '选大一点',
    smaller: '选小一点',
    listTitle: (n: number) => (n > 0 ? `已选的 ${n} 项` : '已选的内容'),
    listEmpty: '还没有选任何东西。',
    clearAll: '全部删掉',
    deleteOne: (seq: number, name: string) => `删掉第 ${seq} 项：${name}`,
    nextBlocked: '先在页面上点一下要收起的内容',
    /** 第 3 步：每行两行排版 */
    previewHint: '滚动页面确认效果（盖住要能跟住元素）。每一行可以直接改名称、换收起方式、决定收它一个还是同类一起。',
    draftsLabel: '本次要收起的内容',
    nameLabel: (seq: number) => `第 ${seq} 项的名称，留空则自动命名`,
    methodLegend: '收起方式',
    onlyLegend: (seq: number) => `第 ${seq} 项收起几个`,
    onlyThis: '只这一个',
    sameGroup: (n: number) => `同类一起（${n}）`,
    sameNone: '页面上没有第二个同类',
    scopeLegend: '在哪些页面收起',
    scopeAll: '整个网站（默认）',
    scopeInclude: (label: string) => `只在这类页面：${label}`,
    scopeExclude: (label: string) => `除了这类页面：${label}`,
    /** 用 # 区分页面的网站推不出「这类页面」时的一句说明 */
    scopeHintHash: '这个网站用 # 区分页面，暂时只能按整站生效',
    back: '上一步',
    nextToPick: '下一步：选内容',
    nextToPreview: (n: number) => `下一步：看效果（${n}）`,
    save: '保存',
    titleDone: '只改标题，完成',
    exit: '退出设置',
    exitTitle: '退出设置？',
    exitBodySelected: (n: number) => `已经选的 ${n} 项不会保存；退出后标签页会变回原来的名字，页面恢复原样。`,
    exitBodyPlain: '改过的标题和图标不会保存；退出后标签页会变回原来的名字，页面恢复原样。',
    exitStay: '继续设置',
    exitConfirm: '退出',
    notSavedTitle: '没有保存',
    /** 保存后 0 条规则的轻提示 */
    zeroRuleNotice: (title: string) => `已保存，标签页名字换成「${title}」了`,
    /** 运行中的提示条 */
    warnTooBig: '选到接近整页的内容了，可能不是你想要的；试试「选小一点」',
    warnUnstable: '切换后没法稳定识别这个元素，已保持原来的设置',
    warnUnsavable: (index: number) =>
      `第 ${index} 个元素没法稳定识别：请点它右边的 ✕ 不收起这一项，再用「选大一点」重新选`,
    warnPreviewFailed: '预览没能生效，请再点一次预览试试',
    warnPreviewClearFailed: '预览效果没能撤掉，刷新页面即可恢复',
    warnNotCleared: '预览效果没能撤掉，本次没有保存。请刷新页面后重试',
    warnSaveFailed: (reason: string) => `保存没有成功（${reason}），可以再点一次保存`,
    warnSaveFailedTitleOnly: (reason: string) => `保存没有成功（${reason}），可以再点一次`,
    /** 向导期间站点配置被别处删掉 */
    noticeGone: '这个网站的设置在别处被删掉了，本次修改没有保存。可以从扩展图标重新开始设置。',
    noticeGoneRules: '这个网站的设置在别处被删掉了，本次选择没有保存。可以从扩展图标重新开始设置。',
    noticeOk: '知道了',
    dragAria: '移动工具条（也可以用方向键）',
    dragTitle: '拖动可移动工具条',
    /** 页面上号码牌的读屏名字 */
    badgeJump: (seq: number) => `跳转到清单里的第 ${seq} 项`,
  },

  /** 页面内编辑面板（ui/editor） */
  editor: {
    title: '编辑收起的内容',
    close: '关闭编辑面板',
    hint: (n: number) => `只列当前页面生效的规则（${n} 条）；改动即时生效`,
    emptyAll: '这个网站还没有收起任何内容。先到页面上点选你想收起来的东西。',
    emptyPage: '这个页面还没有生效的收起项。可以在页面上再选一些内容。',
    start: '开始选要收起的内容',
    health: (name: string, scope: string) => `「${name}」的隐藏规则最近在${scope}没找到目标，可能网站改版了`,
    fix: '去处理',
    methodLegend: '收起方式',
    scopeLegend: '生效范围',
    scopeAll: '整站',
    scopeInclude: '仅这类页面',
    scopeExclude: '排除这类页面',
    scopeValueInclude: (label: string) => `仅：${label}`,
    scopeValueExclude: (label: string) => `除：${label}`,
    reselect: '重选元素',
    advancedSummary: '高级：选择器原文',
    advancedHint: '每行一个，保存前会在当前页面检查',
    selectorAria: (name: string) => `「${name}」的选择器，每行一个`,
    saveSelectors: '保存选择器',
    addMore: '收起更多内容',
    /** 高级后门的逐行校验 */
    errorEmpty: '选择器不能为空',
    errorInvalid: (line: number) => `第 ${line} 行不是有效的选择器：每行只能写一个，不能包含 { } ; @ 或逗号`,
    errorNoHit: (line: number) => `第 ${line} 行在当前页面没有找到目标，不能保存`,
  },

  /** 页面右下角的小胶囊（ui/FloatingToggle） */
  toggle: {
    gripAria: '移动按钮（也可以用方向键）',
    gripTitle: '拖动可移动按钮',
    tipOn: 'PageMask：清爽中，点击还原',
    tipOff: 'PageMask：点击开启清爽模式',
    coverAria: '遮住整页',
    moreAria: '更多操作',
    menuTitle: '标签页标题和图标',
    menuEdit: '编辑收起的内容',
    menuResetPos: '按钮放回右下角',
    menuDelete: '删除这个网站的设置',
    /** 就地改标题的小面板 */
    panelTitle: '标签页标题和图标',
    panelClose: '关闭',
    panelOriginalNote: '现在是原样态，切到清爽才会看到效果。',
    panelSwitchClean: '切到清爽',
    panelTitleHint: (placeholder: string) =>
      `保存后生效。留空则用「${placeholder}」——标题不会留成空白，空白时 Chrome 会改为显示网址。`,
    panelIconHintWithDefault: '不传图标时用插件设置里的默认图标。',
    panelIconHintNoDefault: '不传图标时标签页上的图标位留空。',
    iconAlt: '将显示在标签页上的图标',
  },

  /** 页内轻提示（ui/page-notice） */
  notice: {
    saveFailed: '没能保存这次改动，请稍后再试一次',
    deleteFailed: '没能删除这个网站的设置，请稍后再试一次',
  },

  /** 幕布上的「恢复」按钮（ui/curtain-restore） */
  curtain: {
    restoreAria: '撤掉幕布，回到刚才的页面',
    restore: '恢复',
  },

  /** 出错时给用户看的话（core 里的导出、导入、图标处理等） */
  errors: {
    invalidExportFile: '不是有效的 PageMask 导出文件',
    newerImport: '这个导出文件来自更新版本的 PageMask，请先升级后再导入',
    noSitesInFile: (base: string) => `${base}：里面没有可导入的站点配置，本地数据没有改动`,
    invalidProfile: '站点配置数据不合法，未保存',
    invalidOrigin: (origin: string) => `无效的站点地址：${origin}`,
    importFailed: (reason: string) => `导入失败：${reason}`,
    importFailedGeneric: '导入失败：这次没能完成导入，请稍后再试一次',
    iconType: '只支持 PNG、JPG、GIF、WebP、ICO 格式的图片',
    iconTooLarge: '图片太大了（超过 5MB），请换一张小一点的图片',
    iconDecode: '这张图片打不开，请换一张 PNG 或 JPG 图片',
    iconEncode: '图片处理失败，请换一张图片再试',
    iconSave: '没能保存图标，请再试一次',
    iconClear: '没能清除图标，请再试一次',
    iconProcess: '没能处理这张图标，请再试一次',
  },
};

/** 文案表的类型：en 必须严格对齐它（多一个键、少一个键、函数签名不同都是编译错误） */
export type Messages = typeof zh;
