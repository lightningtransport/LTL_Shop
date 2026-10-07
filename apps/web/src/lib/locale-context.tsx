'use client';

import * as React from 'react';
import { BlockerReason, PauseReason } from '@ltl-shop/shared';
import { API_ERROR_COPY, type ApiErrorCopy } from './api-error-copy';
import {
  parseShopLocale,
  shopLocaleChangeEvent,
  shopLocaleCookieWrite,
  shopLocaleFromCookieHeader,
  type ShopLocale,
} from './shop-locale';

export type { ShopLocale } from './shop-locale';
export { SHOP_LOCALE_COOKIE, parseShopLocale, shopLocaleCookieWrite } from './shop-locale';

type Copy = {
  locale: ShopLocale;
  language: string;
  switchTo: string;
  home: string;
  backToHome: string;
  retry: string;
  /** LTR-170: the route error screen (app/error.tsx). */
  errorScreenTitle: string;
  errorScreenSubtitle: string;
  errorScreenRetryMessage: string;
  errorScreenRetry: string;
  signIn: string;
  signInHint: string;
  email: string;
  password: string;
  resetPassword: string;
  devLogin: string;
  newWorkOrder: string;
  newPmService: string;
  workOrder: string;
  workOrderHint: string;
  pmServiceHint: string;
  truck: string;
  searchTruck: string;
  noTrucks: string;
  truckOpenWorkOrder: (displayId: string) => string;
  checkingOpenWorkOrder: string;
  retryWorkOrderCheck: string;
  truckInformation: string;
  selectTruck: string;
  vin: string;
  lastReportedLocation: string;
  locationUpdatedOn: string;
  repairHistory: string;
  openWorkOrder: string;
  /** Block A (A12, MG6): a Work Order that does not load. */
  noJobsHereAnymore: string;
  workOrderGone: string;
  backToMyWork: string;
  chooseAnotherWorkOrder: string;
  workOrderOpen: (truckNumber: string) => string;
  workOrderSummary: (displayId: string, status: string, completed: number, total: number) => string;
  truckResults: (count: number) => string;
  activeJobs: (count: number) => string;
  pausedJobs: (count: number) => string;
  activePmServices: (count: number) => string;
  pausedPmServices: (count: number) => string;
  noActiveJobs: string;
  noPausedJobs: string;
  noPausedPmServices: string;
  activeJobsTitle: string;
  pausedJobsTitle: string;
  pmActiveTitle: string;
  pmPausedTitle: string;
  notes: string;
  saveNotes: string;
  notesOptional: string;
  notesPlaceholder: string;
  unableToSaveNotes: string;
  priorityLabel: string;
  pauseReasonLabel: string;
  selectOption: string;
  reasonRequiredForOther: string;
  /** Block A (MG8): the blocker note is always offered; required only with "Other". */
  blockerNoteOptionalLabel: string;
  blockerNoteRequiredLabel: string;
  blockerReportPlaceholder: string;
  blockerNoteRequired: string;
  additionalDetails: string;
  unableToSavePmDetails: string;
  waitingOnManager: string;
  waitingOnManagerHint: (count: number) => string;
  waitingOnManagerBody: string;
  workOptions: string;
  assignedToYou: string;
  assignedTo: (name: string) => string;
  completedByYou: string;
  completedBy: (name: string) => string;
  jobUnassigned: string;
  jobStatusPending: string;
  jobStatusInProgress: string;
  jobStatusBlocked: string;
  woStatusPaused: string;
  inspectionStep: string;
  myJobs: string;
  otherWorkOnThisTruck: string;
  noMyJobs: string;
  tapJobToComplete: string;
  completeJobFor: (name: string) => string;
  finishedYourPart: (truckNumber: string) => string;
  finishedYourPartHint: string;
  continueWork: string;
  yourJobsCount: (count: number) => string;
  nextJob: string;
  resolvedTapContinue: string;
  resolvedBlockerTitle: (job: string, name: string) => string;
  managerNote: (note: string) => string;
  resolvedBlockerHint: string;
  /** LTR-186 / D20: the day close stopped my clock here. */
  dayCloseTapContinue: string;
  /** LTR-186 / D21: my clock runs on another Truck now. */
  clockOnTruckTapContinue: (truckNumber: string) => string;
  clockSwitchedTapContinue: string;
  otherWorkReadOnly: string;
  /** LTR-188 / D23: appended to a helper Job's name. */
  helperJobSuffix: string;
  /** LTR-188 / D24: a Job at an external shop (read-only, never the mechanic's). */
  jobAtExternalShop: string;
  createWorkOrder: string;
  searchJobsLabel: string;
  categoryJobsLabel: string;
  noJobsInCategory: string;
  noMatchingCategoryJobs: string;
  loadingJobs: string;
  loadError: string;
  customJobPlaceholder: string;
  addCustomJob: string;
  addCatalogJob: string;
  checkingTruck: string;
  chooseCategory: string;
  addJobToContinue: string;
  askManagerToCreate: string;
  askManagerToCreateHint: string;
  additionalWorkHint: string;
  jobFinishNotes: string;
  jobFinishNotesPlaceholder: string;
  pausedAskManager: string;
  createPmService: string;
  viewCompletedWork: (count: number) => string;
  workspaceUnavailable: string;
  openAllowedHome: string;
  startWork: string;
  startingWork: string;
  workStartedSuccess: string;
  /** Block A (MG2): Start on this Truck closed my clock on another one (D21). */
  clockMovedFromTo: (fromTruck: string, toTruck: string) => string;
  /** Stage MG-2 (MG1, UX-6-007): the clock strip and the single offline notice. */
  clockStripYourClock: string;
  /** Stage MG-3: the General mechanic's home. */
  noJobsAssignedYet: string;
  /** Stage MG-4/5: the General mechanic's Truck screen and its sheets. */
  yourJobsDoneCount: (done: number, total: number) => string;
  yourTimeLabel: string;
  laborStoppedLabel: string;
  blockerSinceBy: (since: string, who: string) => string;
  addNoteOpen: string;
  noteForManager: string;
  waitingOnManagerShort: string;
  /** Stage MG-6: Trucks and Completed. */
  unableToLoadTrucks: string;
  completedToday: string;
  completedYesterday: string;
  completedEarlier: string;
  noClosingNote: string;
  addANoteLabel: string;
  notesKeptHint: string;
  requestWorkTitle: string;
  requestWorkSheetHint: string;
  requestWorkSend: string;
  requestWorkRequired: string;
  completeJobTitle: (name: string) => string;
  completeLastHint: string;
  completeKeepsRunning: string;
  blockerSheetHint: string;
  noJobsAssignedHint: string;
  mostUrgentFirst: string;
  blockedSectionTitle: string;
  blockedSectionHint: string;
  blockedSince: (when: string) => string;
  yourPartDone: (jobs: string) => string;
  clockRunning: string;
  viewShort: string;
  clockStripSince: (time: string) => string;
  clockStripOpen: string;
  clockStripStopped: string;
  offlineNotSent: string;
  reportBlocker: string;
  activeBlockers: string;
  blockerWaitsForManager: string;
  addBlockerNote: string;
  blockerNotePlaceholder: string;
  blockerNoteAdded: string;
  blockedWithReason: (reason: string) => string;
  reportBlockerFor: (jobName: string) => string;
  noteThreadEmpty: string;
  notePlaceholder: string;
  addNote: string;
  requestWork: string;
  noteAddedSuccess: string;
  workRequestSentSuccess: string;
  workRequestLabel: string;
  workRequestPending: string;
  workRequestHandledBy: (name: string) => string;
  notesClosed: string;
  requestWorkHint: string;
  reportingBlocker: string;
  /** LTR-169: why Report blocker is disabled. */
  blockerReasonRequiredHint: string;
  blockerReportedSuccess: string;
  blockerReason: string;
  jobFinishTitle: string;
  jobFinishConfirm: string;
  completingJob: string;
  jobFinishedSuccess: string;
  jobFinishedWithNoteSuccess: string;
  dismissNotice: string;
  closeDialog: string;
  pauseWorkOrder: string;
  pauseUnavailableUntilInProgress: string;
  workOrderAction: (action: string, displayId: string, truckNumber: string) => string;
  pmServiceLoadError: string;
  loadingPmService: string;
  currentTruckMileage: string;
  lastCompletedPm: string;
  truckMileageToday: string;
  previousPm: string;
  mileageAtThisPm: string;
  pmCompletedOn: (date: string) => string;
  noPartsRecorded: string;
  noPriorPm: string;
  mileageNotRecorded: string;
  observedMileage: string;
  enterMileageHint: string;
  mileageBelowCurrent: (current: string) => string;
  mileageJumpWarning: (current: string) => string;
  confirmMileage: string;
  partsUsed: string;
  noPartUsed: string;
  noCompatibleParts: string;
  saving: string;
  saved: string;
  autosaved: string;
  restoringSession: string;
  /** The animated loader shown before the sign-in screen. */
  appLoading: string;
  loadingWorkOrders: string;
  loadingWorkOrder: string;
  retryWorkOrder: string;
  unableToLoadProfile: string;
  unableToLoadWorkOrders: string;
  homeSubtitle: string;
  pmHomeTitle: string;
  standardHomeTitle: string;
  pmHomeSubtitle: string;
  standardHomeSubtitle: string;
  readyToStart: string;
  ordersReadyToStart: (count: number) => string;
  noActivePmServices: string;
  pmServicesStartImmediately: string;
  viewDetails: string;
  resumeWork: string;
  viewWork: string;
  finishWork: string;
  continuePmService: string;
  pmStartedAt: (time: string) => string;
  pmAlreadyRunning: (displayId: string) => string;
  /** Block A (PM5): where the PM in progress is, with a way back to it. */
  pmInProgressOn: (truckNumber: string, displayId: string) => string;
  continuePmOn: (truckNumber: string) => string;
  /** Block A (PM2, PM3): why the parts are not saved yet. */
  confirmMileageFirst: string;
  enterMileageToSave: string;
  /** Block A (PM1): the draft stays on the phone until the Shop has it. */
  pmNotSaved: string;
  pmKeptOnPhone: string;
  pmServiceTypeLabel: string;
  pmJoinAdd: (displayId: string) => string;
  pmJoinJoin: (displayId: string) => string;
  pmJoinMine: (displayId: string) => string;
  pmJoinTaken: (displayId: string, name: string) => string;
  pmJoinDone: (displayId: string) => string;
  joinPmService: string;
  finishingWork: string;
  pmFinishedSuccess: string;
  viewCompletedWorkAction: string;
  jobsDone: (completed: number, total: number) => string;
  truckTitle: (truckNumber: string) => string;
  navMyWork: string;
  navTrucks: string;
  navCompleted: string;
  mechanicNavLabel: string;
  mechanicTrucksTitle: string;
  mechanicTrucksSubtitle: string;
  mechanicCompletedTitle: string;
  mechanicCompletedSubtitle: string;
  noCompletedWork: string;
  backToTrucks: string;
  startPmService: string;
  pmServiceStartedSuccess: string;
  pmJobFinishedHint: string;
  pmJobFinishRequirement: string;
  pmJobNotStartedHint: string;
  pmJobOnWorkOrder: (job: string, workOrder: string) => string;
  startWorkToCompleteJobs: string;
  continueToCompleteJobs: string;
  laborTime: (duration: string) => string;
  laborRunningLabel: string;
  pmServiceLabel: string;
  noPendingJobs: string;
  noCompletedJobs: string;
  cancelAction: string;
  multiSelectDone: string;
  backToShopAdmin: string;
  workspaceStandard: string;
  workspacePm: string;
  shopWorkspaces: string;
  priority: Record<string, string>;
  jobStatus: Record<string, string>;
  status: Record<string, string>;
  pauseReason: Record<PauseReason | BlockerReason.QUALITY_CHECK_FAILED, string>;
  /** LTR-181: profile menu (language, theme, sign out) and the Home header. */
  theme: string;
  themeLight: string;
  themeDark: string;
  themeAuto: string;
  signOut: string;
  signingOut: string;
  signOutFailed: string;
  openProfileFor: (name: string) => string;
  closeProfile: string;
  homeControls: string;
  /** LTR-181: app/forbidden.tsx. */
  forbiddenTitle: string;
  forbiddenBody: string;
  forbiddenBack: string;
  /** LTR-181: login and password recovery. */
  signInFailed: string;
  accountNotConfigured: string;
  resetEmailFailed: string;
  resetEmailSent: string;
  useAnotherAccount: string;
  verifyingRecoveryLink: string;
  passwordUpdatedTitle: string;
  passwordUpdatedSubtitle: string;
  passwordUpdatedBody: string;
  backToSignIn: string;
  recoveryLinkUnavailableTitle: string;
  recoveryLinkUnavailableSubtitle: string;
  setNewPasswordTitle: string;
  setNewPasswordSubtitle: string;
  /** LTR-181: session restore and Supabase Auth failures (auth-context). */
  secureSessionFailed: string;
  profileRestoreFailed: string;
  sessionRestoreFailed: string;
  sessionRestoreTimedOut: string;
  authInvalidCredentials: string;
  authEmailNotConfirmed: string;
  authRateLimited: string;
  authWeakPassword: string;
  authSamePassword: string;
  /** LTR-181: repair history (trucks/[id]/history). */
  backToNewWorkOrder: string;
  backToWorkOrder: string;
  loadingRepairHistory: string;
  repairHistoryTitle: string;
  filterRepairHistory: string;
  allCategoriesChip: string;
  noRepairHistory: string;
  mechanicLabel: string;
  mileageLabel: string;
  workPerformed: string;
  noWorkDetails: string;
  /** LTR-181: New Work Order and generic action failures. */
  openWorkOrderCheckFailed: string;
  selectTruckForPm: string;
  truckContainsMatchesNote: string;
  loadingWorkOrderForm: string;
  createFailed: string;
  actionFailed: string;
  referenceDataLoadError: string;
  /** LTR-181: app/access-denied. */
  accessDeniedTitle: string;
  accessDeniedSubtitle: string;
  accessDeniedBody: string;
  pmFinishUpdatesMileage: (from: string, to: string) => string;
  pmFinishCompletes: string;
  relativeMinutesAgo: (minutes: number) => string;
  relativeHoursAgo: (hours: number) => string;
  relativeDaysAgo: (days: number) => string;
  /** LTR-181: API error codes, shared with the Admin catalog (api-error-copy.ts). */
  apiError: ApiErrorCopy;
  /** LTR-185 / D19: the Safety workspace. */
  qc: {
    title: string;
    subtitle: string;
    navLabel: string;
    tabReview: string;
    tabReturned: string;
    tabDone: string;
    toReview: (count: number, mine: number) => string;
    empty: string;
    emptyHint: string;
    readySince: (when: string) => string;
    leaves: (when: string) => string;
    yours: string;
    takenBy: (name: string) => string;
    reviewing: (name: string) => string;
    take: string;
    takeThisTruck: string;
    continueReview: string;
    approve: string;
    returnTruck: string;
    more: string;
    letGo: string;
    letGoToast: (truckNumber: string) => string;
    reviewTitle: (truckNumber: string) => string;
    reviewLoadError: string;
    truckSection: string;
    vehicle: string;
    mileage: string;
    vin: string;
    where: string;
    notReported: string;
    whatWasDone: string;
    pmLine: (mileage: string, parts: number) => string;
    inspectionSection: string;
    inspection: Record<'issues_found' | 'no_issues_found' | 'not_recorded', string>;
    blockersSection: string;
    resolvedBy: (who: string, when: string) => string;
    returnedBefore: string;
    returnedByOn: (who: string, when: string) => string;
    approveTitle: (truckNumber: string) => string;
    approveHint: (displayId: string) => string;
    back: string;
    returnTitle: (truckNumber: string) => string;
    returnHint: string;
    whichJob: string;
    optional: string;
    otherJob: string;
    returnNoteLabel: string;
    returnPlaceholder: string;
    returnNoteRequired: string;
    returnConfirm: string;
    returnedTitle: string;
    returnedHint: string;
    noneReturned: string;
    waitingForManager: string;
    doneTitle: string;
    doneHint: string;
    doneToday: string;
    doneEarlier: string;
    approvedLabel: string;
    returnedLabel: string;
    noneDone: string;
    approved: (truckNumber: string) => string;
    returnedToast: (truckNumber: string) => string;
    takenToast: (truckNumber: string) => string;
    loadError: string;
    loadErrorHint: string;
  };
};

const copy: Record<ShopLocale, Copy> = {
  en: {
    locale: 'en', language: 'Language', switchTo: 'Switch to Spanish', home: 'Home',
    backToHome: 'Back to Home', retry: 'Try again', signIn: 'Sign in',
    errorScreenTitle: 'Something went wrong',
    errorScreenSubtitle: 'This screen could not be loaded. Your saved work has not been changed.',
    errorScreenRetryMessage: 'Try loading this screen again.',
    errorScreenRetry: 'Retry screen',
    signInHint: 'Sign in with the email linked to the Shop.', email: 'Email', password: 'Password',
    resetPassword: 'Reset password', devLogin: 'Dev login (local bypass)',
    newWorkOrder: 'New Work Order', newPmService: 'New PM service',
    workOrder: 'Work Order',
    workOrderHint: 'Enter the required information. Creating saves the order; Start Work begins labor.',
    pmServiceHint: 'Select a truck to create a PM service.', truck: 'Truck',
    searchTruck: 'Truck number, e.g. 905', noTrucks: 'No trucks found.', truckOpenWorkOrder: (displayId) => `Open ${displayId}`,
    checkingOpenWorkOrder: 'Checking for an open Work Order.', retryWorkOrderCheck: 'Retry Work Order check',
    truckInformation: 'Truck Information', selectTruck: 'Select a truck to show its details.',
    vin: 'VIN', lastReportedLocation: 'Last reported location', locationUpdatedOn: 'Last reported on',
    repairHistory: 'View truck repair history', openWorkOrder: 'View open Work Order',
    noJobsHereAnymore: 'You have no Jobs on this Work Order anymore. The Manager may have reassigned or cancelled them.',
    workOrderGone: 'This Work Order no longer exists.',
    backToMyWork: 'Back to My work',
    chooseAnotherWorkOrder: 'Choose another Work Order',
    workOrderOpen: (truckNumber) => `Truck #${truckNumber} already has an open Work Order.`,
    workOrderSummary: (displayId, status, completed, total) => `${displayId} · ${status} · ${completed} of ${total} jobs completed`,
    truckResults: (count) => `${count} ${count === 1 ? 'truck result' : 'truck results'} available.`,
    activeJobs: (count) => `${count} ${count === 1 ? 'Work Order' : 'Work Orders'} in progress`,
    pausedJobs: (count) => `${count} paused ${count === 1 ? 'Work Order' : 'Work Orders'}`,
    activePmServices: (count) => `${count} ${count === 1 ? 'active PM service' : 'active PM services'}`,
    pausedPmServices: (count) => `${count} ${count === 1 ? 'paused PM service' : 'paused PM services'}`,
    noActiveJobs: 'No assigned work in progress.',
    noPausedJobs: 'No paused Work Orders. Paused work will appear here until it is resumed.',
    noPausedPmServices: 'No paused PM services. Paused work will appear here until it is resumed.',
    activeJobsTitle: 'In Progress',
    pausedJobsTitle: 'Paused by the Manager',
    pmActiveTitle: 'Active PM services',
    pmPausedTitle: 'Paused PM services',
    notes: 'Notes',
    saveNotes: 'Save Notes',
    notesOptional: 'Notes (optional)',
    notesPlaceholder: 'Describe or add any information needed to perform the work',
    unableToSaveNotes: 'Unable to save notes.',
    priorityLabel: 'Priority',
    pauseReasonLabel: 'Pause reason',
    selectOption: 'Select an option',
    reasonRequiredForOther: 'Reason required for Other',
    blockerNoteOptionalLabel: 'What is missing? (optional)',
    blockerNoteRequiredLabel: 'What is stopping you?',
    blockerReportPlaceholder: 'E.g. the part number or the tool you need',
    blockerNoteRequired: 'Say what is stopping you.',
    additionalDetails: 'Additional details',
    unableToSavePmDetails: 'Unable to save PM service details.',
    waitingOnManager: 'Waiting on Manager',
    // G7: other mechanics may still have steps open (PM, Quality Check), so the Manager closes it only when every step is done.
    waitingOnManagerHint: (count) => `You finished your part on ${count} ${count === 1 ? 'Work Order' : 'Work Orders'}. The Manager closes ${count === 1 ? 'it' : 'each one'} when every step is done.`,
    waitingOnManagerBody: 'Your Jobs are done. Your Shop Manager closes this Work Order when every step is done. You can still report a blocker if something is stopping the Truck.',
    assignedToYou: 'Assigned to you',
    assignedTo: (name) => `Assigned to ${name}`,
    completedByYou: 'Completed by you',
    completedBy: (name) => `Completed by ${name}`,
    jobUnassigned: 'Unassigned',
    jobStatusPending: 'Pending',
    jobStatusInProgress: 'In progress',
    jobStatusBlocked: 'Blocked',
    woStatusPaused: 'Paused',
    inspectionStep: 'Inspection',
    myJobs: 'Your Jobs',
    otherWorkOnThisTruck: 'Other work on this Truck',
    noMyJobs: 'No jobs assigned to you.',
    tapJobToComplete: 'When a Job is done, tap Complete job.',
    completeJobFor: (name) => `Complete job: ${name}`,
    finishedYourPart: (truckNumber) => `You finished your part on Truck ${truckNumber}.`,
    finishedYourPartHint: 'Your time stopped. If the Manager gives you another Job here, tap Continue.',
    continueWork: 'Continue',
    yourJobsCount: (count) => `${count} ${count === 1 ? 'Job' : 'Jobs'} for you`,
    nextJob: 'Next',
    resolvedTapContinue: 'Resolved · tap Continue',
    resolvedBlockerTitle: (job, name) => [job, `Resolved by ${name}`].filter(Boolean).join(' · '),
    managerNote: (note) => `Manager note: ${note}`,
    resolvedBlockerHint: 'Tap Continue to keep working.',
    dayCloseTapContinue: 'Yesterday\'s work is still open · tap Continue',
    clockOnTruckTapContinue: (truckNumber) => `Your clock is on Truck ${truckNumber} · tap Continue`,
    // Block A (MG3): with no clock open anywhere, "moved to another Truck" was not true.
    clockSwitchedTapContinue: 'Your clock is stopped · tap Continue',
    otherWorkReadOnly: 'Other mechanics do this work. You can see it, not change it.',
    helperJobSuffix: ' · helper',
    jobAtExternalShop: 'At external shop',
    createWorkOrder: 'Create new Work Order',
    searchJobsLabel: 'Search jobs in this category',
    categoryJobsLabel: 'Jobs in this Category',
    noJobsInCategory: 'No Jobs are listed for this Category.',
    noMatchingCategoryJobs: 'No Jobs match this search.',
    loadingJobs: 'Loading jobs…',
    loadError: 'Unable to load this screen.',
    customJobPlaceholder: 'Custom job name',
    addCustomJob: 'Add custom job',
    addCatalogJob: 'Add',
    checkingTruck: 'Checking truck…',
    chooseCategory: 'Choose a category',
    addJobToContinue: 'Add a job to continue',
    askManagerToCreate: 'Ask your Shop Manager to create a Work Order.',
    askManagerToCreateHint: 'Managers plan Standard work. Your Home lists Work Orders assigned to you.',
    workOptions: 'Work Options',
    additionalWorkHint: 'Need additional work on this Truck? Use Request Work in Notes so your Manager can add the Job.',
    jobFinishNotes: 'Completion note',
    jobFinishNotesPlaceholder: 'What did you do? The Manager will see this.',
    pausedAskManager: 'This Work Order is paused. Your Shop Manager will resume it.',
    createPmService: 'Create PM service',
    viewCompletedWork: (count) => `View completed work (${count})`,
    workspaceUnavailable: 'This mechanic workspace is not available for your account.',
    openAllowedHome: 'Go to your Shop home',
    startWork: 'Start Work',
    startingWork: 'Starting…',
    workStartedSuccess: 'Work started.',
    clockMovedFromTo: (fromTruck, toTruck) => `Work started. Your clock moved from Truck ${fromTruck} to Truck ${toTruck}.`,
    clockStripYourClock: 'Your clock',
    noJobsAssignedYet: 'No Jobs assigned yet',
    yourJobsDoneCount: (done, total) => `${done} of ${total} done`,
    yourTimeLabel: 'Your time',
    laborStoppedLabel: 'stopped',
    blockerSinceBy: (since, who) => `Since ${since} · reported by ${who}. Only the Manager resolves it.`,
    addNoteOpen: 'Add note',
    noteForManager: 'Note for the Manager',
    waitingOnManagerShort: 'waiting on the Manager',
    unableToLoadTrucks: 'Unable to load trucks.',
    completedToday: 'Today',
    completedYesterday: 'Yesterday',
    completedEarlier: 'Earlier',
    noClosingNote: 'No closing note',
    addANoteLabel: 'Add a note',
    notesKeptHint: "Kept on this phone until you send it. Notes can't be edited.",
    requestWorkTitle: 'What does the Truck need?',
    requestWorkSheetHint: "It goes to the Manager's Dashboard. The Manager decides whether to add a Job and who does it.",
    requestWorkSend: 'Send to Manager',
    requestWorkRequired: 'Say what the Truck needs.',
    completeJobTitle: (name) => `Complete ${name}?`,
    completeLastHint: 'This is your last Job here: your clock stops.',
    completeKeepsRunning: 'Your clock keeps running.',
    blockerSheetHint: "The Manager is told and resolves it. You can't complete this Job until then.",
    noJobsAssignedHint: 'When the Manager gives you a Job, it shows up here.',
    mostUrgentFirst: 'Most urgent first.',
    blockedSectionTitle: 'Blocked · waiting on the Manager',
    blockedSectionHint: 'Only the Manager resolves a blocker. Open the Truck to add a note.',
    blockedSince: (when) => `Since ${when}`,
    yourPartDone: (jobs) => `Your part is done · ${jobs}`,
    clockRunning: 'Clock running',
    viewShort: 'View',
    clockStripSince: (time) => `since ${time}`,
    clockStripOpen: 'Open',
    clockStripStopped: 'Your clock is stopped · tap Continue on a Truck',
    offlineNotSent: 'Offline · your changes are not sent',
    reportBlocker: 'Report Blocker',
    activeBlockers: 'Active blockers',
    blockerWaitsForManager: 'Only the Manager resolves a blocker. Add a note if something changes.',
    addBlockerNote: 'Add note to blocker',
    blockerNotePlaceholder: 'For example: the part arrived.',
    blockerNoteAdded: 'Note added to the blocker.',
    blockedWithReason: (reason) => `Blocked · ${reason}`,
    reportBlockerFor: (jobName) => `Report blocker: ${jobName}`,
    noteThreadEmpty: 'No notes yet.',
    notePlaceholder: 'Write a note: something the shop should know',
    addNote: 'Add Note',
    requestWork: 'Request Work',
    noteAddedSuccess: 'Note added.',
    workRequestSentSuccess: 'Work request sent to your Manager.',
    workRequestLabel: 'Work request',
    workRequestPending: 'Waiting for Manager',
    workRequestHandledBy: (name) => `Handled by ${name}`,
    notesClosed: 'This Work Order is closed. Notes are read-only.',
    requestWorkHint: 'Request Work goes to your Manager, who can add it as a Job. Notes are never overwritten.',
    reportingBlocker: 'Reporting…',
    blockerReasonRequiredHint: 'Choose a reason to report the blocker.',
    blockerReportedSuccess: 'Blocker reported. The Manager will resolve it.',
    blockerReason: 'Blocker reason',
    jobFinishTitle: 'Complete job',
    jobFinishConfirm: 'Complete job',
    completingJob: 'Completing…',
    jobFinishedSuccess: 'Job marked complete.',
    jobFinishedWithNoteSuccess: 'Job marked complete. Your note is saved.',
    dismissNotice: 'Dismiss',
    closeDialog: 'Close',
    pauseWorkOrder: 'Pause Work Order',
    pauseUnavailableUntilInProgress: 'Pause is available after this Work Order is In Progress.',
    workOrderAction: (action, displayId, truckNumber) => `${action} truck ${truckNumber}, Work Order ${displayId}`,
    pmServiceLoadError: 'Unable to load PM service details.',
    loadingPmService: 'Loading PM service details…',
    currentTruckMileage: 'Current truck mileage',
    lastCompletedPm: 'Last completed PM',
    truckMileageToday: 'Truck mileage today',
    previousPm: 'Previous PM',
    mileageAtThisPm: 'Mileage recorded at this PM',
    pmCompletedOn: (date) => `PM completed ${date}`,
    noPartsRecorded: 'No parts recorded.',
    noPriorPm: 'No prior PM recorded',
    mileageNotRecorded: 'Mileage not recorded',
    observedMileage: 'Observed mileage',
    enterMileageHint: 'Enter the observed mileage to record parts used.',
    mileageBelowCurrent: (current) => `Observed mileage cannot be lower than the truck's current mileage (${current}). Check the odometer.`,
    mileageJumpWarning: (current) => `This is more than 50,000 mi above the truck's current mileage (${current}). Confirm the odometer reading.`,
    confirmMileage: 'Confirm mileage',
    partsUsed: 'Parts used',
    noPartUsed: 'No part used',
    noCompatibleParts: 'No compatible parts for this truck',
    saving: 'Saving…',
    saved: 'Saved',
    autosaved: 'Saved automatically',
    restoringSession: 'Restoring session',
    appLoading: 'Loading Lightning Shop…',
    loadingWorkOrders: 'Loading work orders',
    loadingWorkOrder: 'Loading work order',
    retryWorkOrder: 'Retry work order',
    unableToLoadProfile: 'Unable to load your profile.',
    unableToLoadWorkOrders: 'Unable to load work orders',
    homeSubtitle: 'Current jobs, work orders, and recent work.',
    pmHomeTitle: 'PM Mechanic',
    standardHomeTitle: 'My Assigned Work',
    pmHomeSubtitle: 'PM services assigned to you.',
    standardHomeSubtitle: 'Work Orders and Jobs the Manager assigned to you.',
    readyToStart: 'Ready to Start',
    ordersReadyToStart: (count) => `${count} ${count === 1 ? 'order' : 'orders'} ready to Start Work`,
    noActivePmServices: 'No active PM services assigned to you.',
    pmServicesStartImmediately: 'PM services start immediately after creation.',
    viewDetails: 'View Details',
    resumeWork: 'Resume Work',
    viewWork: 'View Work',
    finishWork: 'Finish Work',
    continuePmService: 'Continue PM service',
    pmStartedAt: (time) => `Started ${time}`,
    pmAlreadyRunning: (displayId) => `Finish ${displayId} before starting another PM service.`,
    pmInProgressOn: (truckNumber, displayId) => `You have a PM service in progress on Truck ${truckNumber} (${displayId}). Finish it before starting another.`,
    continuePmOn: (truckNumber) => `Continue PM on Truck ${truckNumber}`,
    confirmMileageFirst: 'Confirm the mileage above to save parts.',
    enterMileageToSave: 'Enter the mileage. The last saved mileage stays until then.',
    pmNotSaved: 'Not saved',
    pmKeptOnPhone: 'Not sent yet. What you entered stays on this phone and is sent when the connection is back.',
    pmServiceTypeLabel: 'Service type',
    pmJoinAdd: (displayId) => `This truck already has Work Order ${displayId}. Your PM service will be added to it.`,
    pmJoinJoin: (displayId) => `This truck already has Work Order ${displayId} with a PM job. You will take and start it.`,
    pmJoinMine: (displayId) => `You already started the PM on Work Order ${displayId}.`,
    pmJoinTaken: (displayId, name) => `The PM of Work Order ${displayId} is assigned to ${name}. Ask your Shop Manager if it should be yours.`,
    pmJoinDone: (displayId) => `The PM of Work Order ${displayId} is already done.`,
    joinPmService: 'Start PM on this Work Order',
    finishingWork: 'Finishing…',
    pmFinishedSuccess: 'PM service completed.',
    viewCompletedWorkAction: 'View completed work',
    jobsDone: (completed, total) => `${completed} of ${total} jobs done`,
    truckTitle: (truckNumber) => `Truck ${truckNumber}`,
    navMyWork: 'My work',
    navTrucks: 'Trucks',
    navCompleted: 'Completed',
    mechanicNavLabel: 'Mechanic workspace',
    mechanicTrucksTitle: 'Find a Truck',
    mechanicTrucksSubtitle: 'Search by Truck number to see its repair history.',
    mechanicCompletedTitle: 'Completed work',
    mechanicCompletedSubtitle: 'Jobs you completed, newest Work Order first.',
    noCompletedWork: 'No completed work yet.',
    backToTrucks: 'Back to Trucks',
    startPmService: 'Start PM service',
    pmServiceStartedSuccess: 'PM service started.',
    pmJobFinishedHint: 'This PM service is finished. The Shop Manager closes the Work Order.',
    pmJobFinishRequirement: 'Finish requires a saved observed mileage and at least one part.',
    pmJobNotStartedHint: 'Start the PM service to record the observed mileage and parts.',
    pmJobOnWorkOrder: (job, workOrder) => `${job} · Work Order ${workOrder}`,
    startWorkToCompleteJobs: 'Press Start Work to be able to complete Jobs.',
    continueToCompleteJobs: 'Press Continue to be able to complete Jobs.',
    laborTime: (duration) => `Labor time: ${duration}`,
    laborRunningLabel: 'running',
    pmServiceLabel: 'PM Service',
    noPendingJobs: 'No pending jobs',
    noCompletedJobs: 'No completed jobs',
    cancelAction: 'Cancel',
    multiSelectDone: 'Done',
    backToShopAdmin: 'Back to Shop Admin',
    workspaceStandard: 'Standard',
    workspacePm: 'PM',
    shopWorkspaces: 'Shop workspaces',
    priority: { low: 'Low', normal: 'Normal', high: 'High', critical: 'Critical' },
    jobStatus: { to_do: 'To do', completed: 'Completed', cancelled: 'Cancelled' },
    status: { created: 'Created', in_progress: 'In Progress', waiting_paused: 'Paused', completed: 'Completed', cancelled: 'Cancelled' },
    pauseReason: {
      [PauseReason.WAITING_FOR_PARTS]: 'Waiting for Parts',
      [PauseReason.WAITING_FOR_APPROVAL]: 'Waiting for Approval',
      [PauseReason.WAITING_FOR_VENDOR]: 'Waiting for Vendor',
      [PauseReason.WAITING_FOR_EQUIPMENT]: 'Waiting for Equipment / Tool',
      [PauseReason.WAITING_FOR_BAY]: 'Waiting for Bay',
      [PauseReason.WAITING_FOR_DRIVER]: 'Waiting for Driver',
      [PauseReason.TRUCK_UNAVAILABLE]: 'Truck Unavailable',
      [PauseReason.WORKING_ON_ANOTHER_WO]: 'Working on Another Work Order',
      [PauseReason.BREAK]: 'Break',
      [PauseReason.END_OF_SHIFT]: 'End of Shift',
      [PauseReason.OTHER]: 'Other',
      [BlockerReason.QUALITY_CHECK_FAILED]: 'Returned by Safety',
    },
    theme: 'Theme',
    themeLight: 'Light',
    themeDark: 'Dark',
    themeAuto: 'Auto',
    signOut: 'Sign out',
    signingOut: 'Signing out…',
    signOutFailed: 'Unable to sign out.',
    openProfileFor: (name) => `Open profile for ${name}`,
    closeProfile: 'Close profile',
    homeControls: 'Home controls',
    forbiddenTitle: 'Shop Admin access denied',
    forbiddenBody: 'Your account does not have permission to open the administrative workspace.',
    // "/" sends each person to their own home (mechanic, PM or Safety's /qc), so the link does not name one.
    forbiddenBack: 'Return to your Home',
    signInFailed: 'Sign in failed.',
    accountNotConfigured: 'Your account is not configured for the Shop application.',
    resetEmailFailed: 'Unable to send a reset email.',
    resetEmailSent: 'If this email has an account, a password-reset link has been sent.',
    useAnotherAccount: 'Use another account',
    verifyingRecoveryLink: 'Verifying recovery link',
    passwordUpdatedTitle: 'Password updated',
    passwordUpdatedSubtitle: 'Sign in with your new password.',
    passwordUpdatedBody: 'Your password has been changed successfully.',
    backToSignIn: 'Back to sign in',
    recoveryLinkUnavailableTitle: 'Recovery link unavailable',
    recoveryLinkUnavailableSubtitle: 'Request a new password-reset email and try again.',
    setNewPasswordTitle: 'Set new password',
    setNewPasswordSubtitle: 'Choose a new password for your Shop account.',
    secureSessionFailed: 'Unable to establish the secure application session.',
    profileRestoreFailed: 'Unable to restore your profile. Please try again.',
    sessionRestoreFailed: 'Unable to restore your session. Please try again.',
    sessionRestoreTimedOut: 'Session restoration timed out. Please try again.',
    authInvalidCredentials: 'Wrong email or password.',
    authEmailNotConfirmed: 'Confirm your email before signing in.',
    authRateLimited: 'Too many attempts. Wait a moment and try again.',
    authWeakPassword: 'Choose a stronger password (at least 8 characters).',
    authSamePassword: 'The new password must be different from the current one.',
    backToNewWorkOrder: 'Back to New Work Order',
    backToWorkOrder: 'Back to Work Order',
    loadingRepairHistory: 'Loading repair history',
    repairHistoryTitle: 'Repair history',
    filterRepairHistory: 'Filter repair history by category',
    allCategoriesChip: 'ALL',
    noRepairHistory: 'No repair history.',
    mechanicLabel: 'Mechanic',
    mileageLabel: 'Mileage',
    workPerformed: 'Work performed',
    noWorkDetails: 'No work details were recorded.',
    openWorkOrderCheckFailed: 'Unable to verify open Work Orders. Retry before creating the Work Order.',
    selectTruckForPm: 'Select a truck before creating the PM Work Order.',
    truckContainsMatchesNote: ' Showing contains matches because no truck starts with your search.',
    loadingWorkOrderForm: 'Loading Work Order form',
    createFailed: 'Unable to create the Work Order.',
    actionFailed: 'Action failed. Try again.',
    referenceDataLoadError: 'Unable to load shop reference data.',
    accessDeniedTitle: 'Shop access unavailable',
    accessDeniedSubtitle: 'Your account is active, but it does not have access to a Shop workspace. Contact a Shop administrator.',
    accessDeniedBody: 'No operational data was opened. You can sign out from the profile menu and use another account.',
    pmFinishUpdatesMileage: (from, to) => `This will update the truck mileage from ${from} to ${to} and create an audit record.`,
    pmFinishCompletes: 'This will complete the PM service.',
    relativeMinutesAgo: (minutes) => `${minutes} min ago`,
    relativeHoursAgo: (hours) => `${hours} h ago`,
    relativeDaysAgo: (days) => `${days} d ago`,
    apiError: API_ERROR_COPY.en,
    qc: {
      title: 'Quality Check',
      subtitle: 'Trucks where every other step is done. Most urgent first.',
      navLabel: 'Safety',
      tabReview: 'To review',
      tabReturned: 'Returned',
      tabDone: 'Done',
      toReview: (count, mine) => `${count} to review${mine ? ` · ${mine} yours` : ''}`,
      empty: 'Nothing to review',
      emptyHint: 'Trucks appear here when every other step is done.',
      readySince: (when) => `Ready ${when}`,
      leaves: (when) => `Leaves ${when} · Dispatch`,
      yours: 'Yours',
      takenBy: (name) => `Taken by ${name}`,
      reviewing: (name) => `${name} is reviewing this truck.`,
      take: 'Take',
      takeThisTruck: 'Take this truck',
      continueReview: 'Continue review',
      approve: 'Approve',
      returnTruck: 'Return',
      more: 'More',
      letGo: 'Let go (the other Safety person can take it)',
      letGoToast: (truckNumber) => `You let go of Truck ${truckNumber}`,
      reviewTitle: (truckNumber) => `Truck ${truckNumber}`,
      reviewLoadError: 'This truck could not be loaded.',
      truckSection: 'Truck',
      vehicle: 'Vehicle',
      mileage: 'Mileage',
      vin: 'VIN',
      where: 'Where',
      notReported: 'Not reported',
      whatWasDone: 'What was done',
      pmLine: (mileage, parts) => `Mileage ${mileage} · ${parts} ${parts === 1 ? 'part' : 'parts'}`,
      inspectionSection: 'Arrival inspection',
      inspection: { issues_found: 'Issues found', no_issues_found: 'No issues found', not_recorded: 'Not recorded' },
      blockersSection: 'Blockers on this truck',
      resolvedBy: (who, when) => `Resolved by ${who} · ${when}`,
      returnedBefore: 'Returned before',
      returnedByOn: (who, when) => `${who} · ${when}`,
      approveTitle: (truckNumber) => `Approve Truck ${truckNumber}?`,
      approveHint: (displayId) => `The Quality Check is done in your name. The Manager can then close ${displayId} and the truck becomes Ready to Go.`,
      back: 'Back',
      returnTitle: (truckNumber) => `Return Truck ${truckNumber}`,
      returnHint: 'Say what you found. The Manager adds the work, and the truck comes back to this list when it is done.',
      whichJob: 'Which Job?',
      optional: '(optional)',
      otherJob: 'Other',
      returnNoteLabel: 'What did you find?',
      returnPlaceholder: 'E.g. rear brake hose is leaking',
      returnNoteRequired: 'Say what you found before returning the truck.',
      returnConfirm: 'Return truck',
      returnedTitle: 'Returned',
      returnedHint: 'Waiting for the Manager to add the work. They come back to To review when it is done.',
      noneReturned: 'Nothing returned.',
      waitingForManager: 'Waiting for the Manager',
      doneTitle: 'Done',
      doneHint: 'What you approved or returned in the last 7 days.',
      doneToday: 'Today',
      doneEarlier: 'Last 7 days',
      approvedLabel: 'Approved',
      returnedLabel: 'Returned',
      noneDone: 'Nothing yet. What you approve or return shows here.',
      approved: (truckNumber) => `Truck ${truckNumber} approved`,
      returnedToast: (truckNumber) => `Truck ${truckNumber} returned to the Manager`,
      takenToast: (truckNumber) => `Truck ${truckNumber} is yours`,
      loadError: 'The Quality Check list did not load.',
      loadErrorHint: 'Check the connection and try again.',
    },
  },
  es: {
    locale: 'es', language: 'Idioma', switchTo: 'Cambiar a inglés', home: 'Inicio',
    backToHome: 'Volver a Inicio', retry: 'Reintentar', signIn: 'Iniciar sesión',
    errorScreenTitle: 'Algo salió mal',
    errorScreenSubtitle: 'No se pudo cargar esta pantalla. Tu trabajo guardado no cambió.',
    errorScreenRetryMessage: 'Intenta cargar esta pantalla de nuevo.',
    errorScreenRetry: 'Reintentar pantalla',
    signInHint: 'Inicia sesión con el correo vinculado al Shop.', email: 'Correo electrónico', password: 'Contraseña',
    resetPassword: 'Restablecer contraseña', devLogin: 'Acceso de desarrollo (bypass local)',
    newWorkOrder: 'Nuevo Work Order', newPmService: 'Nuevo servicio de PM',
    workOrder: 'Work Order',
    workOrderHint: 'Ingresa la información requerida. Crear guarda el Work Order; Iniciar trabajo comienza el registro de tiempo.',
    pmServiceHint: 'Selecciona una unidad para crear un servicio de PM.', truck: 'Unidad',
    searchTruck: 'Número de unidad, ej. 905', noTrucks: 'No se encontraron unidades.', truckOpenWorkOrder: (displayId) => `${displayId} abierto`,
    checkingOpenWorkOrder: 'Verificando si hay un Work Order abierto.', retryWorkOrderCheck: 'Reintentar la verificación del Work Order',
    truckInformation: 'Información de la unidad', selectTruck: 'Selecciona una unidad para ver sus detalles.',
    vin: 'VIN', lastReportedLocation: 'Ubicación reportada', locationUpdatedOn: 'Reportada el',
    repairHistory: 'Ver historial de reparaciones de la unidad', openWorkOrder: 'Ver Work Order abierto',
    noJobsHereAnymore: 'Ya no tienes Jobs en este Work Order. El Manager puede haberlos reasignado o cancelado.',
    workOrderGone: 'Este Work Order ya no existe.',
    backToMyWork: 'Volver a Mi trabajo',
    chooseAnotherWorkOrder: 'Elegir otro Work Order',
    workOrderOpen: (truckNumber) => `La unidad #${truckNumber} ya tiene un Work Order abierto.`,
    workOrderSummary: (displayId, status, completed, total) => `${displayId} · ${status} · ${completed} de ${total} Jobs completados`,
    truckResults: (count) => `${count} ${count === 1 ? 'resultado de unidad disponible.' : 'resultados de unidades disponibles.'}`,
    activeJobs: (count) => `${count} ${count === 1 ? 'Work Order' : 'Work Orders'} en curso`,
    pausedJobs: (count) => `${count} ${count === 1 ? 'Work Order' : 'Work Orders'} en pausa`,
    activePmServices: (count) => `${count} ${count === 1 ? 'servicio de PM activo' : 'servicios de PM activos'}`,
    pausedPmServices: (count) => `${count} ${count === 1 ? 'servicio de PM pausado' : 'servicios de PM pausados'}`,
    noActiveJobs: 'No hay trabajo asignado en progreso.',
    noPausedJobs: 'No hay Work Orders en pausa. El trabajo pausado aparecerá aquí hasta que se reanude.',
    noPausedPmServices: 'No hay servicios de PM pausados. El trabajo pausado aparecerá aquí hasta que se reanude.',
    activeJobsTitle: 'En curso',
    pausedJobsTitle: 'Pausados por el Manager',
    pmActiveTitle: 'Servicios de PM activos',
    pmPausedTitle: 'Servicios de PM pausados',
    notes: 'Notas',
    saveNotes: 'Guardar notas',
    notesOptional: 'Notas (opcional)',
    notesPlaceholder: 'Describe o agrega cualquier información necesaria para realizar el trabajo',
    unableToSaveNotes: 'No se pudieron guardar las notas.',
    priorityLabel: 'Prioridad',
    pauseReasonLabel: 'Motivo de pausa',
    selectOption: 'Selecciona una opción',
    reasonRequiredForOther: 'Motivo obligatorio para Otro',
    blockerNoteOptionalLabel: '¿Qué falta? (opcional)',
    blockerNoteRequiredLabel: '¿Qué te detiene?',
    blockerReportPlaceholder: 'Ej.: el número de pieza o la herramienta que necesitas',
    blockerNoteRequired: 'Di qué te detiene.',
    additionalDetails: 'Detalles adicionales',
    unableToSavePmDetails: 'No se pudieron guardar los detalles del servicio de PM.',
    waitingOnManager: 'Espera al Manager',
    waitingOnManagerHint: (count) => count === 1
      ? 'Terminaste tu parte en 1 Work Order. El Manager la cierra cuando todos los pasos estén hechos.'
      : `Terminaste tu parte en ${count} Work Orders. El Manager cierra cada una cuando todos los pasos estén hechos.`,
    waitingOnManagerBody: 'Tus Jobs están hechos. El Shop Manager cierra este Work Order cuando todos los pasos estén hechos. Si algo detiene la unidad, aún puedes reportar un bloqueo.',
    assignedToYou: 'Asignado a ti',
    assignedTo: (name) => `Asignado a ${name}`,
    completedByYou: 'Completado por ti',
    completedBy: (name) => `Completado por ${name}`,
    jobUnassigned: 'Sin asignar',
    jobStatusPending: 'Pendiente',
    jobStatusInProgress: 'En curso',
    jobStatusBlocked: 'Bloqueado',
    woStatusPaused: 'Pausado',
    inspectionStep: 'Inspección',
    myJobs: 'Tus Jobs',
    otherWorkOnThisTruck: 'Otro trabajo en esta unidad',
    noMyJobs: 'No tienes Jobs asignados.',
    tapJobToComplete: 'Cuando termines un Job, toca Completar Job.',
    completeJobFor: (name) => `Completar Job: ${name}`,
    finishedYourPart: (truckNumber) => `Terminaste tu parte en la unidad ${truckNumber}.`,
    finishedYourPartHint: 'Tu tiempo se detuvo. Si el Manager te da otro Job aquí, toca Continuar.',
    continueWork: 'Continuar',
    yourJobsCount: (count) => `${count} ${count === 1 ? 'Job tuyo' : 'Jobs tuyos'}`,
    nextJob: 'Siguiente',
    resolvedTapContinue: 'Resuelto · toca Continuar',
    resolvedBlockerTitle: (job, name) => [job, `Resuelto por ${name}`].filter(Boolean).join(' · '),
    managerNote: (note) => `Nota del Manager: ${note}`,
    resolvedBlockerHint: 'Toca Continuar para seguir trabajando.',
    dayCloseTapContinue: 'Ayer quedó en curso · toca Continuar',
    clockOnTruckTapContinue: (truckNumber) => `Tu reloj está en la unidad ${truckNumber} · toca Continuar`,
    clockSwitchedTapContinue: 'Tu reloj está detenido · toca Continuar',
    otherWorkReadOnly: 'Este trabajo lo hacen otros mecánicos. Puedes verlo, no cambiarlo.',
    helperJobSuffix: ' · ayudante',
    jobAtExternalShop: 'En taller externo',
    createWorkOrder: 'Crear nuevo Work Order',
    searchJobsLabel: 'Buscar jobs en esta categoría',
    categoryJobsLabel: 'Jobs en esta Category',
    noJobsInCategory: 'No hay Jobs listados en esta Category.',
    noMatchingCategoryJobs: 'Ningún Job coincide con esta búsqueda.',
    loadingJobs: 'Cargando jobs…',
    loadError: 'No se pudo cargar esta pantalla.',
    customJobPlaceholder: 'Nombre de job personalizado',
    addCustomJob: 'Agregar job personalizado',
    addCatalogJob: 'Agregar',
    checkingTruck: 'Verificando camión…',
    chooseCategory: 'Elige una categoría',
    addJobToContinue: 'Agrega un job para continuar',
    askManagerToCreate: 'Pide a tu Shop Manager que cree el Work Order.',
    askManagerToCreateHint: 'El Manager planifica el trabajo Standard. En Inicio ves los Work Orders asignados a ti.',
    workOptions: 'Opciones de trabajo',
    additionalWorkHint: '¿Hace falta trabajo adicional en esta unidad? Usa Pedir trabajo en Notas para que el Manager agregue el Job.',
    jobFinishNotes: 'Nota al completar',
    jobFinishNotesPlaceholder: '¿Qué hiciste? El Manager verá esta nota.',
    pausedAskManager: 'Este Work Order está pausado. Tu Shop Manager lo reanudará.',
    createPmService: 'Crear servicio de PM',
    viewCompletedWork: (count) => `Ver trabajo completado (${count})`,
    workspaceUnavailable: 'Este espacio de mecánico no está disponible para tu cuenta.',
    openAllowedHome: 'Ir a tu Inicio del Shop',
    startWork: 'Iniciar trabajo',
    startingWork: 'Iniciando…',
    workStartedSuccess: 'Trabajo iniciado.',
    clockMovedFromTo: (fromTruck, toTruck) => `Trabajo iniciado. Tu reloj pasó de la unidad ${fromTruck} a la ${toTruck}.`,
    clockStripYourClock: 'Tu reloj',
    noJobsAssignedYet: 'Todavía no tienes Jobs',
    yourJobsDoneCount: (done, total) => `${done} de ${total} hechos`,
    yourTimeLabel: 'Tu tiempo',
    laborStoppedLabel: 'detenido',
    blockerSinceBy: (since, who) => `Desde ${since} · lo reportó ${who}. Solo el Manager lo resuelve.`,
    addNoteOpen: 'Agregar nota',
    noteForManager: 'Nota para el Manager',
    waitingOnManagerShort: 'espera al Manager',
    unableToLoadTrucks: 'No se pudieron cargar las unidades.',
    completedToday: 'Hoy',
    completedYesterday: 'Ayer',
    completedEarlier: 'Antes',
    noClosingNote: 'Sin nota de cierre',
    addANoteLabel: 'Agregar una nota',
    notesKeptHint: 'Queda en este teléfono hasta que la envíes. Las notas no se editan.',
    requestWorkTitle: '¿Qué necesita la unidad?',
    requestWorkSheetHint: 'Llega al Dashboard del Manager. El Manager decide si agrega un Job y quién lo hace.',
    requestWorkSend: 'Enviar al Manager',
    requestWorkRequired: 'Di qué necesita la unidad.',
    completeJobTitle: (name) => `¿Completar ${name}?`,
    completeLastHint: 'Es tu último Job aquí: tu reloj se detiene.',
    completeKeepsRunning: 'Tu reloj sigue corriendo.',
    blockerSheetHint: 'Se le avisa al Manager y él lo resuelve. No puedes completar este Job hasta entonces.',
    noJobsAssignedHint: 'Cuando el Manager te asigne un Job, aparece aquí.',
    mostUrgentFirst: 'Lo más urgente primero.',
    blockedSectionTitle: 'Bloqueado · espera al Manager',
    blockedSectionHint: 'Solo el Manager resuelve un bloqueo. Abre la unidad para agregar una nota.',
    blockedSince: (when) => `Desde ${when}`,
    yourPartDone: (jobs) => `Terminaste tu parte · ${jobs}`,
    clockRunning: 'Reloj corriendo',
    viewShort: 'Ver',
    clockStripSince: (time) => `desde ${time}`,
    clockStripOpen: 'Abrir',
    clockStripStopped: 'Tu reloj está detenido · toca Continuar en una unidad',
    offlineNotSent: 'Sin conexión · no se envía nada',
    reportBlocker: 'Reportar bloqueo',
    activeBlockers: 'Bloqueos activos',
    blockerWaitsForManager: 'Solo el Manager resuelve el bloqueo. Agrega una nota si algo cambia.',
    addBlockerNote: 'Agregar nota al bloqueo',
    blockerNotePlaceholder: 'Por ejemplo: ya llegó la pieza.',
    blockerNoteAdded: 'Nota agregada al bloqueo.',
    blockedWithReason: (reason) => `Bloqueado · ${reason}`,
    reportBlockerFor: (jobName) => `Reportar bloqueo: ${jobName}`,
    noteThreadEmpty: 'Aún no hay notas.',
    notePlaceholder: 'Escribe una nota: algo que el taller deba saber',
    addNote: 'Agregar nota',
    requestWork: 'Pedir trabajo',
    noteAddedSuccess: 'Nota agregada.',
    workRequestSentSuccess: 'Pedido de trabajo enviado a tu Manager.',
    workRequestLabel: 'Pedido de trabajo',
    workRequestPending: 'Esperando al Manager',
    workRequestHandledBy: (name) => `Atendido por ${name}`,
    notesClosed: 'Este Work Order está cerrado. Las notas son de solo lectura.',
    requestWorkHint: 'Pedir trabajo le llega a tu Manager, que puede agregarlo como Job. Las notas nunca se sobrescriben.',
    reportingBlocker: 'Reportando…',
    blockerReasonRequiredHint: 'Elige un motivo para reportar el bloqueo.',
    blockerReportedSuccess: 'Bloqueo reportado. El Manager lo resolverá.',
    blockerReason: 'Motivo del bloqueo',
    jobFinishTitle: 'Completar Job',
    jobFinishConfirm: 'Completar Job',
    completingJob: 'Completando…',
    jobFinishedSuccess: 'Job marcado como completado.',
    jobFinishedWithNoteSuccess: 'Job marcado como completado. Tu nota quedó guardada.',
    dismissNotice: 'Cerrar',
    closeDialog: 'Cerrar',
    pauseWorkOrder: 'Pausar Work Order',
    pauseUnavailableUntilInProgress: 'La pausa está disponible cuando este Work Order está En progreso.',
    workOrderAction: (action, displayId, truckNumber) => `${action} unidad ${truckNumber}, Work Order ${displayId}`,
    pmServiceLoadError: 'No se pudieron cargar los detalles del servicio de PM.',
    loadingPmService: 'Cargando detalles del servicio de PM…',
    currentTruckMileage: 'Millaje actual del camión',
    lastCompletedPm: 'Último PM completado',
    truckMileageToday: 'Millaje del camión hoy',
    previousPm: 'PM anterior',
    mileageAtThisPm: 'Millaje registrado en este PM',
    pmCompletedOn: (date) => `PM completado ${date}`,
    noPartsRecorded: 'No se registraron piezas.',
    noPriorPm: 'No hay PM anterior registrado',
    mileageNotRecorded: 'Millaje no registrado',
    observedMileage: 'Millaje observado',
    enterMileageHint: 'Ingresa el millaje observado para registrar las piezas usadas.',
    mileageBelowCurrent: (current) => `El millaje observado no puede ser menor al millaje actual del truck (${current}). Revisa el odómetro.`,
    mileageJumpWarning: (current) => `Son más de 50,000 mi sobre el millaje actual del truck (${current}). Confirma la lectura del odómetro.`,
    confirmMileage: 'Confirmar millaje',
    partsUsed: 'Piezas usadas',
    noPartUsed: 'No se usó ninguna pieza',
    noCompatibleParts: 'No hay piezas compatibles para este camión',
    saving: 'Guardando…',
    saved: 'Guardado',
    autosaved: 'Guardado automáticamente',
    restoringSession: 'Restaurando sesión',
    appLoading: 'Cargando Lightning Shop…',
    loadingWorkOrders: 'Cargando Work Orders',
    loadingWorkOrder: 'Cargando Work Order',
    retryWorkOrder: 'Reintentar Work Order',
    unableToLoadProfile: 'No se pudo cargar tu perfil.',
    unableToLoadWorkOrders: 'No se pudieron cargar los Work Orders',
    homeSubtitle: 'Jobs actuales, Work Orders y trabajo reciente.',
    pmHomeTitle: 'Mecánico de PM',
    standardHomeTitle: 'Mi trabajo asignado',
    pmHomeSubtitle: 'Servicios de PM asignados a ti.',
    standardHomeSubtitle: 'Work Orders y Jobs que te asignó el Manager.',
    readyToStart: 'Listos para iniciar',
    ordersReadyToStart: (count) => `${count} ${count === 1 ? 'orden lista' : 'órdenes listas'} para Iniciar trabajo`,
    noActivePmServices: 'No hay servicios de PM activos asignados a ti.',
    pmServicesStartImmediately: 'Los servicios de PM comienzan inmediatamente después de crearse.',
    viewDetails: 'Ver detalles',
    resumeWork: 'Reanudar trabajo',
    viewWork: 'Ver trabajo',
    finishWork: 'Terminar trabajo',
    continuePmService: 'Continuar servicio PM',
    pmStartedAt: (time) => `Iniciado ${time}`,
    pmAlreadyRunning: (displayId) => `Termina ${displayId} antes de iniciar otro servicio PM.`,
    pmInProgressOn: (truckNumber, displayId) => `Tienes un servicio PM en curso en la unidad ${truckNumber} (${displayId}). Termínalo antes de iniciar otro.`,
    continuePmOn: (truckNumber) => `Continuar el PM en la unidad ${truckNumber}`,
    confirmMileageFirst: 'Confirma el millaje de arriba para guardar las piezas.',
    enterMileageToSave: 'Ingresa el millaje. Hasta entonces queda el último millaje guardado.',
    pmNotSaved: 'Sin guardar',
    pmKeptOnPhone: 'Aún no se envió. Lo que anotaste queda en este teléfono y se envía cuando vuelva la conexión.',
    pmServiceTypeLabel: 'Tipo de servicio',
    pmJoinAdd: (displayId) => `Esta unidad ya tiene el Work Order ${displayId}. Tu servicio PM se agregará ahí.`,
    pmJoinJoin: (displayId) => `Esta unidad ya tiene el Work Order ${displayId} con un job PM. Lo tomarás e iniciarás.`,
    pmJoinMine: (displayId) => `Ya iniciaste el PM en el Work Order ${displayId}.`,
    pmJoinTaken: (displayId, name) => `El PM del Work Order ${displayId} está asignado a ${name}. Pregunta a tu Shop Manager si debe ser tuyo.`,
    pmJoinDone: (displayId) => `El PM del Work Order ${displayId} ya está hecho.`,
    joinPmService: 'Iniciar PM en este Work Order',
    finishingWork: 'Terminando…',
    pmFinishedSuccess: 'Servicio de PM completado.',
    viewCompletedWorkAction: 'Ver trabajo completado',
    jobsDone: (completed, total) => `${completed} de ${total} Jobs completados`,
    truckTitle: (truckNumber) => `Unidad ${truckNumber}`,
    navMyWork: 'Mi trabajo',
    navTrucks: 'Unidades',
    navCompleted: 'Completados',
    mechanicNavLabel: 'Espacio del mecánico',
    mechanicTrucksTitle: 'Buscar una unidad',
    mechanicTrucksSubtitle: 'Busca por número de unidad para ver su historial de reparaciones.',
    mechanicCompletedTitle: 'Trabajo completado',
    mechanicCompletedSubtitle: 'Jobs que completaste, del Work Order más reciente al más antiguo.',
    noCompletedWork: 'Aún no hay trabajo completado.',
    backToTrucks: 'Volver a Unidades',
    startPmService: 'Iniciar servicio PM',
    pmServiceStartedSuccess: 'Servicio PM iniciado.',
    pmJobFinishedHint: 'Este servicio PM está terminado. El Shop Manager cierra el Work Order.',
    pmJobFinishRequirement: 'Para terminar se necesita el millaje observado guardado y al menos una parte.',
    pmJobNotStartedHint: 'Inicia el servicio PM para registrar el millaje observado y las partes.',
    pmJobOnWorkOrder: (job, workOrder) => `${job} · Work Order ${workOrder}`,
    startWorkToCompleteJobs: 'Pulsa Iniciar trabajo para poder completar Jobs.',
    continueToCompleteJobs: 'Pulsa Continuar para poder completar Jobs.',
    laborTime: (duration) => `Tiempo de labor: ${duration}`,
    laborRunningLabel: 'en curso',
    pmServiceLabel: 'Servicio de PM',
    noPendingJobs: 'No hay Jobs pendientes',
    noCompletedJobs: 'No hay Jobs completados',
    cancelAction: 'Cancelar',
    multiSelectDone: 'Listo',
    backToShopAdmin: 'Volver a Shop Admin',
    workspaceStandard: 'Standard',
    workspacePm: 'PM',
    shopWorkspaces: 'Espacios del Shop',
    priority: { low: 'Baja', normal: 'Normal', high: 'Alta', critical: 'Crítica' },
    jobStatus: { to_do: 'Por hacer', completed: 'Completado', cancelled: 'Cancelado' },
    status: { created: 'Creado', in_progress: 'En progreso', waiting_paused: 'Pausado', completed: 'Completado', cancelled: 'Cancelado' },
    pauseReason: {
      [PauseReason.WAITING_FOR_PARTS]: 'En espera de piezas',
      [PauseReason.WAITING_FOR_APPROVAL]: 'En espera de aprobación',
      [PauseReason.WAITING_FOR_VENDOR]: 'En espera del proveedor',
      [PauseReason.WAITING_FOR_EQUIPMENT]: 'En espera de equipo o herramienta',
      [PauseReason.WAITING_FOR_BAY]: 'En espera de bahía',
      [PauseReason.WAITING_FOR_DRIVER]: 'En espera del conductor',
      [PauseReason.TRUCK_UNAVAILABLE]: 'Truck no disponible',
      [PauseReason.WORKING_ON_ANOTHER_WO]: 'Trabajando en otro Work Order',
      [PauseReason.BREAK]: 'Descanso',
      [PauseReason.END_OF_SHIFT]: 'Fin del turno',
      [PauseReason.OTHER]: 'Otro',
      [BlockerReason.QUALITY_CHECK_FAILED]: 'Devuelto por Safety',
    },
    theme: 'Tema',
    themeLight: 'Claro',
    themeDark: 'Oscuro',
    themeAuto: 'Auto',
    signOut: 'Cerrar sesión',
    signingOut: 'Cerrando sesión…',
    signOutFailed: 'No se pudo cerrar la sesión.',
    openProfileFor: (name) => `Abrir perfil de ${name}`,
    closeProfile: 'Cerrar perfil',
    homeControls: 'Controles de Inicio',
    forbiddenTitle: 'Acceso a Shop Admin denegado',
    forbiddenBody: 'Tu cuenta no tiene permiso para abrir el espacio administrativo.',
    forbiddenBack: 'Volver a tu inicio',
    signInFailed: 'No se pudo iniciar sesión.',
    accountNotConfigured: 'Tu cuenta no está configurada para la aplicación del Shop.',
    resetEmailFailed: 'No se pudo enviar el correo de restablecimiento.',
    resetEmailSent: 'Si este correo tiene una cuenta, se envió un enlace para restablecer la contraseña.',
    useAnotherAccount: 'Usar otra cuenta',
    verifyingRecoveryLink: 'Verificando enlace de recuperación',
    passwordUpdatedTitle: 'Contraseña actualizada',
    passwordUpdatedSubtitle: 'Inicia sesión con tu nueva contraseña.',
    passwordUpdatedBody: 'Tu contraseña se actualizó correctamente.',
    backToSignIn: 'Volver a iniciar sesión',
    recoveryLinkUnavailableTitle: 'Enlace de recuperación no disponible',
    recoveryLinkUnavailableSubtitle: 'Solicita un nuevo correo para restablecer la contraseña e inténtalo de nuevo.',
    setNewPasswordTitle: 'Crear nueva contraseña',
    setNewPasswordSubtitle: 'Elige una nueva contraseña para tu cuenta del Shop.',
    secureSessionFailed: 'No se pudo establecer la sesión segura de la aplicación.',
    profileRestoreFailed: 'No se pudo recuperar tu perfil. Inténtalo de nuevo.',
    sessionRestoreFailed: 'No se pudo recuperar tu sesión. Inténtalo de nuevo.',
    sessionRestoreTimedOut: 'La recuperación de la sesión tardó demasiado. Inténtalo de nuevo.',
    authInvalidCredentials: 'Correo o contraseña incorrectos.',
    authEmailNotConfirmed: 'Confirma tu correo antes de iniciar sesión.',
    authRateLimited: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
    authWeakPassword: 'Elige una contraseña más segura (al menos 8 caracteres).',
    authSamePassword: 'La nueva contraseña debe ser distinta de la actual.',
    backToNewWorkOrder: 'Volver al nuevo Work Order',
    backToWorkOrder: 'Volver al Work Order',
    loadingRepairHistory: 'Cargando historial de reparaciones',
    repairHistoryTitle: 'Historial de reparaciones',
    filterRepairHistory: 'Filtrar historial de reparaciones por categoría',
    allCategoriesChip: 'TODOS',
    noRepairHistory: 'No hay historial de reparaciones.',
    mechanicLabel: 'Mecánico',
    mileageLabel: 'Millaje',
    workPerformed: 'Trabajo realizado',
    noWorkDetails: 'No se registraron detalles del trabajo.',
    openWorkOrderCheckFailed: 'No pudimos verificar los Work Orders abiertos. Reintenta antes de crear el Work Order.',
    selectTruckForPm: 'Selecciona una unidad antes de crear el Work Order de PM.',
    truckContainsMatchesNote: ' Se muestran coincidencias parciales porque ninguna unidad comienza con tu búsqueda.',
    loadingWorkOrderForm: 'Cargando formulario de Work Order',
    createFailed: 'No se pudo crear el Work Order.',
    actionFailed: 'La acción no se pudo completar. Inténtalo de nuevo.',
    referenceDataLoadError: 'No se pudieron cargar los datos de referencia del Shop.',
    accessDeniedTitle: 'Acceso al Shop no disponible',
    accessDeniedSubtitle: 'Tu cuenta está activa, pero no tiene acceso a un espacio del Shop. Contacta a un administrador del Shop.',
    accessDeniedBody: 'No se abrió ningún dato operativo. Puedes cerrar sesión desde el menú de perfil y usar otra cuenta.',
    pmFinishUpdatesMileage: (from, to) => `Esto actualizará el millaje de la unidad de ${from} a ${to} y creará un registro de auditoría.`,
    pmFinishCompletes: 'Esto completará el servicio de PM.',
    relativeMinutesAgo: (minutes) => `hace ${minutes} min`,
    relativeHoursAgo: (hours) => `hace ${hours} h`,
    relativeDaysAgo: (days) => `hace ${days} d`,
    apiError: API_ERROR_COPY.es,
    qc: {
      title: 'Quality Check',
      subtitle: 'Unidades con todo lo demás hecho. Lo más urgente primero.',
      navLabel: 'Safety',
      tabReview: 'Por revisar',
      tabReturned: 'Devueltos',
      tabDone: 'Hechos',
      toReview: (count, mine) => `${count} por revisar${mine ? ` · ${mine} tuyos` : ''}`,
      empty: 'Nada por revisar',
      emptyHint: 'Las unidades aparecen aquí cuando todo lo demás está hecho.',
      readySince: (when) => `Lista ${when}`,
      leaves: (when) => `Sale ${when} · Dispatch`,
      yours: 'Tuyo',
      takenBy: (name) => `Lo tomó ${name}`,
      reviewing: (name) => `${name} está revisando esta unidad.`,
      take: 'Tomar',
      takeThisTruck: 'Tomar esta unidad',
      continueReview: 'Seguir revisando',
      approve: 'Aprobar',
      returnTruck: 'Devolver',
      more: 'Más',
      letGo: 'Soltar (la otra persona de Safety la puede tomar)',
      letGoToast: (truckNumber) => `Soltaste la unidad ${truckNumber}`,
      reviewTitle: (truckNumber) => `Unidad ${truckNumber}`,
      reviewLoadError: 'No se pudo cargar esta unidad.',
      truckSection: 'Unidad',
      vehicle: 'Vehículo',
      mileage: 'Millaje',
      vin: 'VIN',
      where: 'Dónde está',
      notReported: 'Sin reportar',
      whatWasDone: 'Qué se hizo',
      pmLine: (mileage, parts) => `Millaje ${mileage} · ${parts} ${parts === 1 ? 'pieza' : 'piezas'}`,
      inspectionSection: 'Inspección de llegada',
      inspection: { issues_found: 'Con hallazgos', no_issues_found: 'Sin hallazgos', not_recorded: 'Sin registrar' },
      blockersSection: 'Bloqueos de esta unidad',
      resolvedBy: (who, when) => `Lo resolvió ${who} · ${when}`,
      returnedBefore: 'Devoluciones anteriores',
      returnedByOn: (who, when) => `${who} · ${when}`,
      approveTitle: (truckNumber) => `¿Aprobar la unidad ${truckNumber}?`,
      approveHint: (displayId) => `El Quality Check queda a tu nombre. El Manager ya puede cerrar ${displayId} y la unidad queda Ready to Go.`,
      back: 'Volver',
      returnTitle: (truckNumber) => `Devolver unidad ${truckNumber}`,
      returnHint: 'Di qué encontraste. El Manager agrega el trabajo y la unidad vuelve a esta lista cuando esté hecho.',
      whichJob: '¿Qué Job?',
      optional: '(opcional)',
      otherJob: 'Otro',
      returnNoteLabel: '¿Qué encontraste?',
      returnPlaceholder: 'Ej.: fuga en la manguera del freno trasero',
      returnNoteRequired: 'Di qué encontraste antes de devolver la unidad.',
      returnConfirm: 'Devolver unidad',
      returnedTitle: 'Devueltos',
      returnedHint: 'Esperan a que el Manager agregue el trabajo. Vuelven a Por revisar cuando esté hecho.',
      noneReturned: 'Nada devuelto.',
      waitingForManager: 'Espera al Manager',
      doneTitle: 'Hechos',
      doneHint: 'Lo que aprobaste o devolviste en los últimos 7 días.',
      doneToday: 'Hoy',
      doneEarlier: 'Últimos 7 días',
      approvedLabel: 'Aprobada',
      returnedLabel: 'Devuelta',
      noneDone: 'Todavía nada. Aquí aparece lo que apruebes o devuelvas.',
      approved: (truckNumber) => `Unidad ${truckNumber} aprobada`,
      returnedToast: (truckNumber) => `Unidad ${truckNumber} devuelta al Manager`,
      takenToast: (truckNumber) => `Unidad ${truckNumber} es tuya`,
      loadError: 'No se cargó la lista de Quality Check.',
      loadErrorHint: 'Revisa la conexión e inténtalo de nuevo.',
    },
  },
};

const LocaleContext = React.createContext<{ messages: Copy; setLocale: (locale: ShopLocale) => void } | null>(null);

export function ShopLocaleProvider({
  children,
  initialLocale = 'en',
}: {
  children: React.ReactNode;
  initialLocale?: ShopLocale;
}) {
  const locale = React.useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener('ltl-shop-locale-change', onStoreChange);
      return () => window.removeEventListener('ltl-shop-locale-change', onStoreChange);
    },
    () => shopLocaleFromCookieHeader(document.cookie),
    () => parseShopLocale(initialLocale),
  );
  const setLocale = React.useCallback((nextLocale: ShopLocale) => {
    document.cookie = shopLocaleCookieWrite(nextLocale);
    document.documentElement.lang = nextLocale;
    window.dispatchEvent(shopLocaleChangeEvent());
  }, []);

  React.useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = React.useMemo(() => ({ messages: copy[locale], setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useShopLocale() {
  const context = React.useContext(LocaleContext);
  if (!context) throw new Error('useShopLocale must be used within ShopLocaleProvider');
  return context;
}

export function getShopCopy(locale: ShopLocale): Copy { return copy[locale]; }
