import { useState, useEffect, useCallback } from "react";

export const DEFAULT_STAFF: string[] = [
  "Suresh",
  "Sajith",
  "Karthik Raj",
  "Karthi",
  "Sanjay",
  "Anandhan",
  "Karthikeyan"
];

const LOCAL_STORAGE_STAFF_KEY = "ntcs_staff_roster";
const ROSTER_UPDATE_EVENT = "ntcs_staff_roster_updated";

/**
 * Retrieve current active staff roster from persistent storage
 */
export const getStaffRoster = (): string[] => {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_STAFF_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((name) => typeof name === "string" && name.trim().length > 0);
      }
    }
  } catch (e) {
    console.warn("Failed to read staff roster from storage:", e);
  }
  return [...DEFAULT_STAFF];
};

/**
 * Save active staff roster to persistent storage and notify all listeners
 */
export const saveStaffRoster = (staffList: string[]) => {
  try {
    const sanitized = Array.from(new Set(staffList.map((s) => s.trim()).filter(Boolean)));
    localStorage.setItem(LOCAL_STORAGE_STAFF_KEY, JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent(ROSTER_UPDATE_EVENT, { detail: sanitized }));
  } catch (e) {
    console.warn("Failed to save staff roster:", e);
  }
};

/**
 * Custom React Hook for reactive staff roster management across any component
 */
export const useStaffRoster = () => {
  const [staffList, setStaffList] = useState<string[]>(getStaffRoster);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<string[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setStaffList(customEvent.detail);
      } else {
        setStaffList(getStaffRoster());
      }
    };

    window.addEventListener(ROSTER_UPDATE_EVENT, handler);
    // Also listen to storage events for cross-tab synchronization
    window.addEventListener("storage", (e) => {
      if (e.key === LOCAL_STORAGE_STAFF_KEY) {
        setStaffList(getStaffRoster());
      }
    });

    return () => {
      window.removeEventListener(ROSTER_UPDATE_EVENT, handler);
    };
  }, []);

  const addStaff = useCallback((name: string): boolean => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    const current = getStaffRoster();
    if (current.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      return false; // Already exists
    }
    const updated = [...current, trimmed];
    saveStaffRoster(updated);
    setStaffList(updated);
    return true;
  }, []);

  const updateStaff = useCallback((oldName: string, newName: string): boolean => {
    const trimmedNew = newName.trim();
    if (!trimmedNew) return false;
    const current = getStaffRoster();
    const index = current.findIndex((s) => s.toLowerCase() === oldName.trim().toLowerCase());
    if (index === -1) return false;

    // Check if new name already exists for another member
    const existsOther = current.some(
      (s, idx) => idx !== index && s.toLowerCase() === trimmedNew.toLowerCase()
    );
    if (existsOther) return false;

    const updated = [...current];
    updated[index] = trimmedNew;
    saveStaffRoster(updated);
    setStaffList(updated);
    return true;
  }, []);

  const removeStaff = useCallback((name: string): boolean => {
    const trimmed = name.trim();
    const current = getStaffRoster();
    if (current.length <= 1) {
      return false; // Prevent removing the very last staff member
    }
    const updated = current.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
    saveStaffRoster(updated);
    setStaffList(updated);
    return true;
  }, []);

  const resetToDefaults = useCallback(() => {
    saveStaffRoster(DEFAULT_STAFF);
    setStaffList([...DEFAULT_STAFF]);
  }, []);

  return {
    staffList,
    addStaff,
    updateStaff,
    removeStaff,
    resetToDefaults
  };
};
