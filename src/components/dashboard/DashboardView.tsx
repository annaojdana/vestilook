import React from "react";
import type { ProfileResponseDto, QuotaSummaryResponseDto } from "../../types";
import StatusCardGrid from "./StatusCardGrid";

interface DashboardViewProps {
  profile: ProfileResponseDto;
  quota: QuotaSummaryResponseDto;
}

const DashboardView: React.FC<DashboardViewProps> = ({ profile, quota }) => {
  return (
    <div className="container mx-auto py-8">
      <h2 className="text-2xl font-bold mb-4">Dashboard View</h2>
      <StatusCardGrid />
      <pre>Profile: {JSON.stringify(profile, null, 2)}</pre>
      <pre>Quota: {JSON.stringify(quota, null, 2)}</pre>
    </div>
  );
};

export default DashboardView;
