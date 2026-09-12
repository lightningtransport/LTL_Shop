'use client';

import * as React from 'react';

export type ShopLocale = 'en' | 'es';

export const SHOP_LOCALE_COOKIE = 'ltl_shop_locale';

type Copy = {
  locale: ShopLocale;
  language: string;
  switchTo: string;
  home: string;
  backToHome: string;
  retry: string;
  signIn: string;
  signInHint: string;
  email: string;
  password: string;
  resetPassword: string;
  devLogin: string;
  newWorkOrder: string;
  newPmService: string;
  workOrderHint: string;
  pmServiceHint: string;
  truck: string;
  searchTruck: string;
  noTrucks: string;
  checkingOpenWorkOrder: string;
  retryWorkOrderCheck: string;
  truckInformation: string;
  selectTruck: string;
  repairHistory: string;
  openWorkOrder: string;
  noAccessToPmWorkOrder: string;
  chooseAnotherWorkOrder: string;
  workOrderOpen: (truckNumber: string) => string;
  workOrderSummary: (displayId: string, status: string, completed: number, total: number) => string;
  truckResults: (count: number) => string;
  activeJobs: (count: number) => string;
  pausedJobs: (count: number) => string;
  noActiveJobs: string;
  noPausedJobs: string;
  assignedToYou: string;
  assignedTo: (name: string) => string;
  jobUnassignedInheritsTeam: string;
  myJobs: string;
  otherWorkOnThisTruck: string;
  workOrderTeam: string;
  noWorkOrderTeam: string;
  noMyJobs: string;
  createWorkOrder: string;
  askManagerToCreate: string;
  askManagerToCreateHint: string;
  additionalWorkHint: string;
  pausedAskManager: string;
  createPmService: string;
  viewCompletedWork: (count: number) => string;
  status: Record<string, string>;
};

const copy: Record<ShopLocale, Copy> = {
  en: {
    locale: 'en', language: 'Language', switchTo: 'Switch to Spanish', home: 'Home',
    backToHome: 'Back to Home', retry: 'Try again', signIn: 'Sign in',
    signInHint: 'Sign in with the email linked to the Shop.', email: 'Email', password: 'Password',
    resetPassword: 'Reset password', devLogin: 'Dev login (local bypass)',
    newWorkOrder: 'New Work Order', newPmService: 'New PM service',
    workOrderHint: 'Enter the required information. Creating saves the order; Start Work begins labor.',
    pmServiceHint: 'Select a truck to create a PM service.', truck: 'Truck',
    searchTruck: 'Search truck number (for example, #905)', noTrucks: 'No trucks found.',
    checkingOpenWorkOrder: 'Checking for an open Work Order.', retryWorkOrderCheck: 'Retry Work Order check',
    truckInformation: 'Truck information', selectTruck: 'Select a truck to show its details.',
    repairHistory: 'View truck repair history', openWorkOrder: 'View open Work Order',
    noAccessToPmWorkOrder: 'You do not have access to this PM Work Order.',
    chooseAnotherWorkOrder: 'Choose another Work Order',
    workOrderOpen: (truckNumber) => `Truck #${truckNumber} already has an open Work Order.`,
    workOrderSummary: (displayId, status, completed, total) => `${displayId} · ${status} · ${completed} of ${total} jobs completed`,
    truckResults: (count) => `${count} ${count === 1 ? 'truck result' : 'truck results'} available.`,
    activeJobs: (count) => `${count} ${count === 1 ? 'active job' : 'active jobs'}`,
    pausedJobs: (count) => `${count} ${count === 1 ? 'paused job' : 'paused jobs'}`,
    noActiveJobs: 'No assigned work in progress.',
    noPausedJobs: 'No paused jobs. Paused work will appear here until it is resumed.',
    assignedToYou: 'Assigned to you',
    assignedTo: (name) => `Assigned to ${name}`,
    jobUnassignedInheritsTeam: 'Unassigned — inherits the Work Order team',
    myJobs: 'My Jobs',
    otherWorkOnThisTruck: 'Other work on this Truck',
    workOrderTeam: 'Work Order team',
    noWorkOrderTeam: 'No Work Order team assigned',
    noMyJobs: 'No jobs assigned to you. Unassigned jobs inherit the Work Order team.',
    createWorkOrder: 'Create new Work Order',
    askManagerToCreate: 'Ask your Shop Manager to create a Work Order.',
    askManagerToCreateHint: 'Managers plan Standard work. Your Home lists Work Orders assigned to you.',
    additionalWorkHint: 'Need additional work on this Truck? Write it here so your Manager can add the Job.',
    pausedAskManager: 'This Work Order is paused. Your Shop Manager will resume it.',
    createPmService: 'Create PM service',
    viewCompletedWork: (count) => `View completed work (${count})`,
    status: { created: 'Created', in_progress: 'In progress', waiting_paused: 'Paused', completed: 'Completed' },
  },
  es: {
    locale: 'es', language: 'Idioma', switchTo: 'Cambiar a inglés', home: 'Inicio',
    backToHome: 'Volver a Inicio', retry: 'Reintentar', signIn: 'Iniciar sesión',
    signInHint: 'Inicia sesión con el correo vinculado al Shop.', email: 'Correo electrónico', password: 'Contraseña',
    resetPassword: 'Restablecer contraseña', devLogin: 'Acceso de desarrollo (bypass local)',
    newWorkOrder: 'Nuevo Work Order', newPmService: 'Nuevo servicio de PM',
    workOrderHint: 'Ingresa la información requerida. Crear guarda el Work Order; Iniciar trabajo comienza el registro de tiempo.',
    pmServiceHint: 'Selecciona una unidad para crear un servicio de PM.', truck: 'Unidad',
    searchTruck: 'Buscar número de unidad (por ejemplo, #905)', noTrucks: 'No se encontraron unidades.',
    checkingOpenWorkOrder: 'Verificando si hay un Work Order abierto.', retryWorkOrderCheck: 'Reintentar la verificación del Work Order',
    truckInformation: 'Información de la unidad', selectTruck: 'Selecciona una unidad para ver sus detalles.',
    repairHistory: 'Ver historial de reparaciones de la unidad', openWorkOrder: 'Ver Work Order abierto',
    noAccessToPmWorkOrder: 'No tienes acceso a este Work Order de PM.',
    chooseAnotherWorkOrder: 'Elegir otro Work Order',
    workOrderOpen: (truckNumber) => `La unidad #${truckNumber} ya tiene un Work Order abierto.`,
    workOrderSummary: (displayId, status, completed, total) => `${displayId} · ${status} · ${completed} de ${total} Jobs completados`,
    truckResults: (count) => `${count} ${count === 1 ? 'resultado de unidad disponible.' : 'resultados de unidades disponibles.'}`,
    activeJobs: (count) => `${count} ${count === 1 ? 'Job activo' : 'Jobs activos'}`,
    pausedJobs: (count) => `${count} ${count === 1 ? 'Job pausado' : 'Jobs pausados'}`,
    noActiveJobs: 'No hay trabajo asignado en progreso.',
    noPausedJobs: 'No hay Jobs pausados. El trabajo pausado aparecerá aquí hasta que se reanude.',
    assignedToYou: 'Asignado a ti',
    assignedTo: (name) => `Asignado a ${name}`,
    jobUnassignedInheritsTeam: 'Sin asignar — hereda el equipo de la Work Order',
    myJobs: 'Mis Jobs',
    otherWorkOnThisTruck: 'Otro trabajo en esta unidad',
    workOrderTeam: 'Equipo de la Work Order',
    noWorkOrderTeam: 'No hay equipo asignado a la Work Order',
    noMyJobs: 'No tienes Jobs asignados. Los Jobs sin asignar heredan el equipo de la Work Order.',
    createWorkOrder: 'Crear nuevo Work Order',
    askManagerToCreate: 'Pide a tu Shop Manager que cree el Work Order.',
    askManagerToCreateHint: 'El Manager planifica el trabajo Standard. En Inicio ves los Work Orders asignados a ti.',
    additionalWorkHint: '¿Hace falta trabajo adicional en esta unidad? Anótalo aquí para que el Manager agregue el Job.',
    pausedAskManager: 'Este Work Order está pausado. Tu Shop Manager lo reanudará.',
    createPmService: 'Crear servicio de PM',
    viewCompletedWork: (count) => `Ver trabajo completado (${count})`,
    status: { created: 'Creado', in_progress: 'En progreso', waiting_paused: 'Pausado', completed: 'Completado' },
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
    () => document.cookie.split('; ').find((item) => item.startsWith(`${SHOP_LOCALE_COOKIE}=`))?.split('=')[1] === 'es' ? 'es' : 'en',
    () => initialLocale,
  );
  const setLocale = React.useCallback((nextLocale: ShopLocale) => {
    document.cookie = `${SHOP_LOCALE_COOKIE}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = nextLocale;
    window.dispatchEvent(new Event('ltl-shop-locale-change'));
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
