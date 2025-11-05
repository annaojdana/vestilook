import React from "react";

interface PaginationState {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

interface PaginationControlsProps {
  pageInfo: PaginationState;
  onPageChange: (page: number) => void;
  isPending: boolean;
}

const PaginationControls: React.FC<PaginationControlsProps> = ({ pageInfo, onPageChange, isPending }) => {
  return (
    <div>
      <h2>Pagination Controls</h2>
      {/* TODO: Implement pagination controls */}
    </div>
  );
};

export default PaginationControls;