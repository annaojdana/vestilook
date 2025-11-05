import React from "react";
import type { ProfileResponseDto } from "../../types";

interface DashboardViewProps {
  initialData: ProfileResponseDto;
}

const DashboardView: React.FC<DashboardViewProps> = ({ initialData }) => {
  return (
    <div>
      <h2>Dashboard View</h2>
      <pre>{JSON.stringify(initialData, null, 2)}</pre>
    </div>
  );
};

export default DashboardView;