export type AdminLocale = 'en' | 'es';

const messages = {
  en: {
    eyebrow: 'Shop Admin',
    title: 'Shop Operations',
    description: 'Secure manager workspace for the Lightning Shop.',
    dashboard: 'Dashboard',
    workOrders: 'Work Orders',
    trucks: 'Trucks',
    mechanics: 'Mechanics',
    jobCatalog: 'Job Catalog',
    history: 'History',
    navigation: 'Shop Admin navigation',
    mobileNavigation: 'Shop Admin mobile navigation',
    foundationTitle: 'Admin foundation is ready',
    foundationBody: 'Role-based access, responsive navigation, and bilingual infrastructure are now in place. Operational data arrives in Phase 2.',
    secureAccess: 'Server-authorized access',
    secureAccessBody: 'Only active Manager and Admin accounts can enter this workspace.',
    nextPhase: 'Next phase',
    nextPhaseBody: 'Read-only Work Orders, Trucks, Mechanics, History, and supported dashboard metrics.',
    language: 'Language',
    english: 'English',
    spanish: 'Español',
    comingLater: 'Available in a later phase',
  },
  es: {
    eyebrow: 'Shop Admin',
    title: 'Operaciones del Shop',
    description: 'Espacio seguro para el equipo de gestión del Lightning Shop.',
    dashboard: 'Dashboard',
    workOrders: 'Work Orders',
    trucks: 'Unidades',
    mechanics: 'Mecánicos',
    jobCatalog: 'Catálogo de Jobs',
    history: 'Historial',
    navigation: 'Navegación de Shop Admin',
    mobileNavigation: 'Navegación móvil de Shop Admin',
    foundationTitle: 'La base de Admin está lista',
    foundationBody: 'El acceso por roles, la navegación adaptable y la infraestructura bilingüe ya están preparadas. Los datos operativos llegarán en la Fase 2.',
    secureAccess: 'Acceso autorizado por el servidor',
    secureAccessBody: 'Solo las cuentas activas con rol Manager o Admin pueden entrar a este espacio.',
    nextPhase: 'Próxima fase',
    nextPhaseBody: 'Work Orders, unidades, mecánicos, historial y métricas compatibles en modo de solo lectura.',
    language: 'Idioma',
    english: 'English',
    spanish: 'Español',
    comingLater: 'Disponible en una fase posterior',
  },
} as const;

export type AdminMessages = (typeof messages)[AdminLocale];

export function getAdminMessages(locale: AdminLocale): AdminMessages {
  return messages[locale];
}

export function isAdminLocale(value?: string): value is AdminLocale {
  return value === 'en' || value === 'es';
}
