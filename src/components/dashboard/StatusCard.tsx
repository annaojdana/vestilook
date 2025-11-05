import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatusCardProps {
  title: string;
  status: string;
  message: string;
}

const StatusCard: React.FC<StatusCardProps> = ({ title, status, message }) => {
  return (
    <Card className="bg-white shadow-md rounded-md">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-700">Status: {status}</p>
        <p className="text-gray-600">{message}</p>
      </CardContent>
    </Card>
  );
};

export default StatusCard;
