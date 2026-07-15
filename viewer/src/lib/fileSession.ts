export type FileSessionState = {
  sourceLabel: string;
  canWriteBack: boolean;
  hasUnsavedChanges: boolean;
};

export const initialFileSession: FileSessionState = {
  sourceLabel: "viewer/PRD_web_ui.json",
  canWriteBack: false,
  hasUnsavedChanges: false
};
