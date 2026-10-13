import type { DemoUserKey } from './cast';
import type { DemoAction } from './autoplay';
import type { DemoSpotlight } from './spotlight';

/**
 * D36: the guided stories. Same ids and order as docs/USER_FLOWS.md (J1–J14, HU-M1…HU-A2); the trucks are
 * the ones prisma:demo-local builds (docs/reference/DEMO.md). The presenter taps; the panel only switches
 * user and screen and says what to do and what to explain. English on purpose: a presenter tool.
 */
export type DemoTarget =
  | { kind: 'path'; path: string }
  | { kind: 'adminTruck'; unit: string; tab?: 'costs' }
  | { kind: 'adminWorkOrder'; unit: string }
  | { kind: 'workOrder'; unit: string; view?: 'pm' }
  | { kind: 'truckHistory'; unit: string };

export type DemoStep = {
  user: DemoUserKey;
  target: DemoTarget;
  title: string;
  /** What to tap or look at on this screen. */
  do: string;
  /** What to tell the audience. */
  say?: string;
  /** What must be on screen (a quick check that the demo data is intact). */
  expect?: string;
  /** This step changes data: later stories see the result; rebuild the demo to run it again. */
  mutates?: boolean;
  /** Demo flow only: the chapter this step belongs to (shown above the step; same label = same chapter). */
  chapter?: string;
  /** D39 (DP2): what to light up on the screen, with a short line on what to tap or look at. */
  spotlight?: DemoSpotlight;
  /** D40 (DA3): what Play does here, when it is more than tapping what the spotlight lights (a form to fill). */
  play?: DemoAction[];
  /** D40: the lit element is only to look at: Play points at it and does not tap it. */
  look?: boolean;
};

export type DemoJobId = `J${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14}`;

export type DemoStoryId =
  | 'HU-M1' | 'HU-M2' | 'HU-M3' | 'HU-M4' | 'HU-M5' | 'HU-M6' | 'HU-M7' | 'HU-M8' | 'HU-M9' | 'HU-M10' | 'HU-M11' | 'HU-M12' | 'HU-M13'
  | 'HU-ME1' | 'HU-ME2' | 'HU-ME3' | 'HU-ME4' | 'HU-ME5' | 'HU-ME6'
  | 'HU-PM1' | 'HU-QC1' | 'HU-A1' | 'HU-A2';

export type DemoRole = 'Manager' | 'Standard mechanic' | 'PM mechanic' | 'Safety' | 'System Admin' | 'Everyone';

/** How the panel groups the stories: by who does them, in the shop's words (UX-5-003). */
export type DemoWho = 'MS' | 'Mechanics' | 'MPM' | 'QC' | 'AS';

export const DEMO_WHO_LABELS: Record<DemoWho, string> = {
  MS: 'Manager Shop (MS)',
  Mechanics: 'Mecánicos (MG, MA, MD)',
  MPM: 'Mecánico PM (MPM)',
  QC: 'Quality Check (QC)',
  AS: 'Admin Shop (AS)',
};

export type DemoStory = {
  id: DemoStoryId | 'FLOW';
  /** Plain title in the user's words: no HU/J codes (UX-3-001). */
  title: string;
  who: DemoWho;
  /** Job to be done (USER_FLOWS §1); null for HU-A2, which has none. */
  jtbd: DemoJobId | null;
  role: DemoRole;
  trucks: string[];
  /** What the local demo cannot show in this story. */
  note?: string;
  steps: DemoStep[];
};

export const DEMO_JTBD: Record<DemoJobId, { who: string; title: string }> = {
  J1: { who: 'Manager', title: 'A truck arrives: open its work in one step and know what to do' },
  J2: { who: 'Manager', title: 'Work to split: decide who does what' },
  J3: { who: 'Manager', title: 'Something stops a truck: find out at once, with the reason' },
  J4: { who: 'Manager', title: 'Work is done: review, close and return the truck to service' },
  J5: { who: 'Manager', title: 'See the whole shop: every truck, its step and what it is missing' },
  J6: { who: 'Mechanic', title: 'Start of shift: see only what is mine' },
  J7: { who: 'Mechanic', title: 'While working: mark what I finish and have my time recorded' },
  J8: { who: 'Mechanic', title: 'Something stops me: report it with the reason' },
  J9: { who: 'PM mechanic', title: 'Preventive maintenance: mileage, parts, done in minutes' },
  J10: { who: 'Admin', title: 'A time or state mistake: correct it and leave a trace' },
  J11: { who: 'Safety', title: 'A truck is done: approve it or return it with what I found' },
  J12: { who: 'Manager', title: 'New mechanic: add them myself' },
  J13: { who: 'Manager', title: 'Parts and outside repairs: load the invoice and charge it to the truck' },
  J14: { who: 'Manager', title: 'Month end: send Finance what the shop did for each truck' },
};

const manager = 'MS' as const;

const STORY_SCRIPTS: DemoStory[] = [
  {
    id: 'HU-M1', title: 'A truck arrives', who: 'MS', jtbd: 'J1', role: 'Manager', trucks: ['973'],
    steps: [
      { user: manager, target: { kind: 'path', path: '/admin/trucks' }, title: 'The truck list',
        do: 'Find truck 973: "No open Work Order", In Service.',
        say: 'Every truck of the fleet is here, with its open Work Order when it has one. 973 just arrived at the shop.',
        expect: 'Truck 973: "No open Work Order".' },
      { user: manager, target: { kind: 'adminTruck', unit: '973' }, title: 'New Work Order from the truck',
        do: 'Tap "New Work Order" in the next-step box. Pick a priority, add a note, "Create Work Order".',
        say: 'One step: the Work Order is born with the four mandatory steps (PM, Alignment, Detailing, Quality Check), each with its default owner from Shop workflow.',
        expect: 'The next step now says "Record the inspection".', mutates: true },
      { user: manager, target: { kind: 'adminTruck', unit: '973' }, title: 'The plan is ready',
        do: 'Read the Work Plan: PM on MPM, Alignment on MA, Detailing shows "Assign" but waits in the team queue (a team of two), Quality Check on Safety.',
        say: 'The owners come from Setup → Shop workflow. Quality Check never has a single owner: Safety takes it from its own queue. Nobody has to ask what comes next.',
        expect: 'PM and Alignment with their owner; Detailing and QC on their teams.' },
    ],
  },
  {
    id: 'HU-M2', title: 'Inspect and add work', who: 'MS', jtbd: 'J1', role: 'Manager', trucks: ['601', '602'],
    steps: [
      { user: manager, target: { kind: 'adminTruck', unit: '601' }, title: 'Arrival inspection',
        do: 'The next step asks for the inspection. Tap "Issues found": the "Add work" sheet opens.',
        say: '601 just arrived. The inspection is the first decision: no issues, or issues with work to add.',
        expect: 'Next step: inspection pending.' },
      { user: manager, target: { kind: 'adminTruck', unit: '601' }, title: 'Add work',
        do: 'Pick a category and a catalog Job (Air & Brake System → Brake Inspection) and "Who does it?". Type a Custom job name that is not in the catalog. "Add to Work Plan".',
        say: 'Each finding becomes a Job with an owner. A Custom Job is accepted and marked for review, so the catalog stays clean.',
        expect: 'The Jobs are in the plan; the next step asks to assign the one without an owner.', mutates: true },
      { user: manager, target: { kind: 'adminTruck', unit: '602' }, title: 'Findings from two days ago',
        do: 'Look at 602: inspected two days ago, Brake Inspection and Lights still without an owner.',
        say: 'Open more than 24 hours and with unassigned Jobs: the Dashboard flags it until someone owns each Job.',
        expect: 'Two Jobs unassigned on 602.' },
      { user: manager, target: { kind: 'path', path: '/admin/catalog/review' }, title: 'Custom Jobs to review',
        do: '"Check Engine Light" was typed three ways on three Work Orders; "Looks like" offers to tie it to Engine Repair. The Custom Job you just added on 601 is here too. One tap: Tie, Add to catalog, or Keep as one-off.',
        say: 'Custom names pile up here grouped by spelling. One tap settles the whole group and the old name becomes an alias.',
        expect: '"Check Engine Light" first, with "Looks like: Tie to Engine Repair".' },
    ],
  },
  {
    id: 'HU-M3', title: 'Split the work', who: 'MS', jtbd: 'J2', role: 'Manager', trucks: ['602'],
    steps: [
      { user: manager, target: { kind: 'path', path: '/admin' }, title: 'Unassigned on the Dashboard',
        do: 'Tap the "Unassigned" counter: 602 says "Nobody is assigned to Brake Inspection", with Assign right on the row.',
        say: 'A Job without an owner cannot be done by anyone, so it waits in the Manager\'s queue until someone owns it.',
        expect: '602 in the Unassigned group.' },
      { user: manager, target: { kind: 'adminWorkOrder', unit: '602' }, title: 'One owner per Job',
        do: 'In the Jobs table tap "Assign" on Brake Inspection and on Lights and pick a mechanic.',
        say: 'The table is Job · Mechanic · Status · Action. The Work Order team is simply everyone who owns a Job.',
        expect: 'Both Jobs now have an owner.', mutates: true },
      { user: manager, target: { kind: 'adminWorkOrder', unit: '602' }, title: 'The rules behind the selector',
        do: 'Open the selector again: PM mechanics and Safety do not appear for a standard Job.',
        say: 'A PM mechanic cannot take a standard Job, Safety only takes Quality Check, inactive people never show. The server enforces it too.',
        expect: 'Only standard mechanics listed.' },
    ],
  },
  {
    id: 'HU-M4', title: 'Unblock a truck', who: 'MS', jtbd: 'J3', role: 'Manager', trucks: ['605', '609'],
    steps: [
      { user: manager, target: { kind: 'path', path: '/admin' }, title: 'Blocked or paused',
        do: 'Read the "Blocked or paused" group at the top of "Needs you": 605 blocked (Waiting for Parts, MG2, two days), 609 paused, 922 returned by Safety. Each row has its action (Resolve, Resume).',
        say: 'Blocked and paused trucks come first, with who, why and since when. Nothing to chase on the floor.',
        expect: '605 Critical, blocked by MG2; 609 paused.' },
      { user: manager, target: { kind: 'adminTruck', unit: '605' }, title: 'Resolve the blocker',
        do: 'Tap "Resolve" in the next-step box, write a note for the mechanic ("part arrived"), "Confirm resolve".',
        say: 'The Job goes back to MG2. Their clock does not start by itself: it runs when they tap Continue.',
        expect: 'Next step: "Mechanics are working".', mutates: true },
      { user: 'MG2', target: { kind: 'path', path: '/mechanic/standard' }, title: 'What MG2 sees',
        do: 'Look at the 605 card: "Resolved · tap Continue".',
        say: 'The mechanic learns it on his phone, without a call.',
        expect: '605 back in MG2\'s work with Continue.' },
      { user: manager, target: { kind: 'adminWorkOrder', unit: '609' }, title: 'Pause and Resume',
        do: 'Tap "Resume" next to the title. (Pause asks for a reason; "Other" needs a note.)',
        say: 'Pause is for the whole truck (waiting for approval here). Resume reopens the clocks of the same mechanics that were running.',
        expect: '"In Progress"; the Pause button is back.', mutates: true },
    ],
  },
  {
    id: 'HU-M5', title: 'Close and return to service', who: 'MS', jtbd: 'J4', role: 'Manager', trucks: ['931', '607', '606'],
    steps: [
      { user: manager, target: { kind: 'path', path: '/admin' }, title: 'Ready to close',
        do: 'Tap the "Ready to close" counter: 931 is there, QC approved by Safety.',
        say: 'When Safety approves, the truck moves to the Manager\'s close list.',
        expect: '931 under Ready to close.' },
      { user: manager, target: { kind: 'adminWorkOrder', unit: '931' }, title: 'Close the Work Order',
        do: 'Tap "Confirm completion", then "Close Work Order" in the dialog.',
        say: 'Closing needs every Job done or cancelled. The truck becomes Ready to Go and stays on the Yard until it actually leaves.',
        expect: '"Completed"; next step "Return the truck to service".', mutates: true },
      { user: manager, target: { kind: 'adminTruck', unit: '607' }, title: 'Return to Service',
        do: 'Tap "Return to Service", reason optional, "Confirm Return to Service".',
        say: 'Hours or days later, when the truck leaves the yard. It drops off the board; a new visit opens a new Work Order, never a reopen.',
        expect: '607 "In Service", with no open Work Order.', mutates: true },
      { user: manager, target: { kind: 'adminTruck', unit: '606' }, title: 'QC as backup',
        do: 'Show "Next step · Waiting for Safety" with "Open Quality Check" and the "Mark QC complete" backup. Do not tap it: HU-QC1 uses 606.',
        say: 'Safety normally does this from its own screen. The Manager keeps a backup for days without Safety.',
        expect: '606: "Waiting for Safety".' },
    ],
  },
  {
    id: 'HU-M6', title: 'Cancel and reopen', who: 'MS', jtbd: 'J4', role: 'Manager', trucks: ['613', '615'],
    steps: [
      { user: manager, target: { kind: 'adminWorkOrder', unit: '613' }, title: 'A cancelled Job',
        do: 'Find Lights under "Done and cancelled" with its reason. The "…" of a cancelled Job has "Reopen job".',
        say: 'A cancelled mandatory step counts as "does not apply". Reopening puts it back as pending with its owner.',
        expect: 'Lights cancelled with a reason.' },
      { user: manager, target: { kind: 'path', path: '/admin/history?status=cancelled' }, title: 'A cancelled Work Order',
        do: 'History filtered by Cancelled: WO-071 of 615. Open it: "This Work Order was cancelled" with its reason, and "Reopen it from …".',
        say: 'Cancelling stops clocks and pauses and needs a reason. The truck is free for a new Work Order.',
        expect: 'WO-071 · Truck 615 · Cancelled.' },
      { user: manager, target: { kind: 'adminWorkOrder', unit: '613' }, title: 'Everything leaves a trace',
        do: 'Scroll to History at the bottom of the Work Order: Activity lists who did what and when ("MS · Manager Shop cancelled Lights"); Times and Pauses are there too.',
        say: 'Every change has who, when and the reason. Nothing is deleted.',
        expect: '"MS · Manager Shop cancelled Lights" in Activity.' },
    ],
  },
  {
    id: 'HU-M7', title: 'See the whole shop', who: 'MS', jtbd: 'J5', role: 'Manager', trucks: [],
    note: 'Dispatch, Movement and "Leaving soon" come from agent-reporting, which is not connected locally; that tab says it did not answer.',
    steps: [
      { user: manager, target: { kind: 'path', path: '/admin' }, title: 'Operations',
        do: 'Walk the four counters (Blocked or paused, Ready to close, Ready to Go, Unassigned) and the groups of "Needs you": also Inspection to record, Missing required steps, Waiting for Safety and Work requests.',
        say: 'Everything that waits for the Manager, grouped by the action, each row done right here.',
        expect: 'Counters with numbers; queue grouped.' },
      { user: manager, target: { kind: 'path', path: '/admin/yard-operations' }, title: 'Yard board',
        do: 'Show the lists by step: Inspection, Shop Work, PM, Alignment, Detailing, Quality Check, Ready to Go. Filter "Out of shop": 611. Try Full screen.',
        say: 'One card per truck with work, in the step it is on, Trello style. Physical presence is never invented.',
        expect: '611: "Out of shop · Air Bag Replacement".' },
      { user: manager, target: { kind: 'path', path: '/admin/yard-operations?tab=movement' }, title: 'Dispatch tab',
        do: 'Open the Dispatch tab: Incoming Trucks, Upcoming Departures and Dispatch status come from Dispatch.',
        say: 'Locally the Dispatch gateway is not connected, so each card says "Data unavailable" instead of showing invented lists.',
        expect: '"Data unavailable" on each card.' },
      { user: manager, target: { kind: 'path', path: '/admin/work-orders' }, title: 'Work Orders list',
        do: 'Filter by status or priority, search a truck or a mechanic. Each row: next step (the same as the Truck), status, Jobs progress and mechanics.',
        say: 'Every Work Order, open and closed, in one list.',
        expect: 'Open and recently closed Work Orders with their progress.' },
      { user: manager, target: { kind: 'path', path: '/admin/trucks' }, title: 'Trucks list',
        do: 'Each truck with its open Work Order and next step; a Ready to Go truck says "Ready to Go. Return it to service when it leaves the shop."',
        say: 'From any list you reach the truck and its plan in one tap.',
        expect: 'Trucks with their "Next step".' },
    ],
  },
  {
    id: 'HU-M8', title: 'Set up the shop workflow', who: 'MS', jtbd: 'J2', role: 'Manager', trucks: ['957'],
    steps: [
      { user: manager, target: { kind: 'path', path: '/admin/setup/workflow' }, title: 'Steps and teams',
        do: 'Show the four steps and their teams: PM → MPM and Alignment → MA (a team of one: new Jobs go straight to them), Detailing → MD and MG1 (a team of two: the Job waits in the team queue), Quality Check → Safety.',
        say: 'Changes apply to new Work Orders. PM takes PM mechanics only; the Manager can still assign any Job directly.',
        expect: '"New PM Jobs are assigned to MPM · Mecánico PM"; Detailing with two members.' },
      { user: manager, target: { kind: 'adminTruck', unit: '957' }, title: 'A Job born in the team queue',
        do: 'Detailing shows "Assign", but the next step does not flag it ("Mechanics are working"): it waits in the team queue.',
        say: 'With a team, the first one who takes the Job becomes its owner.',
        expect: 'Next step "Mechanics are working"; Detailing without an owner.' },
      { user: 'MG1', target: { kind: 'path', path: '/mechanic/standard' }, title: 'Team queue on the phone',
        do: 'Show "Team queue · 1" with 957 Detailing. Do not take it: leave it for MD.',
        say: 'Both see it; taking it removes it from the other\'s queue. "Let go" returns it unless the clock runs there.',
        expect: '"Team queue" with 957 Detailing and Take.' },
      { user: manager, target: { kind: 'path', path: '/admin/setup/workflow/hours' }, title: 'Shop hours',
        do: 'Show "Day close (Eastern time)" at 5:00 PM and the workdays.',
        say: 'Clocks still running at 5:00 PM close by themselves and count until 5:00 (HU-ME5).',
        expect: 'Day close and workdays.' },
    ],
  },
  {
    id: 'HU-M9', title: 'Add staff', who: 'MS', jtbd: 'J12', role: 'Manager', trucks: [],
    note: 'Temporary passwords and "Remove from Shop" need Supabase Auth; locally a new person is created without an access account and the app says so.',
    steps: [
      { user: manager, target: { kind: 'path', path: '/admin/mechanics' }, title: 'People',
        do: 'Show the list: type (Standard, PM, Safety (Quality Check), System Admin), teams and pending Jobs of each person.',
        say: 'The Manager adds, deactivates, resets passwords and removes people without IT.',
        expect: 'Each person with type, teams and pending Jobs.' },
      { user: manager, target: { kind: 'path', path: '/admin/mechanics' }, title: 'Inactive people',
        do: 'In "Show" pick "Active and inactive" and "Apply filters": MG4 appears as Inactive, with Activate.',
        say: 'Deactivating keeps the history; someone with open Jobs cannot be deactivated until they are reassigned.',
        expect: 'MG4: Inactive.' },
      { user: manager, target: { kind: 'path', path: '/admin/mechanics' }, title: 'Add a person',
        do: 'Tap "Add person": name, email, type, Create. (Optional; locally it says "no access account".)',
        say: 'In production the app creates the login and shows a temporary password once; the person must change it on first sign-in.',
        mutates: true },
    ],
  },
  {
    id: 'HU-M10', title: 'A helper on a Job', who: 'MS', jtbd: 'J2', role: 'Manager', trucks: ['612'],
    steps: [
      { user: manager, target: { kind: 'adminWorkOrder', unit: '612' }, title: 'A helper Job',
        do: 'Find "Brake Inspection · helper" under the main Job. The "…" of a pending standard Job has "Add helper".',
        say: 'A helper gets a Job of their own: it shows in their Jobs and their clock runs under their name.',
        expect: '"Brake Inspection · helper", "Helps MG1", owned by MD.' },
      { user: 'MD', target: { kind: 'path', path: '/mechanic/standard' }, title: 'The helper\'s view',
        do: 'Show the 612 card with the helper Job.',
        say: 'Same screen as any Job: Start, Complete, blocker. If the main Job is cancelled, the helper\'s is decided by the Manager.',
        expect: '612 under Ready to Start with "Brake Inspection · helper".' },
    ],
  },
  {
    id: 'HU-M11', title: 'Send work to an outside shop', who: 'MS', jtbd: 'J3', role: 'Manager', trucks: ['610', '611'],
    steps: [
      { user: manager, target: { kind: 'adminWorkOrder', unit: '610' }, title: 'The part goes out',
        do: 'Find Battery: "Part out" with its note, "At external shop" and "Returned". Do not tap Returned.',
        say: 'From the Job "…": Send to external shop, part or truck, with a note. The Job keeps no owner and no clock meanwhile.',
        expect: 'Battery: Part out · At external shop.' },
      { user: manager, target: { kind: 'path', path: '/admin/yard-operations' }, title: 'The truck goes out',
        do: 'Find 611: "Out of shop".',
        say: 'When the whole truck leaves, the Yard says so and it cannot become Ready to Go.',
        expect: '611 Out of shop.' },
      { user: manager, target: { kind: 'adminWorkOrder', unit: '611' }, title: 'Invoice tied to the Job',
        do: 'Open the external Job: "Invoice $… · Bay Area Body Shop".',
        say: 'The outside repair invoice is tied to the Job, so the cost lands on the truck.',
        expect: '"Invoice $685.00 · Bay Area Body Shop" and "Truck out" on Air Bag Replacement.' },
      { user: manager, target: { kind: 'path', path: '/admin/parts/outside-repairs' }, title: 'Outside repairs',
        do: 'Show the four outside repairs; the 611 one is tied to Air Bag Replacement · WO-067.',
        say: 'Every outside repair with vendor, date, cost and file. Correcting or voiding never deletes: it reverses.',
        expect: 'Four outside repairs; 611 for $685.00.' },
      { user: manager, target: { kind: 'path', path: '/admin/parts/outside-repairs' }, title: 'Load an outside repair',
        do: 'Tap "New outside repair". Truck 612, vendor Diesel Pro Repair, today\'s date, any invoice number (for example your initials and the time), Job "Not linked", what was done "DPF cleaning", amount 420. Save.',
        say: 'A repair that did not come from a Work Order still lands on the truck\'s cost. The same invoice number for a vendor is refused, so nothing is loaded twice.',
        expect: 'A toast with the total; the repair at the top of the list for 612.',
        mutates: true },
    ],
  },
  {
    id: 'HU-M12', title: 'What each truck costs', who: 'MS', jtbd: 'J13', role: 'Manager', trucks: ['611'],
    steps: [
      { user: manager, target: { kind: 'path', path: '/admin/parts/catalog' }, title: 'Parts',
        do: 'Show a part with its reference cost, usual vendor, the trucks it fits, how many PMs used it and the last price paid.',
        say: 'The same catalog the PM mechanic picks from; the mechanic never sees the cost.',
        expect: 'Parts with reference prices.' },
      { user: manager, target: { kind: 'path', path: '/admin/parts/vendors' }, title: 'Vendors',
        do: 'Show the vendors; Old Supply Co is inactive.',
        expect: 'Six vendors; Old Supply Co inactive.' },
      { user: manager, target: { kind: 'path', path: '/admin/parts/purchases' }, title: 'Purchases',
        do: 'Open a purchase with several lines; show the one marked "Voided".',
        say: 'Lines split per truck; the same invoice number for a vendor is refused; voiding needs a reason and reverses the cost.',
        expect: 'About 45 purchases, one Voided.' },
      { user: manager, target: { kind: 'path', path: '/admin/parts/outside-repairs' }, title: 'Outside repairs',
        do: 'Show the transmission rebuild tied to a Job (Diesel Pro, truck 615) and the two repairs not linked to a Job.',
        expect: 'Four outside repairs.' },
      { user: manager, target: { kind: 'adminTruck', unit: '611', tab: 'costs' }, title: 'Truck → Costs',
        do: 'Change the period (This month, Last 3 months, This year, All time). Show Parts, Outside repairs and Total, the bars per month, and the movements: the body shop repair and the voided purchase as a negative reversal.',
        say: 'Reversals appear negative and lower the total; nothing is deleted.',
        expect: 'Outside repair $685.00; the voided TruckPro purchase as -$189.00 (its number changes with each build).' },
      { user: manager, target: { kind: 'path', path: '/admin/parts/purchases' }, title: 'Load a purchase',
        do: 'Tap "New purchase". Vendor FleetPride, today\'s date, any invoice number (for example your initials and the time), Truck 605. Line 1: a part from the catalog, qty 2. "Add line": a second part, qty 1. Tax 12, Freight 25. Save purchase.',
        say: 'The invoice as it comes from the vendor: lines from the catalog, tax and freight, charged to the truck. A line can go to another truck or to shop stock.',
        expect: 'A toast with the total; the purchase at the top of the list.',
        mutates: true },
      { user: manager, target: { kind: 'adminTruck', unit: '605', tab: 'costs' }, title: 'The purchase on the truck',
        do: 'Choose "This month": the FleetPride purchase you just loaded is a Parts movement, and the Total went up by it.',
        say: 'No one types the cost twice: the purchase is the truck\'s cost. The mechanic never sees prices.',
        expect: 'The new FleetPride purchase among the Parts movements of this month.' },
    ],
  },
  {
    id: 'HU-M13', title: 'Charge Finance', who: 'MS', jtbd: 'J14', role: 'Manager', trucks: ['603'],
    steps: [
      { user: manager, target: { kind: 'path', path: '/admin/parts/labor-rate' }, title: 'Labor rate',
        do: 'Show $95/h and $105/h from the 1st of this month.',
        say: 'Labor is hours × the rate of the day the work was done. Changing the rate from a date never rewrites the past.',
        expect: 'Two rates with their dates.' },
      { user: manager, target: { kind: 'adminTruck', unit: '603', tab: 'costs' }, title: 'Labor on the truck',
        do: 'Find the labor movement "WO-037 · … h × $95.00/h": the hours of a closed Work Order at the rate of that day.',
        say: 'Each closed Work Order puts its labor on the truck\'s cost.',
        expect: 'A Labor movement with hours × $95.00/h.' },
      { user: manager, target: { kind: 'path', path: '/admin/parts/internal-invoices' }, title: 'Internal invoices',
        do: 'Show accepted, sent, voided and draft invoices. Numbers are SHOP-YYYY-NNNN.',
        say: 'One invoice per truck and month with what was not charged yet: parts at cost, outside repairs, labor.',
        expect: 'Five invoices: Accepted, Sent, Voided and a Draft.' },
      { user: manager, target: { kind: 'path', path: '/admin/parts/internal-invoices' }, title: 'Send and download',
        do: 'Open the Draft (Truck 603, this month): remove a line (it waits for the next invoice), Send, download the PDF. Optional.',
        say: 'Finance receives the PDF; it does not enter the app. When they accept, the Manager marks it Accepted.',
        mutates: true },
      { user: manager, target: { kind: 'path', path: '/admin/parts/internal-invoices' }, title: 'Month close',
        do: 'Look at "Month close" at the top: last month is chosen. Each row is a truck with what it has not been charged yet, and its invoice for the month if it has one.',
        say: 'Month end on one screen: every truck with costs not charged yet (parts, outside repairs, labor), and which ones already have their invoice.',
        expect: '"Month close" with a line "… trucks to charge · … not charged yet · … already invoiced" and one row per truck.' },
      { user: manager, target: { kind: 'path', path: '/admin/parts/internal-invoices' }, title: 'One draft',
        do: 'On one truck row, tap "Make draft".',
        say: 'The draft brings everything the truck has not been charged yet up to the end of the month. Nothing is sent yet.',
        expect: 'That row now shows a Draft with its total.',
        mutates: true },
      { user: manager, target: { kind: 'path', path: '/admin/parts/internal-invoices' }, title: 'Drafts for all',
        do: 'Tap "Create drafts for all (…)".',
        say: 'One tap makes the missing drafts of the month. Each one is still reviewed and sent per truck.',
        expect: 'A toast "… drafts created"; every row has its Draft.',
        mutates: true },
    ],
  },
  {
    id: 'HU-ME1', title: 'See my work', who: 'Mechanics', jtbd: 'J6', role: 'Standard mechanic', trucks: ['604', '957'],
    steps: [
      { user: 'MG1', target: { kind: 'path', path: '/mechanic/standard' }, title: 'My Assigned Work',
        do: 'Read the clock strip ("Your clock · Truck 604 · since …"), the Team queue with 957, In Progress (604, "Clock running") and Ready to Start.',
        say: 'Only what is mine. One main button: the truck where my clock runs or the next Job.',
        expect: 'Clock running on 604.' },
      { user: 'MG1', target: { kind: 'workOrder', unit: '604' }, title: 'A Work Order, mechanic view',
        do: 'Show "Your Jobs N of M done · Your time", your Jobs, and "Other work on this Truck" folded.',
        say: 'My time only. What others do on the same truck is read-only.',
        expect: 'Your time counting.' },
      { user: 'MG1', target: { kind: 'path', path: '/mechanic/standard/trucks' }, title: 'Trucks tab',
        do: 'Type 605 in "Find a Truck" and tap "View truck repair history".',
        say: 'Any mechanic can look up what was done to a truck before, filtered by category.',
        expect: '"Find a Truck"; 605 shows "Open WO-061".' },
      { user: 'MG1', target: { kind: 'path', path: '/mechanic/standard/completed' }, title: 'Completed',
        do: 'Show the Jobs he completed, grouped by day (Today, Yesterday, Earlier), each with time, truck, Work Order and his closing note.',
        say: '"When did I finish that and what did I write?" is answered here.',
        expect: 'MG1: ten Jobs under "Earlier", each with its note.' },
    ],
  },
  {
    id: 'HU-ME2', title: 'Work and finish', who: 'Mechanics', jtbd: 'J7', role: 'Standard mechanic', trucks: ['603'],
    steps: [
      { user: 'MA', target: { kind: 'path', path: '/mechanic/standard' }, title: 'A Job ready to start',
        do: 'Find 603 under "Ready to Start": Alignment, with "Start Work".',
        say: 'MA does the alignments of every truck. Their clock is stopped right now ("Your clock is stopped").',
        expect: '603 under Ready to Start.' },
      { user: 'MA', target: { kind: 'workOrder', unit: '603' }, title: 'Start',
        do: 'Tap "Start Work". The clock strip now says "Your clock · Truck 603".',
        say: 'Start puts the Work Order in progress and starts his clock only.',
        expect: 'Your clock · Truck 603.', mutates: true },
      { user: 'MA', target: { kind: 'workOrder', unit: '603' }, title: 'Complete',
        do: 'Tap "Complete job", write the completion note, confirm. The sheet warns "This is your last Job here: your clock stops."',
        say: 'Completing the last Job stops the clock; the Work Order stays open for the other steps.',
        expect: '"You finished your part on Truck 603."', mutates: true },
    ],
  },
  {
    id: 'HU-ME3', title: 'Report a blocker', who: 'Mechanics', jtbd: 'J8', role: 'Standard mechanic', trucks: ['605'],
    note: 'HU-M4 resolves the same blocker on 605. Run one or the other, or rebuild the demo between them.',
    steps: [
      { user: 'MG2', target: { kind: 'path', path: '/mechanic/standard' }, title: 'Blocked, waiting on the Manager',
        do: 'Show the 605 card under "Blocked · waiting on the Manager".',
        say: 'MG2 reported "waiting for parts" with a note. Their clock stopped because it was their only Job.',
        expect: '605 blocked.' },
      { user: 'MG2', target: { kind: 'workOrder', unit: '605' }, title: 'The blocker',
        do: 'Show the blocker: reason, who and since when, his two notes, and "Add note" (for example "the part arrived"). Only the Manager resolves it.',
        say: 'Reasons: parts, approval, vendor, equipment, bay, driver, other ("Other" needs a note). Break, end of shift or "another truck" are not blockers. The Work Order is not paused: the rest of the truck keeps going.',
        expect: '"Air Bag Replacement · Waiting for Parts" with MG2\'s two notes.' },
      { user: manager, target: { kind: 'adminTruck', unit: '605' }, title: 'Manager resolves',
        do: 'Tap "Resolve", note for the mechanic optional, "Confirm resolve".',
        expect: 'Next step: "Mechanics are working".', mutates: true },
      { user: 'MG2', target: { kind: 'path', path: '/mechanic/standard' }, title: '"Resolved · tap Continue"',
        do: 'Show the 605 card and tap Continue.',
        say: 'The clock never restarts by itself.',
        expect: '605: "Resolved · tap Continue".', mutates: true },
    ],
  },
  {
    id: 'HU-ME4', title: 'Notes and work requests', who: 'Mechanics', jtbd: 'J7', role: 'Standard mechanic', trucks: ['613'],
    steps: [
      { user: 'MG1', target: { kind: 'workOrder', unit: '613' }, title: 'Leave a note, request work',
        do: 'Write a note and "Add Note". Then "Request Work" → "What does the Truck need?" → "Send to Manager". His earlier request is there too, "Waiting for Manager".',
        say: 'What is typed and not sent stays on the phone. The request reaches the Manager\'s Dashboard.',
        expect: 'The request shows "Waiting for Manager".', mutates: true },
      { user: manager, target: { kind: 'adminWorkOrder', unit: '613' }, title: 'Mark handled',
        do: 'In Notes, "Mark handled" on MG1\'s request.',
        say: 'Handled requests keep their date; the Manager adds the Job if it is real work.',
        expect: '"Handled by MS · Manager Shop" with the date.', mutates: true },
      { user: manager, target: { kind: 'path', path: '/admin' }, title: 'Requests on the Dashboard',
        do: 'Scroll to "Work requests" at the end of "Needs you": open requests with "Open Work Order" and "Mark handled".',
        expect: 'The "Work requests" group.' },
    ],
  },
  {
    id: 'HU-ME5', title: 'The day closes by itself', who: 'Mechanics', jtbd: 'J7', role: 'Standard mechanic', trucks: ['944'],
    note: 'The day close happens at 5:00 PM; the demo shows its result on 944 (MG3 left yesterday with their clock running). Rebuild the demo in the morning.',
    steps: [
      { user: 'MG3', target: { kind: 'path', path: '/mechanic/standard' }, title: '"Yesterday\'s work is still open"',
        do: 'Show the 944 card: "Yesterday\'s work is still open · tap Continue".',
        say: 'At 5:00 PM the app closed his clock; the time counts until 5:00. Today he taps Continue.',
        expect: '944: "Yesterday\'s work is still open · tap Continue".' },
      { user: 'MG3', target: { kind: 'workOrder', unit: '944' }, title: 'His time',
        do: 'Show "Your time": yesterday\'s hours, until 5:00 PM, are already there and stopped.',
        expect: '"Your time" with yesterday\'s hours, stopped.' },
      { user: manager, target: { kind: 'adminWorkOrder', unit: '944' }, title: 'History › Times',
        do: 'Open History › Times: MG3\'s segment ends at 5:00 PM, marked "Day close", with "Correct…".',
        say: 'A closed segment can be corrected with a reason if the mechanic left earlier.',
        expect: '"→ 5:00 PM" with "Day close".' },
      { user: manager, target: { kind: 'path', path: '/admin/setup/workflow/hours' }, title: 'Where it is configured',
        do: 'Show the day close time and days.',
        expect: 'Day close (Eastern time) and workdays.' },
    ],
  },
  {
    id: 'HU-ME6', title: 'One clock across trucks', who: 'Mechanics', jtbd: 'J7', role: 'Standard mechanic', trucks: ['604', '612'],
    note: 'Moves MG1\'s clock off 604. Run HU-ME1 before this one.',
    steps: [
      { user: 'MG1', target: { kind: 'path', path: '/mechanic/standard' }, title: 'Clock on 604',
        do: 'Read the strip: "Your clock · Truck 604".',
        expect: 'Clock on 604.' },
      { user: 'MG1', target: { kind: 'workOrder', unit: '612' }, title: 'Start on another truck',
        do: 'Tap "Start Work" on 612. The notice says "Your clock moved from Truck 604 to Truck 612."',
        say: 'One clock per mechanic. Starting on a second truck closes the segment on the first ("switched truck").',
        expect: 'Your clock · Truck 612.', mutates: true },
      { user: 'MG1', target: { kind: 'path', path: '/mechanic/standard' }, title: 'Back to the first truck',
        do: 'Show the 604 card: "Your clock is on Truck 612 · tap Continue".',
        say: 'Returning to 604 is just Continue; nobody has to reassign anything.',
        expect: '604 with Continue.' },
    ],
  },
  {
    id: 'HU-PM1', title: 'Record a PM', who: 'MPM', jtbd: 'J9', role: 'PM mechanic', trucks: ['968', '603'],
    steps: [
      { user: 'MPM', target: { kind: 'path', path: '/mechanic/pm' }, title: 'PM home',
        do: 'Show "Active PM services" (968), "Waiting for PM" most urgent first with "Last PM: miles · date" on each truck, and "Paused PM services" (609).',
        say: 'One PM at a time: the screen says so before you tap another truck.',
        expect: '968 active; nine waiting; 609 paused.' },
      { user: 'MPM', target: { kind: 'workOrder', unit: '968', view: 'pm' }, title: 'Mileage, parts, Finish',
        do: 'The mileage is already in (210,000 mi). Turn on a part ("Turn on what you changed"): the most used part for this model comes chosen. The bar at the bottom says what is missing, then "Ready to finish". Finish PM is optional.',
        say: 'Mileage lower than the truck\'s is refused; a jump over 50,000 asks to confirm. Finish needs mileage and at least one part. Everything saves by itself; the odometer updates on Finish.',
        expect: '"Most used on this model · 18 of 18 PMs"; "Ready to finish · 210,000 mi · 1 part".', mutates: true },
      { user: 'MPM', target: { kind: 'path', path: '/mechanic/pm/trucks' }, title: 'Trucks tab',
        do: 'Type a truck number in "Find a Truck" and open its repair history.',
        say: 'Same lookup as the general mechanics: past PMs with their mileage and parts.',
        expect: 'The "Find a Truck" search.' },
      { user: 'MPM', target: { kind: 'path', path: '/mechanic/pm/new' }, title: 'Create PM service',
        do: 'With 968 open the screen says so first and offers "Continue PM on Truck 968". (After Finish PM, picking a truck shows what will happen: create, "Add PM to WO-…", continue.)',
        say: 'One PM at a time. A truck without a Work Order gets a complete one with the four steps.',
        expect: '"You have a PM service in progress on Truck 968 (WO-079). Finish it before starting another."' },
    ],
  },
  {
    id: 'HU-QC1', title: 'Approve or return a truck', who: 'QC', jtbd: 'J11', role: 'Safety', trucks: ['616', '617', '606', '905', '922', '931'],
    steps: [
      { user: 'QC1', target: { kind: 'path', path: '/qc' }, title: 'To review, most urgent first',
        do: 'Read the order: 616 (Critical), 617 (High), 606; 905 shows "Taken by QC2".',
        say: 'Only trucks where everything else is done. Critical first, then the one waiting longest.',
        expect: '616 first.' },
      { user: 'QC1', target: { kind: 'path', path: '/qc' }, title: 'Take and review',
        do: 'Tap Take on 616: the card says "Yours". Tap "Continue review": the sheet shows each Job with who, when and the note, the PM (mileage and parts), the inspection, past blockers and returns.',
        say: 'Two Safety people: the first who takes it wins; the other sees it taken. "Let go" frees it.',
        expect: 'Review of 616 open.', mutates: true },
      { user: 'QC1', target: { kind: 'path', path: '/qc' }, title: 'Approve or Return',
        do: 'Approve (it asks "Approve Truck 616?") or Return with what you found, optionally naming the Job.',
        say: 'Approved: the Manager sees "ready to close". Returned: the Manager sees a "Returned by Safety" blocker with the note.',
        expect: '616 leaves To review.', mutates: true },
      { user: 'QC1', target: { kind: 'path', path: '/qc?tab=returned' }, title: 'Returned',
        do: 'Show 922, returned by QC1 with "Alignment: …".',
        say: 'Nobody can take it until the Manager resolves and the mechanics finish.',
        expect: '922 in Returned.' },
      { user: 'QC1', target: { kind: 'path', path: '/qc?tab=done' }, title: 'Done',
        do: 'Show the last 7 days.',
        say: '"Did I already review the 606?" is answered here.',
        expect: 'Approved and returned trucks.' },
      { user: 'QC2', target: { kind: 'path', path: '/qc' }, title: 'The other Safety',
        do: 'Show 905 marked "Yours" with "Continue review"; inside, "Let go" frees it for QC1.',
        expect: '905: Yours.' },
      { user: manager, target: { kind: 'path', path: '/qc' }, title: 'Manager as backup',
        do: 'Show the strip "You\'re doing Quality Check as backup for Safety".',
        say: 'With no Safety available the Manager can take, approve or return here; it is recorded as backup.',
        expect: 'The Safety backup strip.' },
    ],
  },
  {
    id: 'HU-A1', title: 'Correct a mechanic\'s time', who: 'AS', jtbd: 'J10', role: 'System Admin', trucks: ['617'],
    steps: [
      { user: 'AS', target: { kind: 'adminWorkOrder', unit: '617' }, title: 'History › Times › Correct…',
        do: 'Open History › Times: each closed segment has "Correct…". Pick one: corrected start or end, and the reason (required). "Apply time correction" is optional.',
        say: 'Only closed segments; the reason is required; the total recalculates and the original stays in history.',
        expect: 'Closed segments with Correct…', mutates: true },
      { user: 'AS', target: { kind: 'adminWorkOrder', unit: '617' }, title: 'Labor by mechanic',
        do: 'Show "Labor by mechanic": time per mechanic on this Work Order.',
        say: 'Time per mechanic feeds the truck\'s labor cost (HU-M13).',
        expect: 'Labor by mechanic list.' },
    ],
  },
  {
    id: 'HU-A2', title: 'Catalog and people', who: 'AS', jtbd: null, role: 'System Admin', trucks: [],
    steps: [
      { user: 'AS', target: { kind: 'path', path: '/admin/catalog' }, title: 'Job Catalog',
        do: 'Search "engine" (Jobs and aliases). Open a category. PM, Detailing and Quality Check carry the "Shop workflow" tag: their Jobs cannot be deactivated or deleted.',
        say: 'Manager and System Admin edit the catalog. A Job already used in Work Orders cannot be deleted, only deactivated.',
        expect: 'Categories with Job counts and "Custom Jobs to review".' },
      { user: 'AS', target: { kind: 'path', path: '/admin/catalog/review' }, title: 'Custom Jobs to review',
        do: 'Show the inbox and the Reviewed tab with Undo.',
        expect: 'Inbox with groups.' },
      { user: 'AS', target: { kind: 'path', path: '/admin/mechanics' }, title: 'People',
        do: 'Open a person: deactivate, reset password, remove from Shop, delete (only if never used).',
        say: 'Same as the Manager; the System Admin also has every mechanic workspace for testing.',
        expect: 'People list.' },
    ],
  },
];

/**
 * D39 (DP2): what each step lights up, by story and step number (from 0). Texts are the English labels on screen;
 * a step without an entry shows only the panel. The demo e2e walks the flow and checks every light is found.
 */
const SPOTLIGHTS: Partial<Record<`${DemoStoryId}#${number}`, DemoSpotlight>> = {
  'HU-ME5#0': { text: "Yesterday's work is still open", contains: true, hint: 'Yesterday\'s work on 944 is still open: this card says so.' },
  'HU-ME5#1': { text: 'Your time', contains: true, hint: 'Yesterday\'s hours are already here, stopped at 5:00 PM.' },
  'HU-M1#0': { text: '973', contains: true, selector: 'tr, [role="row"], li', hint: 'Truck 973: In Service, no open Work Order.' },
  'HU-M1#1': { text: 'New Work Order', hint: 'Tap "New Work Order": the truck\'s work starts here.', then: { text: 'Create Work Order', hint: 'Pick a priority, add a note if you like, then "Create Work Order".' } },
  'HU-M1#2': { text: 'Work Plan', contains: true, selector: 'h2, h3, [data-testid]', hint: 'The plan is ready: each step already has its mechanic or team.' },
  'HU-M2#0': { text: 'Issues found', hint: 'Tap "Issues found": the inspection found work to add.' },
  'HU-M2#1': { text: 'Add to Work Plan', hint: 'Pick a category and a Job, who does it, then "Add to Work Plan".' },
  'HU-M2#2': { text: 'Brake Inspection', contains: true, hint: 'Found two days ago and still without an owner.' },
  'HU-M3#1': { text: 'Assign', hint: 'Tap "Assign" and pick a mechanic. Then the same on Lights.' },
  'HU-M3#2': { text: 'Assign', hint: 'Open the selector again: PM mechanics and Safety are not offered for this Job.' },
  'HU-ME1#0': { text: 'Your clock', contains: true, hint: 'Your clock, then the Team queue, In Progress and Ready to Start.' },
  'HU-ME1#1': { text: 'Your Jobs', contains: true, hint: 'Your Jobs on this truck and your time.' },
  'HU-ME4#0': { text: 'Request Work', hint: 'Add a note first if you like, then "Request Work" to ask the Manager for more work.', then: { text: 'Send to Manager', hint: 'Say what the Truck needs, then "Send to Manager".' } },
  'HU-ME3#0': { text: 'Blocked', contains: true, hint: '605 is blocked, waiting on the Manager.' },
  'HU-ME3#1': { text: 'Add note', hint: 'The blocker with its reason. A note tells the Manager what changed.' },
  'HU-ME3#2': { text: 'Resolve', hint: 'Tap "Resolve": the blocker reported by MG2 ends here.', then: { text: 'Confirm resolve', hint: 'A note for the mechanic is optional. Then "Confirm resolve".' } },
  'HU-ME3#3': { text: 'Continue', hint: '605 is unblocked: tap Continue.' },
  'HU-M4#3': { text: 'Resume', hint: 'Tap "Resume": the Work Order goes on.' },
  'HU-M6#0': { text: 'Done and cancelled', contains: true, hint: 'Lights was cancelled, with its reason; its "…" menu can reopen it.' },
  'HU-M6#1': { text: 'WO-071', contains: true, hint: 'Open WO-071: a cancelled Work Order and its reason.' },
  'HU-ME2#0': { text: 'Start Work', hint: '603 Alignment is ready to start.' },
  'HU-ME2#1': { text: 'Start Work', hint: 'Tap "Start Work": your clock starts on 603.', advanceOnClick: true },
  'HU-ME2#2': { text: 'Complete job', hint: 'Tap "Complete job", write the note and confirm.' },
  'HU-PM1#0': { text: 'Active PM services', contains: true, hint: '968 is in PM now; below, the trucks waiting for PM, most urgent first.' },
  'HU-PM1#1': { text: 'Turn on what you changed', contains: true, hint: 'Turn on a part you changed. The bar at the bottom says what is missing.' },
  'HU-M10#1': { text: '612', contains: true, selector: 'a, li, article, [data-testid]', hint: 'The 612 card: you help on this Job.' },
  'HU-QC1#0': { text: '616', contains: true, selector: 'a, li, article, [data-testid]', hint: 'Most urgent first: 616 is Critical.' },
  'HU-QC1#1': { text: 'Take', hint: 'Tap "Take" on 616: the review opens with each Job, the PM, the inspection and past returns.' },
  'HU-QC1#2': { text: 'Continue review', hint: 'Open your review of 616: "Continue review".', then: { text: 'Approve', hint: 'Approve 616, or Return it with what you found.' } },
  'HU-QC1#3': { text: '922', contains: true, selector: 'a, li, article, [data-testid]', hint: '922 came back with what Safety found.' },
  'HU-QC1#5': { text: 'Continue review', hint: '905 is yours: inside, "Let go" frees it for QC1.' },
  'HU-QC1#6': { text: 'backup', contains: true, selector: 'p, div[role="status"], [data-testid]', hint: 'You are doing Quality Check as backup for Safety.' },
  'HU-M5#0': { text: 'Ready to close', contains: true, hint: 'Tap "Ready to close": 931 waits there.' },
  'HU-M5#1': { text: 'Confirm completion', hint: 'Tap "Confirm completion": every Job is done and Safety approved.', then: { text: 'Close Work Order', hint: '"Close Work Order": the Work Order is closed.' } },
  'HU-M5#2': { text: 'Return to Service', hint: 'Tap "Return to Service": the truck goes back to work.', then: { text: 'Confirm Return to Service', hint: 'The reason is optional. "Confirm Return to Service".' } },
  'HU-M7#1': { text: 'Out of shop', contains: true, hint: 'Every truck by step. Filter "Out of shop" to find 611.' },
  'HU-M7#2': { text: 'Dispatch', selector: '[role="tab"]', hint: 'Incoming trucks, departures and status come from Dispatch.' },
  'HU-M12#2': { text: 'Voided', contains: true, selector: 'tr, [role="row"], li', hint: 'Every purchase with its lines; this one was voided, never deleted.' },
  'HU-M12#5': { text: 'New purchase', hint: 'Tap "New purchase" and load a FleetPride invoice for 605.', then: { text: 'Save purchase', hint: 'Vendor, date, invoice number, Truck 605, the lines, tax and freight; then "Save purchase".' } },
  'HU-M12#6': { text: 'This month', hint: 'Choose "This month": your purchase is among the Parts.' },
  'HU-M11#4': { text: 'New outside repair', hint: 'Tap "New outside repair" and load a DPF cleaning for 612.', then: { selector: '[role="dialog"] button[type="submit"]', hint: 'Truck 612, Diesel Pro Repair, date, invoice number, what was done and the amount; then save.' } },
  'HU-M11#2': { text: 'Bay Area Body Shop', contains: true, hint: 'The outside repair invoice is tied to this Job.' },
  'HU-M12#4': { text: 'All time', hint: 'Change the period; a voided purchase shows as a negative reversal.' },
  'HU-M13#0': { text: '$105', contains: true, selector: 'tr, [role="row"], li, p', hint: '$105/h from the 1st of this month; earlier work stays at $95/h.' },
  'HU-M13#2': { text: 'Status', hint: 'Filter by status: show only Sent.' },
  'HU-M13#4': { selector: '[data-testid="invoice-month-close"]', hint: 'Month close: each truck with costs not charged yet last month.' },
  'HU-M13#5': { text: 'Make draft', hint: 'Tap "Make draft" on one truck.', advanceOnClick: true },
  'HU-M13#6': { selector: '[data-testid="invoice-create-all"]', hint: 'One tap makes the missing drafts of the month.', advanceOnClick: true },
  'HU-A1#0': { text: 'Times', hint: 'Open "Times" in the History: every clock segment of this Work Order.', then: { text: 'Correct', hint: 'Each closed segment has "Correct…": a new start or end, with the reason.' } },
  'HU-A1#1': { text: 'Labor by mechanic', contains: true, hint: 'Time per mechanic on this Work Order.' },
  'HU-A2#0': { selector: 'input[type="search"], input[placeholder*="Search" i]', hint: 'Search "engine": Jobs and their aliases.' },
  'HU-A2#2': { text: 'MG1', contains: true, selector: 'tr, [role="row"], li, a', hint: 'Open a person: deactivate, reset password, remove from Shop.' },
  'HU-M8#0': { text: 'Detailing', contains: true, selector: 'h2, h3, h4, li, [data-testid]', hint: 'Each step and its team: Detailing has two people, so its Jobs wait in a team queue.' },
  'HU-M8#3': { text: 'Day close', contains: true, hint: 'The day closes at 5:00 PM: running clocks stop.' },
};

const LOOK = { look: true } as const;
const inDialog = (text: string) => ({ text, inDialog: true });
const field = (label: string) => ({ label, inDialog: true });

/**
 * D40 (DA3): what Play does on each step, by story and step number (from 0), when it is more than tapping what
 * the spotlight lights: a form to fill, or only something to look at (`look`: Play points, the manual mode waits
 * for Next). Labels are the English ones on screen; `{stamp}` makes an invoice number new on every run.
 * `node e2e/demo-play/run.mjs` plays the whole flow against a fresh demo and says where it stops.
 */
const PLAYS: Partial<Record<`${DemoStoryId}#${number}`, Pick<DemoStep, 'play' | 'look'>>> = {
  'HU-ME5#0': LOOK,
  'HU-ME5#1': LOOK,
  'HU-M1#0': LOOK,
  'HU-M1#1': {
    play: [
      { do: 'tap', at: { text: 'New Work Order' } },
      { do: 'type', at: { selector: 'textarea', inDialog: true }, text: 'Arrived from Barstow, driver reports a soft brake pedal.' },
      { do: 'tap', at: inDialog('Create Work Order') },
    ],
  },
  'HU-M1#2': LOOK,
  'HU-M2#1': {
    play: [
      { do: 'tap', at: inDialog('Air & Brake System') },
      { do: 'tap', at: { selector: '[aria-label="Add Brake Inspection"]', inDialog: true } },
      { do: 'choose', at: field('Who does Brake Inspection?'), option: 'MG1' },
      { do: 'type', at: field('Custom job'), text: 'Check air horn' },
      { do: 'tap', at: { selector: '[aria-label="Add custom job"]', inDialog: true } },
      { do: 'tap', at: inDialog('Add to Work Plan') },
    ],
  },
  'HU-M2#2': LOOK,
  'HU-M3#1': {
    play: [
      { do: 'tap', at: { text: 'Assign', in: { selector: '[data-testid="admin-wo-next-step"]' } } },
      { do: 'tap', at: { text: 'MG1', selector: '[data-radix-popper-content-wrapper] button' } },
      { do: 'wait', ms: 1200 },
      { do: 'key', key: 'Escape' },
      { do: 'tap', at: { text: 'Assign', in: { selector: '[data-testid="admin-wo-next-step"]' } } },
      { do: 'tap', at: { text: 'MG2', selector: '[data-radix-popper-content-wrapper] button' } },
      { do: 'wait', ms: 1200 },
      { do: 'key', key: 'Escape' },
    ],
  },
  'HU-M3#2': LOOK,
  'HU-ME1#0': LOOK,
  'HU-ME1#1': LOOK,
  'HU-ME4#0': {
    play: [
      { do: 'type', at: { label: 'Add a note' }, text: 'Front pads at 30%: worth a look on the next PM.' },
      { do: 'tap', at: { text: 'Add Note' } },
      { do: 'tap', at: { text: 'Request Work' } },
      { do: 'type', at: { selector: 'textarea', inDialog: true }, text: 'The left mirror bracket is cracked: it needs a new one.' },
      { do: 'tap', at: inDialog('Send to Manager') },
    ],
  },
  'HU-ME3#0': LOOK,
  'HU-ME3#1': LOOK,
  'HU-ME2#0': LOOK,
  'HU-ME2#2': {
    play: [
      { do: 'tap', at: { text: 'Complete job' } },
      { do: 'type', at: { selector: 'textarea', inDialog: true }, text: 'Alignment done, toe within spec.' },
      { do: 'tap', at: inDialog('Complete job') },
    ],
  },
  'HU-PM1#0': LOOK,
  'HU-PM1#1': {
    play: [
      { do: 'point', at: { text: 'Turn on what you changed', contains: true } },
      { do: 'tap', at: { selector: '[role="switch"][aria-checked="false"]' } },
    ],
  },
  'HU-M10#1': LOOK,
  'HU-QC1#0': LOOK,
  'HU-QC1#1': { play: [{ do: 'tap', at: { text: 'Take', in: { text: '616', contains: true, selector: 'li, article, [data-testid]' } } }] },
  'HU-QC1#3': LOOK,
  'HU-QC1#5': LOOK,
  'HU-QC1#6': LOOK,
  'HU-M12#5': {
    play: [
      { do: 'tap', at: { text: 'New purchase' } },
      { do: 'choose', at: field('Vendor'), option: 'FleetPride' },
      { do: 'type', at: field('Invoice #'), text: 'FP-{stamp}' },
      { do: 'choose', at: field('Truck'), option: 'Truck 605' },
      { do: 'choose', at: { selector: '#line-part-0', inDialog: true } },
      { do: 'type', at: { selector: '#line-qty-0', inDialog: true }, text: '2' },
      { do: 'tap', at: inDialog('Add line') },
      { do: 'choose', at: { selector: '#line-part-1', inDialog: true }, option: 'Air' },
      { do: 'type', at: field('Tax'), text: '12' },
      { do: 'type', at: field('Freight'), text: '25' },
      { do: 'tap', at: inDialog('Save purchase') },
    ],
  },
  'HU-M11#4': {
    play: [
      { do: 'tap', at: { text: 'New outside repair' } },
      { do: 'choose', at: field('Truck'), option: 'Truck 612' },
      { do: 'choose', at: field('Vendor'), option: 'Diesel Pro' },
      { do: 'type', at: field('Invoice #'), text: 'DP-{stamp}' },
      { do: 'type', at: field('What was done'), text: 'DPF cleaning' },
      { do: 'type', at: field('Amount'), text: '420' },
      { do: 'tap', at: { selector: 'button[type="submit"]', inDialog: true } },
    ],
  },
  'HU-QC1#2': {
    play: [
      // Take (the step before) already opened the review; from the chapter list it has to be opened.
      { do: 'tap', at: { text: 'Continue review', in: { text: '616', contains: true, selector: 'li, article, [data-testid]' } }, optional: true },
      { do: 'tap', at: inDialog('Approve') },
      // "Approve Truck 616?" asks again in the same sheet: Back or Approve.
      { do: 'tap', at: inDialog('Approve') },
    ],
  },
  'HU-M13#0': LOOK,
  'HU-M13#4': LOOK,
  // The correction form is shown, not applied: a made-up correction would change the hours of the demo.
  'HU-A1#0': {
    play: [
      { do: 'tap', at: { text: 'Times' } },
      { do: 'tap', at: { text: 'Correct' } },
      { do: 'wait', ms: 2500 },
      { do: 'key', key: 'Escape' },
    ],
  },
  'HU-A1#1': LOOK,
  'HU-A2#0': { play: [{ do: 'type', at: { selector: 'input[type="search"], input[placeholder*="Search" i]' }, text: 'engine' }] },
  'HU-M8#0': LOOK,
  'HU-M8#3': LOOK,
};

export const DEMO_STORIES: DemoStory[] = STORY_SCRIPTS.map((story) => ({
  ...story,
  steps: story.steps.map((step, index) => {
    const key = `${story.id as DemoStoryId}#${index}` as const;
    const spotlight = SPOTLIGHTS[key];
    return { ...step, ...(spotlight ? { spotlight } : {}), ...PLAYS[key] };
  }),
}));

function huStory(id: DemoStoryId): DemoStory {
  return DEMO_STORIES.find((story) => story.id === id)!;
}

/** Steps of a story, in a chapter of the flow, optionally with a different account or text. */
function pick(chapter: string, id: DemoStoryId, indices: number[], patch: Partial<DemoStep> = {}): DemoStep[] {
  const steps = huStory(id).steps;
  return indices.map((index) => ({ ...steps[index], ...patch, chapter }));
}

/**
 * The demo flow (owner, 2026-10-10): one day at the shop, chapter by chapter, through every account. It reuses
 * the rehearsed steps of the stories, in an order where no chapter undoes a later one: the 605 blocker is
 * resolved once (chapter 5), 606 stays for the QC backup (chapter 10), 931 is closed after Safety approved it.
 */
export const DEMO_FLOW: DemoStory = {
  id: 'FLOW',
  title: 'A day at the shop',
  who: 'MS',
  jtbd: null,
  role: 'Everyone',
  trucks: ['944', '973', '601', '602', '604', '613', '605', '609', '615', '603', '968', '957', '612', '616', '922', '905', '931', '607', '611', '617'],
  note: 'Rebuild the demo the morning of the day (npm run prisma:demo-local). Chapters that change data are marked; the flow is ordered so none breaks a later one.',
  steps: [
    ...pick('1 · Start of the day: a clock left running yesterday', 'HU-ME5', [0, 1]),
    ...pick('2 · A truck arrives: a Work Order in one tap', 'HU-M1', [0, 1, 2]),
    ...pick('3 · Inspect, add work, assign', 'HU-M2', [0, 1, 2]),
    ...pick('3 · Inspect, add work, assign', 'HU-M3', [1, 2]),
    ...pick('4 · My work: clock, team queue, notes and requests', 'HU-ME1', [0, 1]),
    ...pick('4 · My work: clock, team queue, notes and requests', 'HU-ME4', [0]),
    ...pick('5 · A blocker: the mechanic reports, the Manager resolves', 'HU-ME3', [0, 1, 2, 3]),
    ...pick('6 · Pause and resume; cancel and reopen', 'HU-M4', [3]),
    ...pick('6 · Pause and resume; cancel and reopen', 'HU-M6', [0, 1]),
    ...pick('7 · Alignment: start and finish', 'HU-ME2', [0], {
      say: 'MA does the alignments of every truck. Their clock still runs on 609 since the Manager resumed it: Start Work on 603 moves it.',
    }),
    ...pick('7 · Alignment: start and finish', 'HU-ME2', [1, 2]),
    ...pick('8 · PM: mileage, parts, finish', 'HU-PM1', [0], {
      do: 'Show "Active PM services" (968) and "Waiting for PM" most urgent first with "Last PM: miles · date" on each truck (973, born in chapter 2, is already there).',
      expect: '968 active; the waiting list most urgent first.',
    }),
    ...pick('8 · PM: mileage, parts, finish', 'HU-PM1', [1]),
    ...pick('9 · Detailing: the team queue and a helper', 'HU-M8', [2], {
      user: 'MD',
      title: 'The team queue, as MD',
      do: 'Show the Team queue: 957 Detailing and 973 (the truck from chapter 2); MG1 sees the same cards. Tap Take on 957: it becomes MD\'s Job and leaves MG1\'s queue.',
      say: 'A step with a team of two is not assigned to anyone: the first one who takes it owns it. "Let go" returns it to the queue unless a clock runs on that truck.',
      expect: '957 in the Team queue with Take.',
      mutates: true,
      spotlight: { text: 'Take', hint: 'Tap "Take" on 957: the Detailing Job becomes yours.' },
      play: [{ do: 'tap', at: { text: 'Take', in: { text: '957', contains: true, selector: 'li, article, [data-testid]' } } }],
    }),
    ...pick('9 · Detailing: the team queue and a helper', 'HU-M10', [1]),
    ...pick('10 · Quality Check: take, approve, return; the backup', 'HU-QC1', [0, 1, 2, 3, 5, 6]),
    ...pick('11 · Close, Ready to Go, Return to Service; the whole shop', 'HU-M5', [0, 1, 2]),
    ...pick('11 · Close, Ready to Go, Return to Service; the whole shop', 'HU-M7', [1, 2]),
    ...pick('12 · Purchases and outside repairs: the cost lands on the truck', 'HU-M12', [2, 5, 6]),
    ...pick('12 · Purchases and outside repairs: the cost lands on the truck', 'HU-M11', [4, 2]),
    ...pick('12 · Purchases and outside repairs: the cost lands on the truck', 'HU-M12', [4]),
    ...pick('13 · Month close: the internal invoice for Finance', 'HU-M13', [0, 4, 5, 6]),
    ...pick('13 · Month close: the internal invoice for Finance', 'HU-M13', [3], {
      do: 'In the list below, open one of the Drafts you just made: look at its lines (parts, outside repairs, labor), tap Send and confirm, then "Download PDF" (the print dialog opens: choose "Save as PDF").',
      expect: 'The invoice gets its SHOP-YYYY-NNNN number; the print dialog shows the invoice for Finance.',
      spotlight: { text: 'Draft', selector: 'section:not([data-testid="invoice-month-close"]) tbody tr', contains: true, hint: 'Open a Draft: Send it, then "Download PDF".' },
      // Play sends it; the PDF opens the browser's print dialog, which would stop the page, so Play leaves it out.
      play: [
        { do: 'tap', at: { text: 'Draft', selector: 'section:not([data-testid="invoice-month-close"]) tbody tr a, section:not([data-testid="invoice-month-close"]) tbody tr', contains: true } },
        { do: 'tap', at: { text: 'Send' } },
        { do: 'tap', at: { text: 'Send', selector: '[role="alertdialog"] button, [role="dialog"] button' } },
      ],
    }),
    ...pick('13 · Month close: the internal invoice for Finance', 'HU-M13', [2], {
      do: 'Back on Internal invoices: the list is grouped by month with Accepted, Sent, Voided and the new Drafts. Filter by status to show only Sent.',
      expect: 'The invoice you sent among the Sent ones.',
      play: [{ do: 'choose', at: { selector: '#invoices-status' }, option: 'Sent' }],
    }),
    ...pick('14 · Admin: correct time, people, catalog', 'HU-A1', [0, 1]),
    ...pick('14 · Admin: correct time, people, catalog', 'HU-A2', [2, 0]),
    ...pick('15 · Setup: the shop workflow and the hours', 'HU-M8', [0, 3]),
  ],
};

export type DemoChapter = { title: string; from: number; to: number };

/** The chapters of a story (consecutive steps with the same `chapter` label); empty for the HU stories. */
export function storyChapters(story: DemoStory): DemoChapter[] {
  const chapters: DemoChapter[] = [];
  story.steps.forEach((step, index) => {
    if (!step.chapter) return;
    const last = chapters[chapters.length - 1];
    if (last && last.title === step.chapter) last.to = index;
    else chapters.push({ title: step.chapter, from: index, to: index });
  });
  return chapters;
}

export function findDemoStory(id: string | null | undefined): DemoStory | null {
  if (!id) return null;
  if (id === DEMO_FLOW.id) return DEMO_FLOW;
  return DEMO_STORIES.find((story) => story.id === id) ?? null;
}

export const DEMO_WHO_ORDER: DemoWho[] = ['MS', 'Mechanics', 'MPM', 'QC', 'AS'];

export const DEMO_JOB_IDS = Object.keys(DEMO_JTBD) as DemoJobId[];
