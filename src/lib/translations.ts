/**
 * SomaLabel Centralized Translations
 * Supported languages: English ('en') and Luganda ('lug')
 * Note: Luganda strings are marked with [REVIEW NEEDED] for native-speaker verification.
 */

export type Language = 'en' | 'lug';

export interface UIStrings {
  appName: string;
  headerTitle: string;
  // Home Screen
  headline: string;
  subtext: string;
  scanButton: string;
  orChoosePhoto: string;
  trySampleLabel: string;
  samplePackParacetamol: string;
  samplePackCoartem: string;
  samplePackExpired: string;
  samplePackBlurry: string;
  sampleOutcomeValid: string;
  sampleOutcomeExpSoon: string;
  sampleOutcomeExpired: string;
  sampleOutcomeBlurry: string;
  // Loading Screen
  readingLabel: string;
  checkingExpiry: string;
  checkingRegister: string;
  // Result Screen
  medicineIdentified: string;
  expiryChipLabel: string;
  registrationChipLabel: string;
  statusExpired: string;
  statusExpiresSoon: string;
  statusValid: string;
  statusNotFound: string;
  statusRegistered: string;
  statusNotInList: string;
  statusNotPrinted: string;
  plainExplanationTitle: string;
  whatLabelSays: string;
  hideLabelSays: string;
  safetyDisclaimer: string;
  scanAnotherButton: string;
  machineTranslationNote: string;
  // Extracted Fields
  activeIngredients: string;
  dosageForm: string;
  manufacturer: string;
  batchNumber: string;
  manufactureDate: string;
  expiryDate: string;
  registrationNumber: string;
  directions: string;
  warnings: string;
  notVisible: string;
  nonePrinted: string;
  // Error States (One sentence, one action)
  errorBlurryMessage: string;
  errorBlurryAction: string;
  errorNotMedicineMessage: string;
  errorNotMedicineAction: string;
  errorConnectionMessage: string;
  errorConnectionAction: string;
  errorGemmaRejectionMessage: string;
  errorGemmaRejectionAction: string;
  // Footer
  poweredBy: string;
}

export const TRANSLATIONS: Record<Language, UIStrings> = {
  en: {
    appName: 'SomaLabel',
    headerTitle: 'SomaLabel',
    // Home Screen
    headline: 'Snap a medicine label.',
    subtext: "We'll explain it simply and check the expiry date.",
    scanButton: 'Scan label',
    orChoosePhoto: 'or choose a photo',
    trySampleLabel: 'Or try a sample medicine label',
    samplePackParacetamol: 'Paracetamol 500mg (Valid & Registered)',
    samplePackCoartem: 'Coartem 20/120mg (Expires soon)',
    samplePackExpired: 'Amoxicillin 250mg (Expired pack)',
    samplePackBlurry: 'Blurry photo demo',
    sampleOutcomeValid: 'Valid • Registered',
    sampleOutcomeExpSoon: 'Expires within 90 days',
    sampleOutcomeExpired: 'Expired • Not in demo list',
    sampleOutcomeBlurry: 'Unreadable error demo',
    // Loading Screen
    readingLabel: 'Reading the label...',
    checkingExpiry: 'Checking the expiry date...',
    checkingRegister: 'Checking the register...',
    // Result Screen
    medicineIdentified: 'Medicine',
    expiryChipLabel: 'Expiry',
    registrationChipLabel: 'NDA Register',
    statusExpired: 'Expired',
    statusExpiresSoon: 'Expires soon',
    statusValid: 'Valid',
    statusNotFound: 'Date not found',
    statusRegistered: 'Registered',
    statusNotInList: 'Not in demo list',
    statusNotPrinted: 'Not printed',
    plainExplanationTitle: 'Explanation',
    whatLabelSays: 'What the label says',
    hideLabelSays: 'Hide details',
    safetyDisclaimer: 'This explains what is printed on the label. Confirm with a pharmacist or health worker before use.',
    scanAnotherButton: 'Scan another label',
    machineTranslationNote: 'machine translation',
    // Extracted Fields
    activeIngredients: 'Active ingredients',
    dosageForm: 'Form',
    manufacturer: 'Manufacturer',
    batchNumber: 'Batch number',
    manufactureDate: 'Manufacture date',
    expiryDate: 'Expiry date',
    registrationNumber: 'Registration number',
    directions: 'Directions',
    warnings: 'Warnings',
    notVisible: 'Not visible',
    nonePrinted: 'None printed',
    // Error States
    errorBlurryMessage: 'This photo is too blurry to read clearly.',
    errorBlurryAction: 'Retake',
    errorNotMedicineMessage: "This doesn't look like a medicine label.",
    errorNotMedicineAction: 'Try another',
    errorConnectionMessage: "Couldn't connect. Please check your internet.",
    errorConnectionAction: 'Try again',
    errorGemmaRejectionMessage: 'Gemma model stopped: image input was rejected.',
    errorGemmaRejectionAction: 'Try again',
    // Footer
    poweredBy: 'Powered by Gemma 4 (open model)',
  },
  lug: {
    // [REVIEW NEEDED: native-speaker verification requested for all Luganda strings below]
    appName: 'SomaLabel',
    headerTitle: 'SomaLabel',
    // Home Screen
    headline: "Kuba ekifaananyi ku kaveera k'eddagala.", // [REVIEW NEEDED]
    subtext: "Tujja kulinnyonnyola mu ngeri ennyangu era tukebere n'ennaku z'okuggwako.", // [REVIEW NEEDED]
    scanButton: 'Sikanna eddagala', // [REVIEW NEEDED]
    orChoosePhoto: 'oba londa ekifaananyi mu ssimu', // [REVIEW NEEDED]
    trySampleLabel: "Oba gezaako ku bifaananyi by'eddagala eby'okulabirako", // [REVIEW NEEDED]
    samplePackParacetamol: 'Paracetamol 500mg (Likyali ggumu & Lyawandiikibwa)', // [REVIEW NEEDED]
    samplePackCoartem: 'Coartem 20/120mg (Linaatera okuggwako)', // [REVIEW NEEDED]
    samplePackExpired: 'Amoxicillin 250mg (Lyaggwako dda)', // [REVIEW NEEDED]
    samplePackBlurry: 'Ekifaananyi ekitasomeka bulungi', // [REVIEW NEEDED]
    sampleOutcomeValid: 'Likyali ggumu • Lyawandiikibwa', // [REVIEW NEEDED]
    sampleOutcomeExpSoon: 'Linaatera okuggwako mu nnaku 90', // [REVIEW NEEDED]
    sampleOutcomeExpired: 'Lyaggwako • Teriri mu lukalala', // [REVIEW NEEDED]
    sampleOutcomeBlurry: 'Tekirabika bulungi', // [REVIEW NEEDED]
    // Loading Screen
    readingLabel: 'Tusoma ebiwandiikiddwa ku ddagala...', // [REVIEW NEEDED]
    checkingExpiry: "Tukebera ennaku z'okuggwako...", // [REVIEW NEEDED]
    checkingRegister: 'Tukebera mu lukalala lwa NDA...', // [REVIEW NEEDED]
    // Result Screen
    medicineIdentified: 'Eddagala', // [REVIEW NEEDED]
    expiryChipLabel: 'Okuggwako', // [REVIEW NEEDED]
    registrationChipLabel: 'Lukalala lwa NDA', // [REVIEW NEEDED]
    statusExpired: 'Lyaggwako', // [REVIEW NEEDED]
    statusExpiresSoon: 'Linaatera okuggwako', // [REVIEW NEEDED]
    statusValid: 'Likyali ggumu', // [REVIEW NEEDED]
    statusNotFound: 'Ennaku teziriiko', // [REVIEW NEEDED]
    statusRegistered: 'Lyawandiikibwa', // [REVIEW NEEDED]
    statusNotInList: 'Teriri mu lukalala', // [REVIEW NEEDED]
    statusNotPrinted: 'Tekiwanndiikiddwa', // [REVIEW NEEDED]
    plainExplanationTitle: 'Ennyonnyola', // [REVIEW NEEDED]
    whatLabelSays: 'Ebiwandiikiddwa ku ddagala', // [REVIEW NEEDED]
    hideLabelSays: 'Kisa ebisingawo', // [REVIEW NEEDED]
    safetyDisclaimer: "Kino kinnyonnyola ebyo ebiwandiikiddwa ku ddagala lyokka. Sooka weebuuze ku musawo oba omutunzi w'eddagala nga tonnalikozesa.", // [REVIEW NEEDED]
    scanAnotherButton: 'Sikanna eddagala eddala', // [REVIEW NEEDED]
    machineTranslationNote: "envvuunula ey'ebyuma", // [REVIEW NEEDED]
    // Extracted Fields
    activeIngredients: 'Ebirungo ebikola', // [REVIEW NEEDED]
    dosageForm: 'Engeri gye lirimu', // [REVIEW NEEDED]
    manufacturer: 'Abakola eddagala', // [REVIEW NEEDED]
    batchNumber: "Ennamba y'omuzingo", // [REVIEW NEEDED]
    manufactureDate: 'Lwe lyakolebwa', // [REVIEW NEEDED]
    expiryDate: 'Lwe liggwako', // [REVIEW NEEDED]
    registrationNumber: 'Ennamba ya NDA', // [REVIEW NEEDED]
    directions: 'Endagiriro', // [REVIEW NEEDED]
    warnings: 'Okulabula', // [REVIEW NEEDED]
    notVisible: 'Tewalabika', // [REVIEW NEEDED]
    nonePrinted: 'Tewali kiwandiikiddwa', // [REVIEW NEEDED]
    // Error States
    errorBlurryMessage: 'Ekifaananyi kino tekirabika bulungi okusobola okusoma.', // [REVIEW NEEDED]
    errorBlurryAction: 'Kuba ekirala', // [REVIEW NEEDED]
    errorNotMedicineMessage: "Kino tekifaanana ng'ekipande ky'eddagala.", // [REVIEW NEEDED]
    errorNotMedicineAction: 'Gezaako ekirala', // [REVIEW NEEDED]
    errorConnectionMessage: 'Tewali mikutu gya yintaneeti. Ddamu ogezeeko.', // [REVIEW NEEDED]
    errorConnectionAction: 'Ddamu ogezeeko', // [REVIEW NEEDED]
    errorGemmaRejectionMessage: 'Gemma eyimiridde: ekifaananyi tekikkiriziddwa.', // [REVIEW NEEDED]
    errorGemmaRejectionAction: 'Ddamu ogezeeko', // [REVIEW NEEDED]
    // Footer
    poweredBy: 'Powered by Gemma 4 (open model)',
  },
};
