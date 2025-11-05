import React from "react";
import type { GenerationHistoryItemViewModel } from "../../../types";

interface ConfirmDeleteDialogProps {
  target?: GenerationHistoryItemViewModel;
  onConfirm: () => void;
  isSubmitting: boolean;
  onCancel: () => void;
}

const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({ target, onConfirm, isSubmitting, onCancel }) => {
  return (
    <div>
      <h2>Confirm Delete Dialog</h2>
      {/* TODO: Implement confirm delete dialog */}
    </div>
  );
};

export default ConfirmDeleteDialog;
