import { createContext, useContext, useState, useCallback } from 'react';

interface SettingsLeaveContextValue {
  /** Whether the Settings page has unsaved changes (set by Settings page). */
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  /** Call when user tries to navigate away from Settings; shows the leave confirmation dialog. */
  promptLeave: (nextPath: string) => void;
}

const SettingsLeaveContext = createContext<SettingsLeaveContextValue | null>(null);

export function useSettingsLeave() {
  const ctx = useContext(SettingsLeaveContext);
  return ctx;
}

export interface SettingsLeaveProviderProps {
  children: React.ReactNode;
  /** Called when user confirms "Leave without saving" with the path to navigate to. */
  onConfirmLeave: (path: string) => void;
  /** Renders the leave confirmation dialog; receives open, onOpenChange, onLeave, onCancel. */
  renderLeaveDialog: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onLeave: () => void;
    onCancel: () => void;
  }) => React.ReactNode;
}

export function SettingsLeaveProvider({ children, onConfirmLeave, renderLeaveDialog }: SettingsLeaveProviderProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const promptLeave = useCallback((nextPath: string) => {
    setPendingPath(nextPath);
    setDialogOpen(true);
  }, []);

  const handleLeave = useCallback(() => {
    if (pendingPath) {
      onConfirmLeave(pendingPath);
      setHasUnsavedChanges(false);
      setPendingPath(null);
      setDialogOpen(false);
    }
  }, [pendingPath, onConfirmLeave]);

  const handleCancel = useCallback(() => {
    setDialogOpen(false);
    setPendingPath(null);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) setPendingPath(null);
  }, []);

  const value: SettingsLeaveContextValue = {
    hasUnsavedChanges,
    setHasUnsavedChanges,
    promptLeave,
  };

  return (
    <SettingsLeaveContext.Provider value={value}>
      {children}
      {renderLeaveDialog({
        open: dialogOpen,
        onOpenChange: handleOpenChange,
        onLeave: handleLeave,
        onCancel: handleCancel,
      })}
    </SettingsLeaveContext.Provider>
  );
}
