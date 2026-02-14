import { create } from 'zustand';

/**
 * Global Application Store
 * 
 * Manages global UI state, user preferences, and selection state
 */

// Notification types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
  duration?: number; // ms, undefined = persistent
  createdAt: Date;
}

// User preferences
export interface UserPreferences {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  defaultListingType: 'trade_in' | 'ex_demo' | 'new';
  defaultConditionGrade: string;
  defaultDiscountPercent: number;
}

// Selection state (for bulk operations)
export interface SelectionState {
  selectedInventoryIds: Set<string>;
  selectAll: boolean;
}

// Store state
interface AppState {
  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;

  // User preferences
  preferences: UserPreferences;
  setPreference: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
  resetPreferences: () => void;

  // Selection state
  selection: SelectionState;
  selectItem: (id: string) => void;
  deselectItem: (id: string) => void;
  toggleItem: (id: string) => void;
  selectItems: (ids: string[]) => void;
  deselectItems: (ids: string[]) => void;
  selectAllItems: () => void;
  clearSelection: () => void;

  // Sync status
  syncingItems: Set<string>;
  setSyncing: (id: string, isSyncing: boolean) => void;
  clearSyncing: () => void;
}

const defaultPreferences: UserPreferences = {
  sidebarCollapsed: false,
  theme: 'system',
  defaultListingType: 'trade_in',
  defaultConditionGrade: 'A',
  defaultDiscountPercent: 20,
};

// Generate unique notification ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const useAppStore = create<AppState>()((set, get) => ({
        // Notifications
        notifications: [],
        
        addNotification: (notification) => {
          const newNotification: Notification = {
            ...notification,
            id: generateId(),
            createdAt: new Date(),
          };
          
          set((state) => ({
            notifications: [...state.notifications, newNotification],
          }));

          // Auto-dismiss after duration
          if (notification.duration) {
            setTimeout(() => {
              get().dismissNotification(newNotification.id);
            }, notification.duration);
          }
        },

        dismissNotification: (id) => {
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
          }));
        },

        clearNotifications: () => {
          set({ notifications: [] });
        },

        // User preferences
        preferences: defaultPreferences,

        setPreference: (key, value) => {
          set((state) => ({
            preferences: { ...state.preferences, [key]: value },
          }));
        },

        resetPreferences: () => {
          set({ preferences: defaultPreferences });
        },

        // Selection state
        selection: {
          selectedInventoryIds: new Set(),
          selectAll: false,
        },

        selectItem: (id) => {
          set((state) => {
            const newSet = new Set(state.selection.selectedInventoryIds);
            newSet.add(id);
            return {
              selection: { ...state.selection, selectedInventoryIds: newSet },
            };
          });
        },

        deselectItem: (id) => {
          set((state) => {
            const newSet = new Set(state.selection.selectedInventoryIds);
            newSet.delete(id);
            return {
              selection: { ...state.selection, selectedInventoryIds: newSet, selectAll: false },
            };
          });
        },

        toggleItem: (id) => {
          const { selection } = get();
          if (selection.selectedInventoryIds.has(id)) {
            get().deselectItem(id);
          } else {
            get().selectItem(id);
          }
        },

        selectItems: (ids) => {
          set((state) => {
            const newSet = new Set(state.selection.selectedInventoryIds);
            ids.forEach((id) => newSet.add(id));
            return {
              selection: { ...state.selection, selectedInventoryIds: newSet },
            };
          });
        },

        deselectItems: (ids) => {
          set((state) => {
            const newSet = new Set(state.selection.selectedInventoryIds);
            ids.forEach((id) => newSet.delete(id));
            return {
              selection: { ...state.selection, selectedInventoryIds: newSet, selectAll: false },
            };
          });
        },

        selectAllItems: () => {
          set((state) => ({
            selection: { ...state.selection, selectAll: true },
          }));
        },

        clearSelection: () => {
          set({
            selection: { selectedInventoryIds: new Set(), selectAll: false },
          });
        },

        // Sync status
        syncingItems: new Set(),

        setSyncing: (id, isSyncing) => {
          set((state) => {
            const newSet = new Set(state.syncingItems);
            if (isSyncing) {
              newSet.add(id);
            } else {
              newSet.delete(id);
            }
            return { syncingItems: newSet };
          });
        },

        clearSyncing: () => {
          set({ syncingItems: new Set() });
        },
      }));

// Selectors for performance optimization
export const useNotifications = () => useAppStore((state) => state.notifications);
export const usePreferences = () => useAppStore((state) => state.preferences);
export const useSelection = () => useAppStore((state) => state.selection);
export const useSyncingItems = () => useAppStore((state) => state.syncingItems);

// Notification helpers
export const notify = {
  success: (title: string, message?: string, duration = 5000) => {
    useAppStore.getState().addNotification({ type: 'success', title, message, duration });
  },
  error: (title: string, message?: string, duration = 0) => {
    useAppStore.getState().addNotification({ type: 'error', title, message, duration });
  },
  info: (title: string, message?: string, duration = 5000) => {
    useAppStore.getState().addNotification({ type: 'info', title, message, duration });
  },
  warning: (title: string, message?: string, duration = 7000) => {
    useAppStore.getState().addNotification({ type: 'warning', title, message, duration });
  },
};
