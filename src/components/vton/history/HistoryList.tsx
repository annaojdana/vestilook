import React from "react";
import type { GenerationSummaryDto } from "../../../types";

interface HistoryListProps {
  items: GenerationSummaryDto[];
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}

const HistoryList: React.FC<HistoryListProps> = ({ items, isLoading, error, onRetry }) => {
  return (
    <div>
      <h2>History List</h2>
      {/* TODO: Implement history list */}
    </div>
  );
};

export default HistoryList;