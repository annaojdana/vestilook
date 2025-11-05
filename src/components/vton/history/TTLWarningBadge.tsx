import React from "react";
import type { GenerationStatus, CountdownState } from "../../../types";

interface TTLWarningBadgeProps {
  expiresAt?: string | null;
  status: GenerationStatus;
  countdown: CountdownState;
}

const TTLWarningBadge: React.FC<TTLWarningBadgeProps> = ({ expiresAt, status, countdown }) => {
  return (
    <div>
      {/* TODO: Implement TTL warning badge */}
    </div>
  );
};

export default TTLWarningBadge;