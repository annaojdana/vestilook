import React from "react";
import type { GenerationHistoryFilters } from "../../../types";

interface FilterToolbarProps {
  value: GenerationHistoryFilters;
  onChange: (value: GenerationHistoryFilters) => void;
  onSubmit: () => void;
  isPending: boolean;
}

const FilterToolbar: React.FC<FilterToolbarProps> = ({ value, onChange, onSubmit, isPending }) => {
  return (
    <div>
      <h2>Filter Toolbar</h2>
      {/* TODO: Implement filter toolbar */}
    </div>
  );
};

export default FilterToolbar;