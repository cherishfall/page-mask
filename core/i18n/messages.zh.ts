/**
 * 界面文案 · 简体中文（#57）。**全项目唯一的中文文案出处**：组件、core 里的提示都从这里取，
 * 不再把中文散落在各个界面文件里。
 *
 * 写法约定：
 * - 纯文字写成字符串；带数字 / 名字的写成函数（例如 `staleCount(n)`），中英各自处理语序与单复数
 * - 键按界面分组（common / popup / management / settings / onboarding / wizard / editor / toggle /
 *   notice / curtain / errors）。`common` 放跨界面共用的几个词（保存 / 取消 / 上传图标…），
 *   避免同一个词在四个界面各写一份、改一处漏三处
 * - 界面用词以 GLOSSARY.md 为准：「收起项」「按设置 / 原样」「遮住」…
 * - 本文件是键集合的**基准**：`Messages = typeof zh`，messages.en.ts 必须一一对应
 *   （单测 core/i18n.test.ts 会递归比较两边的键）
 *
 * 用词纪律（0.4.1 起，见 AGENTS.md「界面文案」）：
 * - 说具体的动作与对象，不造抽象名词。每句话只回答「这是什么」「点下去会发生什么」
 * - 同一件事全项目只许一种叫法：两态固定写「按设置」「原样」（开关标签用全称「按你的设置显示」），范围固定写
 *   「整个网站 / 只在这类页面 / 除了这类页面」，不出现「整站」「仅」「除外」这类缩写
 * - 不出现「授权」「生效」「规则」「处理」这类行话：「允许访问」「起作用」「收起项」「改」
 * - 宁可长一点、朴素一点，也不要短得让人猜
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
    /** 回退出口（#99）：两处同名同物，动作说清结果、不叫「重置」 */
    resetTitleIcon: '恢复网站原来的标题和图标',
    /** 幕布快捷键在这个页面上用不了（chrome:// / 商店 / PDF）：扩展图标角标的悬停说明 */
    shortcutBlocked: '这个页面不能遮住',
    resetTitleIconHint: '只恢复标题和图标，收起的内容不受影响。',
    /** 两个状态的名字（GLOSSARY「清爽态 / 原样态」）：短名，用在胶囊与列表上，不用来解释动作 */
    clean: '按设置',
    original: '原样',
    /** 开关的名字：说清打开之后是什么样子 */
    cleanMode: '按你的设置显示',
    /** 输入框下面那几个现成标题的名字 */
    quickFill: '现成的标题',
    quickTitle: '现成的标题',
    /** 坏数据里没有名字的收起项 */
    unnamedElement: '未命名的元素',
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
      remove: '整块消失，下面的内容往上顶',
      blank: '看不见了，但位置还占着',
      mask: '在原位盖一块和背景同色的方块',
    },
    /** 给人看的范围（与向导、编辑面板同一套说法） */
    scope: {
      all: '整个网站',
      include: (label: string) => `只在这类页面：${label}`,
      exclude: (label: string) => `除了这类页面：${label}`,
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
      main: '主要内容区',
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
    /** 中性说法：不管现在是「按设置」还是「原样」，都只说设置了多少项 */
    hiddenCount: (n: number) => `${n} 项收起设置`,
    hiddenNone: '还没有收起设置',
  },

  /** 插件弹窗（entrypoints/popup） */
  popup: {
    loading: '正在读取当前网页…',
    unsupportedFallback: '这个页面用不了 PageMask',
    /** 不支持的原因（core/origin.ts 的 isSupportedPage 按 code 取）：说清为什么，不只说不行 */
    unsupported: {
      unparsable: '认不出这个网址',
      internal: 'Chrome 自己的页面不让扩展改动，换一个普通网页再试',
      localFile: '电脑上的本地文件不让扩展改动，打开网上的页面再试',
      webStore: 'Chrome 应用商店的页面不让扩展改动',
      other: '这类页面不让扩展改动',
    },
    pendingBadge: '需要允许访问',
    newSiteHint: '这个网站还没设置过。「收起内容」点选页面上不要的部分，「标题和图标」改标签页的名字和图标；想临时挡住整页，用「遮住这一页」。',
    pendingHint: '浏览器收回了这个网站的访问权限。你的设置都还在，重新允许访问就回来了。',
    reauthorize: '允许访问',
    reauthorizing: '正在等你允许…',
    setupMore: '收起内容',
    /** 「标题和图标」入口：进单步小表单，填完点「保存」（#81） */
    editTitle: '标题和图标',
    coverPage: '遮住这一页',
    restorePage: '恢复这一页',
    covering: '正在遮住…',
    restoring: '正在恢复…',
    manageAll: '全部网站设置',
    settings: '插件设置',
    /** 失败提示：不暴露内部错误 */
    error: {
      tabMismatch: '页面已经换了。回到要设置的那个网站，再点一次 PageMask',
      notGranted: '还没拿到这个网站的访问权限。再点一次，在浏览器的提示里选「允许」',
      injectFailed: '没能在这个页面上启动。刷新页面后再试一次',
      denied: '要允许 PageMask 访问这个网站，才能改它的标题、收起内容。再点一次并选「允许」',
      gestureLost: '没能弹出权限提示，再点一次 PageMask',
      toggleFailed: '没能切换显示方式，请稍后再试一次',
      editFailed: '没能打开编辑面板。刷新这个页面后再试一次',
      coverFailed: '没能遮住这个页面。刷新后再试一次',
      restoreFailed: '没能恢复这个页面。刷新后再试一次',
    },
  },

  /** 管理页：网站列表、站点设置页，以及它们共用的 store（entrypoints/management） */
  management: {
    pageTitle: 'PageMask · 全部网站设置',
    appSub: '这里是你添加过的网站。点一个进去，改它的标签页标题、图标，或者看它收起了哪些内容。',

    sitesTitle: '全部网站设置',
    sitesHint: '点一个网站进入它的设置。你没添加的网站，PageMask 完全不碰。',
    sitesEmpty: '还没有添加任何网站。打开一个你想收拾的网站，点浏览器工具栏上的 PageMask 图标就能开始设置。',
    pendingAll: (n: number) => `有 ${n} 个网站还没允许访问。在你允许之前，这些网站的设置不会起作用。`,
    authorizeAll: '全部允许',
    pendingBadge: '需要允许访问',
    pendingHint: '浏览器还没允许 PageMask 访问这个网站。设置都还在，允许之后就会按设置显示。',
    authorize: '允许访问',

    back: '← 全部网站设置',
    backShort: '回到全部网站设置',
    missingTitle: '没有这个网站的设置',
    missingHint: '打开这个网站，点浏览器工具栏上的 PageMask 图标，就能设置它。',

    titleHeading: '标签页标题',
    titleIntro: '保存后，这个网站的标签页就显示这段文字；开关切到「原样」时，仍显示网站本来的标题。',
    titleUnsetPlaceholder: '没设置过：标签页保持网站原来的标题',
    titleFootnoteUnset: '在这里输入并保存后，这个网站才开始用你设置的标题。',
    titleFootnote: (fallback: string) =>
      `停止输入后自动保存。留空就用「${fallback}」——标题不能留成空白，空白时 Chrome 会改成显示网址。`,

    iconHeading: '标签页图标',
    iconIntro: '上面的「按你的设置显示」开关打开时，标签页用这张图当图标。',
    currentIcon: '当前图标',
    currentIconAlt: '当前的标签页图标',
    iconUnsetDefault: '没设置：用插件设置里的默认图标',
    iconUnsetBlank: '没设置：标签页上不显示图标',
    iconHint: '支持 PNG、JPG、GIF、WebP、ICO，最大 5MB，会自动缩成 32×32。',

    rulesHeading: '收起的内容',
    rulesEmpty: '还没有收起任何内容。',
    ruleStaleNote: (name: string) => `「${name}」最近在网站上找不到了，可能网站改版了。打开这个网站重新选一次。`,
    /** 这一页只读清单；换成怎么收、重选元素都要页面上下文，所以指回页面（#71） */
    rulesEditHint: '换收起方式或重新选，要在那个网站的页面上做：点工具栏上的 PageMask 图标，再点「收起内容」。',

    /** 站点设置页页脚与 ⋯ 菜单里的同一件事（改一处两处一起改） */
    deleteSite: {
      heading: '删除这个网站的设置',
      action: '删除设置',
      title: (label: string) => `删除 ${label} 的设置？`,
      impact:
        '标签页标题、图标、收起的内容都会删掉，浏览器给 PageMask 的访问权限也会收回，它会从列表里消失。',
    },

    /** 写入失败 / 允许被拒 */
    error: {
      auth: '没有拿到访问权限，网站设置还留着；需要时再点一次并选「允许」',
      toggle: '没能切换显示方式，请稍后再试一次',
      rules: '没能保存这次改动，请稍后再试一次',
      reset: '没能删除这个网站的设置，请稍后再试一次',
    },

    /** 导出 / 导入的结果（如实报告） */
    import: {
      done: (parts: string, mode: string) => `导入完成：${parts}（${mode}）`,
      partAdded: (n: number) => `新增 ${n} 个网站`,
      partUpdated: (n: number) => `更新 ${n} 个网站`,
      partRemoved: (n: number) => `删掉 ${n} 个本机的网站`,
      partSkipped: (n: number) => `跳过 ${n} 个格式不对的网站`,
      partSkippedRules: (n: number) => `忽略 ${n} 条读不出来的收起设置`,
      modeMerge: '合并',
      modeReplace: '整体替换',
      cancelled: '已取消导入，本机的设置没有改动',
    },
  },

  /** 插件设置页（entrypoints/settings） */
  settings: {
    pageTitle: 'PageMask · 插件设置',
    title: '插件设置',
    sub: '这里管的是所有网站共用的一套设置。',
    back: '← 全部网站设置',

    titleHeading: '默认标题',
    titleIntro: '打开某个网站的「标题和图标」时，这一项会预先填进去；遮住整页时，没单独设过标题的网站也用它。',
    titleLabel: '默认标签页标题',
    titleFootnote: (fallback: string) =>
      `留空就用「${fallback}」（跟随浏览器语言）。标题不能留成空白，空白时 Chrome 会改成显示网址。`,

    iconHeading: '默认图标',
    iconIntro: '打开某个网站的「标题和图标」时，这一项会预先填进去；遮住整页时，没单独设过图标的网站也用它。',
    currentIcon: '当前默认图标',
    currentIconAlt: '当前的默认图标',
    iconUnset: '没设置：标签页上不显示图标',
    iconHint:
      '支持 PNG、JPG、GIF、WebP、ICO，最大 5MB，会自动缩成 32×32。网站自己设的图标优先；网站和这里都没设时，标签页上不显示图标。',

    toggleHeading: '右下角的小按钮',
    toggleIntro: '它平时压在网页上。嫌它显眼可以调淡一点——鼠标移上去、用键盘选中或拖动时，它会立刻恢复清晰。',
    toggleOpacityLabel: { full: '清晰', soft: '淡一点', faint: '很淡' },
    toggleHint: '只影响这颗小按钮，不影响遮住整页后那颗「恢复」。',

    shortcutHeading: '快捷键',
    shortcutIntro: '有人走过来时，不用找鼠标：按一下遮住整页，再按一下恢复。',
    shortcutLabel: '遮住 / 恢复',
    shortcutUnbound: '没有绑定快捷键，可能被别的扩展占用了',
    shortcutChange: '在 Chrome 里更改',
    shortcutHint:
      'Windows / Linux 默认 Ctrl+Shift+X，Mac 默认 ⌘+Shift+X。改键在 Chrome 自己的快捷键页面，改完这里会跟着变。',
    shortcutOpenFailed: '这个浏览器不让扩展直接打开那一页，请在新标签页输入 chrome://extensions/shortcuts',

    transferHeading: '导出 / 导入',
    transferIntro: '把全部网站的设置和这里的插件设置存成一个文件。换电脑或重装浏览器后导入，就能恢复。',
    exportAll: '导出全部设置',
    importModeLegend: '导入方式',
    merge: '合并（推荐）',
    mergeHint: '同一个网站的收起设置合在一起，本机已经有的设置不会丢',
    replace: '整体替换',
    replaceHint: '先删掉本机现有的全部设置，再换成文件里的（导入前还会再确认一次）',
    chooseFile: '选择导出文件并导入',

    aboutHeading: '关于',
    version: '版本',
    repo: '仓库',
    feedback: '反馈',
    feedbackLink: '在 GitHub 上反馈问题',

    /** 界面语言（#57）：三选一，语言名各用本语言书写 */
    languageHeading: '界面语言',
    languageIntro: '切换后所有已经打开的 PageMask 页面马上变，不用刷新。标签页的默认标题仍然跟随浏览器语言。',
    languageAuto: (current: string) => `自动（现在：${current}）`,
    languageZh: '简体中文',
    languageEn: 'English',

    replaceDialog: {
      title: '用这个文件整体替换现有设置？',
      localSites: (sites: number, rules: number) => `本机现有的 ${sites} 个网站、${rules} 项收起设置会全部被替换`,
      removed: (n: number, rules: number, list: string) =>
        `其中 ${n} 个网站在文件里没有，本机不再保留（共 ${rules} 项收起设置）：${list}`,
      incoming: (sites: number, rules: number) => `换成文件里的 ${sites} 个网站、${rules} 项收起设置`,
      settings: '插件设置（默认标题、默认图标）也会换成文件里的',
      irreversible: '这一步不能撤销。不放心的话先取消，用「导出全部设置」留一份',
      confirm: '确认替换',
    },
  },

  /** 首次引导（entrypoints/onboarding） */
  onboarding: {
    pageTitle: 'PageMask · 开始使用',
    title: '欢迎使用 PageMask',
    sub: '在常看的网站上点几下，把不想看的部分收起来。你没添加的网站，PageMask 完全不碰。',
    done: '（已完成）',
    prev: '上一步',
    next: '下一步',
    start: '开始使用',
    tip: '两个设置入口在弹窗最下面：全部网站设置、插件设置。',
    /** 读屏播报当前步（#108）：切步时更新，不抢焦点 */
    stepStatus: (n: number, m: number, title: string) => `第 ${n} 步，共 ${m} 步：${title}`,
    steps: [
      {
        title: '把 PageMask 固定到工具栏',
        text: '点拼图图标找到 PageMask，点图钉固定。',
        features: [],
      },
      {
        title: '弹窗里能做的三件事',
        text: '点工具栏上的 PageMask，弹出这个小窗口。',
        features: [
          '收起内容：点页面上不想要的部分，它们就消失。',
          '标题和图标：把标签页的名字和图标换成中性的。',
          '遮住这一页：整页盖住，人走了再点「恢复」。也可以按 Ctrl+Shift+X（Windows）/ ⌘+Shift+X（Mac）。',
        ],
      },
      {
        title: '平时用右下角那颗小按钮',
        text: '在你添加过的网站上，它一直待在右下角：点中间切换「按设置 / 原样」，点眼睛遮住整页，点 ⋯ 进设置。',
        features: [],
      },
    ],
  },

  /** 两条独立流程（ui/wizard，#81）：「标题和图标」单步小表单 +「收起内容」选内容 → 看效果 */
  wizard: {
    heading: {
      title: '标题和图标',
      pick: '点选要收起的内容',
      preview: '看效果',
    },
    progress: (index: number, total: number) => `第 ${index} 步 / 共 ${total} 步`,
    titleHint: (fallback: string) =>
      `上面写什么，标签页就显示什么，现在就能看到。留空就用「${fallback}」——标题不能留成空白，空白时 Chrome 会改成显示网址。`,
    iconHintWithDefault: '图标可以不传。不传的话，用插件设置里的默认图标。',
    iconHintNoDefault: '图标可以不传。不传的话，标签页上不显示图标。',
    /** 选内容这一步的说明：一行一件事 */
    pickLead: ['点一下页面上的东西，就选中它。', '再点一下取消选中。可以连着选好几个。', '选中的都列在下面，随时可以取消。'],
    adjustGroup: '调整选中的那一项',
    adjustNow: '现在调的是',
    adjustEmpty: '还没选中东西。先在页面上点一下要调整的那一项。',
    adjustTarget: (seq: number, name: string) => `第 ${seq} 项（${name}）`,
    bigger: '选大一点',
    smaller: '选小一点',
    listTitle: (n: number) => (n > 0 ? `已选的 ${n} 项` : '已选的内容'),
    listEmpty: '还没有选任何东西。',
    clearAll: '全部取消选择',
    deleteOne: (seq: number, name: string) => `取消选择第 ${seq} 项：${name}`,
    /** 看效果：每行两行排版 */
    /** 看效果：每行两行排版。「同类一起」的勾选框住在选内容行内（#82），这里不再提 */
    previewHint: '滚动页面看看效果（「盖住」要能跟着元素一起滚）。每一行可以直接改名字；收起方式、在哪些页面收起，点「调整」再改。',
    draftsLabel: '这次要收起的内容',
    /** 行上的展开按钮：收起方式、范围、重选、高级选择器都在里面（审查第 8 条） */
    adjust: '调整',
    /** 预览行里勾了同类的行：跳回点选阶段检查组员（#88） */
    inspectSame: '检查同类',
    /** 失效行的摘要：说清它可能没用了 */
    staleSummary: '可能失效 · 在页面上找不到了',
    /** 失效行点「重新选」后的一句提示：下一个动作是什么 */
    reselectHint: '在页面上点一下这一项现在所在的位置',
    /** 每行「调整」里那几件事（原来在独立编辑面板里，#71 搬进来） */
    rowScopeLegend: '在哪些页面收起',
    rowScopeAll: '整个网站',
    rowScopeInclude: '只在这类页面',
    rowScopeExclude: '除了这类页面',
    reselect: '重新选',
    advancedSummary: '高级：选择器原文',
    advancedHint: '每行写一个，保存前会在这个页面上检查能不能找到',
    selectorAria: (name: string) => `「${name}」的选择器，每行一个`,
    saveSelectors: '保存选择器',
    /** 高级后门的逐行校验 */
    errorEmpty: '选择器不能为空',
    errorInvalid: (line: number) => `第 ${line} 行不是有效的选择器：每行只能写一个，不能包含 { } ; @ 或逗号`,
    errorNoHit: (line: number) => `第 ${line} 行在这个页面上找不到目标，不能保存`,
    /** 失效那一行为什么可能没用了 */
    staleWhy: (name: string, scope: string) => `「${name}」最近找不到目标了，可能网站改版了。在哪些页面收起：${scope}`,
    /** 看效果一条都没有时（只剩失效项被删光） */
    draftsEmpty: '这个页面上没有用得上的收起项。可以回到上一步再选一些内容。',
    nameLabel: (seq: number) => `第 ${seq} 项的名称，留空就自动起名`,
    methodLegend: '收起方式',
    /** 一行勾选框回答一个是非题：页面上一样的要不要一起收（n 是「另外几个」，不含这一项本身）。
     *  #82 起住在选内容清单的行内；勾上当场把这一组亮出来，一次一组 */
    sameGroupToggle: (n: number) => `页面上另外 ${n} 个一样的也一起收起`,
    /** 勾了同类的行，看效果的摘要上报一次具体的个数（n 是连这一项一起的总数） */
    sameGroupSummary: (n: number) => `连一样的共 ${n} 个`,
    /** 用 # 区分页面的网站推不出「这类页面」时的一句说明 */
    scopeHintHash: '这个网站用 # 后面的内容区分页面，暂时只能整个网站一起收起',
    /** 「上一步」写清退回去做什么：看效果退回选内容（选内容没有上一步） */
    backToPick: '上一步：重新选内容',
    nextToPreview: (n: number) => `下一步：看效果（${n}）`,
    save: '保存',
    /** 保存中：按钮文字变进行时，不另写原因 */
    saving: '正在保存…',
    exit: '退出设置',
    exitTitle: '退出设置？',
    exitBodySelected: (n: number) => `已经选的 ${n} 项不会保存。退出后标签页会变回原来的名字，页面也恢复原样。`,
    /** 草稿全被去掉了、但有改动时的退出确认：说清退出 = 放弃这次修改 */
    exitBodyRemoved: '这次去掉的收起项还留在原来的设置里。退出后标签页会变回原来的名字，页面也恢复原样。',
    exitBodyPlain: '改过的标题和图标不会保存。退出后标签页会变回原来的名字，页面也恢复原样。',
    exitStay: '继续设置',
    exitConfirm: '退出',
    notSavedTitle: '没有保存',
    /** 保存后 0 条收起设置的轻提示 */
    zeroRuleNotice: (title: string) => `已保存，标签页名字换成「${title}」了`,
    titleResetNotice: '已恢复网站原来的标题和图标',
    /** 运行中的提示条 */
    warnTooBig: '选到接近整页的内容了，可能不是你要的。试试「选小一点」',
    warnUnstable: '切回去以后没法稳定找到这个元素，已经保留原来的设置',
    warnUnsavable: (index: number) =>
      `第 ${index} 个元素没法稳定找到：点它右边的 ✕ 不收起这一项，再用「选大一点」重新选`,
    warnPreviewFailed: '效果没有显示出来，再试一次',
    warnPreviewClearFailed: '预览效果没能撤掉，刷新页面就恢复了',
    warnNotCleared: '预览效果没能撤掉，这次没有保存。刷新页面后再试一次',
    warnSaveFailed: (reason: string) => `保存没有成功（${reason}），可以再点一次保存`,
    warnSaveFailedTitleOnly: (reason: string) => `保存没有成功（${reason}），可以再点一次`,
    /** 设置期间站点配置被别处删掉 */
    noticeGone: '这个网站的设置在别处被删掉了，这次修改没有保存。可以从扩展图标重新开始设置。',
    noticeGoneRules: '这个网站的设置在别处被删掉了，这次选择没有保存。可以从扩展图标重新开始设置。',
    noticeOk: '知道了',
    dragAria: '移动工具条（也可以用方向键）',
    dragTitle: '拖动可以移动工具条',
    /** 页面上号码牌的读屏名字 */
    badgeJump: (seq: number) => `跳到清单里的第 ${seq} 项`,
  },

  /** 页面内编辑面板（ui/editor） */

  /** 页面右下角的小按钮（ui/FloatingToggle） */
  toggle: {
    gripAria: '移动按钮（也可以用方向键）',
    gripTitle: '拖动可以移动按钮',
    tipOn: '点一下看原样',
    tipOff: '点一下按你的设置显示',
    coverAria: '遮住整个页面',
    moreAria: '更多操作',
    menuTitle: '标题和图标',
    menuContent: '收起内容',
    menuResetPos: '按钮放回右下角',
    /** mini 与全功能互切的一对图标钮（不进菜单，#78） */
    shrinkAria: '切换成小按钮',
    expandAria: '切换成完整按钮',
    menuDelete: '删除这个网站的设置',
    iconAlt: '将要显示在标签页上的图标',
  },

  /** 页内轻提示（ui/page-notice） */
  notice: {
    saveFailed: '没能保存这次改动，请稍后再试一次',
    deleteFailed: '没能删除这个网站的设置，请稍后再试一次',
  },

  /** 遮住整页后那颗「恢复」按钮（ui/curtain-restore） */
  curtain: {
    restoreAria: '取消遮住，回到刚才的页面',
    restore: '恢复',
  },

  /** 出错时给用户看的话（core 里的导出、导入、图标处理等） */
  errors: {
    invalidExportFile: '这个文件不是 PageMask 导出的设置文件',
    newerImport: '这个文件来自更新版本的 PageMask，先升级 PageMask 再导入',
    noSitesInFile: (base: string) => `${base}：文件里没有能导入的网站设置，本机的数据没有改动`,
    invalidProfile: '网站设置的数据格式不对，没有保存',
    invalidOrigin: (origin: string) => `网站地址不对：${origin}`,
    importFailed: (reason: string) => `导入失败：${reason}`,
    importFailedGeneric: '导入失败：这次没能完成，请稍后再试一次',
    iconType: '只支持 PNG、JPG、GIF、WebP、ICO 格式的图片',
    iconTooLarge: '图片太大了（超过 5MB），换一张小一点的',
    iconDecode: '这张图片打不开，换一张 PNG 或 JPG 试试',
    iconEncode: '图片处理失败，换一张试试',
    iconSave: '没能保存图标，再试一次',
    iconClear: '没能清除图标，再试一次',
    iconProcess: '没能处理这张图标，再试一次',
  },
};

/** 文案表的类型：en 必须严格对齐它（多一个键、少一个键、函数签名不同都是编译错误） */
export type Messages = typeof zh;
