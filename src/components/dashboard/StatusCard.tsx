import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatusCardProps {
  title: string;
  status: string;
  message: string;
}

const StatusCard: React.FC<StatusCardProps> = ({ title, status, message }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>Status: {status}</p>
        <p>{message}</p>
      </CardContent>
    </Card>
  );
};

export default StatusCard;