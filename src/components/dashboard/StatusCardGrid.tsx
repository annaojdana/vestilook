import React from "react";
import StatusCard from "./StatusCard";

const StatusCardGrid: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatusCard title="Consent" status="OK" message="Consent is active" />
      <StatusCard title="Persona" status="OK" message="Persona is uploaded" />
      <StatusCard title="Quota" status="OK" message="Quota is available" />
    </div>
  );
};

export default StatusCardGrid;