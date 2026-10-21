import type { TranslationSchema } from "@/i18n/types";

export const arSA = {
  common: {
    appName: "Pupitre",
    untitledFileName: "بلا_عنوان.md",
    wordsCount: (count: number) => {
      if (count === 0) return "لا توجد كلمات";
      if (count === 1) return "كلمة واحدة";
      if (count === 2) return "كلمتان";
      if (count >= 3 && count <= 10) return `${count} كلمات`;
      return `${count} كلمة`;
    },
    charsCount: (count: number) => {
      if (count === 0) return "لا توجد أحرف";
      if (count === 1) return "حرف واحد";
      if (count === 2) return "حرفان";
      if (count >= 3 && count <= 10) return `${count} أحرف`;
      return `${count} حرفاً`;
    },
    copy: "نسخ",
    copied: "تم النسخ!",
  },
  actions: {
    newDoc: "جديد",
    openDoc: "فتح",
    saveDoc: "حفظ",
  },
  shortcuts: {
    newDocTip: "مستند جديد (Ctrl+N)",
    openDocTip: "فتح مستند (Ctrl+O)",
    saveDocTip: "حفظ المستند (Ctrl+S)",
    toggleThemeLight: "التبديل إلى الوضع الفاتح",
    toggleThemeDark: "التبديل إلى الوضع الداكن",
    switchLangTip: "تغيير اللغة",
  },
  window: {
    minimize: "تصغير",
    maximize: "تكبير",
    restore: "استعادة",
    close: "إغلاق",
  },
  sidebar: {
    outline: "المخطط",
    sectionsCount: (count: number) => {
      if (count === 0) return "لا توجد أقسام";
      if (count === 1) return "قسم واحد";
      if (count === 2) return "قسمان";
      if (count >= 3 && count <= 10) return `${count} أقسام`;
      return `${count} قسماً`;
    },
    noHeadings: "لا توجد عناوين بعد",
  },
  welcome: {
    tagline: "Pupitre",
    subTagline1: "محرر ماركداون.",
    subTagline2: "انقر فوق أي كتلة للتحرير الفوري في مكانها بتناغم سلس.",
    startWriting: "ابدأ الكتابة",
    openFile: "فتح ملف",
    shortcutsHint: "Ctrl+O فتح · Ctrl+S حفظ · Esc إنهاء التحرير",
    dragDropHint: "أو اسحب ملفات ماركداون وأفلتها في هذه النافذة",
  },
  editor: {
    appendPlaceholder: "انقر هنا لإضافة فقرة جديدة في النهاية",
    editCode: "تعديل الكود",
    clickToEdit: "انقر للدخول إلى وضع التحرير",
    dblClickToEdit: "انقر نقرًا مزدوجًا للدخول إلى وضع التحرير",
    livePreview: "معاينة حية",
    waitingDiagramSyntax: "(في انتظار اكتمال بناء جملة المخطط...)",
  },
  dialogs: {
    discardConfirm: (action: string) =>
      `يحتوي المستند على تغييرات غير محفوظة. هل ما زلت ترغب في ${action}؟ سيتم فقدان هذه التغييرات.`,
    discardActionNew: "إنشاء مستند جديد",
    discardActionOpen: "فتح ملف آخر",
    copyButton: "نسخ",
    okButton: "موافق",
  },
  settings: {
    language: "اللغة",
    followSystem: "حسب النظام",
    title: "التفضيلات",
    appearance: "المظهر",
    editor: "المحرر",
    about: "حول Pupitre",
    theme: "السمة",
    themeSystem: "حسب النظام",
    themeLight: "فاتح",
    themeDark: "داكن",
    typography: "الخطوط والطباعة",
    fontSize: "حجم الخط",
    lineHeight: "ارتفاع السطر",
    fontFamily: "عائلة الخطوط",
    fontFamilySans: "خط النظام Sans",
    fontFamilyMono: "أحادي المسافة (Mono)",
    fontFamilySerif: "مذيل (Serif)",
    behavior: "السلوك والمسافة البادئة",
    tabSize: "حجم علامة التبويب",
    tabSizeDesc: "عدد المسافات لكل مستوى إزاحة",
    wordWrap: "التفاف الأسطر تلقائياً",
    wordWrapDesc: "التفاف الأسطر تلقائياً لتناسب عرض المحرر",
    editorWidth: "عرض المحرر",
    editorWidthCompact: "مدمج (720px)",
    editorWidthNormal: "قياسي (880px)",
    editorWidthWide: "عريض (1040px)",
    editorWidthFull: "كامل العرض (100%)",
    autoSave: "الحفظ التلقائي",
    autoSaveDesc: "حفظ التغييرات تلقائياً في الملف المفتوح على القرص",
    configFile: "ملف الإعدادات",
    version: "الإصدار",
    openConfigFile: "فتح في مدير الملفات",
    closeTip: "إغلاق (Esc)",
    checkForUpdates: "التحقق من وجود تحديثات",
    checkingForUpdates: "جارٍ التحقق من وجود تحديثات...",
    updateAvailable: "يتوفر إصدار جديد",
    upToDate: "Pupitre محدث إلى أحدث إصدار",
    downloadUpdate: "تحديث الآن",
    downloadingUpdate: "جارٍ تنزيل التحديث",
    restartToApply: "إعادة التشغيل للتطبيق",
    updateErrorNotFound: "لم يتم العثور على إصدارات جديدة، التطبيق محدث بالفعل.",
    updateErrorNetwork: "فشل الاتصال بالشبكة، يرجى التحقق من اتصالك والمحاولة لاحقاً.",
    updateErrorSignature: "فشل التحقق من التوقيع الرقمي، يرجى التنزيل يدوياً من الموقع.",
    updateErrorGeneric: "فشل البحث عن تحديثات، يرجى المحاولة مرة أخرى لاحقاً.",
  },
  about: {
    versionLabel: "الإصدار:",
    dateLabel: "التاريخ:",
    osLabel: "نظام التشغيل:",
    engineLabel: "المحرك:",
    userAgentLabel: "وكيل المستخدم:",
    openSampleDoc: "فتح المستند النموذجي",
    sampleDocTitle: "مستند نموذجي",
    sampleDocDesc: "استكشف ميزات Pupitre ودليل تنسيق Markdown الكامل",
  },
  menu: {
    file: "ملف",
    edit: "تحرير",
    view: "عرض",
    help: "مساعدة",
    newFile: "مستند جديد",
    openFile: "فتح ملف...",
    openRecent: "الملفات الأخيرة",
    noRecentFiles: "لا توجد ملفات أخيرة",
    save: "حفظ",
    saveAs: "حفظ باسم...",
    exportPdf: "تصدير كـ PDF...",
    close: "إغلاق النافذة",
    undo: "تراجع",
    redo: "إعادة",
    cut: "قص",
    copy: "نسخ",
    paste: "لصق",
    selectAll: "تحديد الكل",
    find: "بحث...",
    replace: "استبدال...",
    zoomIn: "تكبير",
    zoomOut: "تصغير",
    resetZoom: "إعادة ضبط التكبير",
    toggleSidebar: "تبديل المخطط الجانبي",
    toggleTheme: "تبديل السمة",
    preferences: "التفضيلات...",
    sampleDocument: "مستند Markdown نموذجي",
    about: "حول Pupitre",
    documentation: "التوثيق",
    shortcuts: "اختصارات لوحة المفاتيح",
  },
} satisfies TranslationSchema;
