import React from "react";
import type { GenerationHistoryItemViewModel, HistoryActionAvailability } from "../../../types";

interface HistoryRowProps {
  item: GenerationHistoryItemViewModel;
  actions: HistoryActionAvailability;
}

const HistoryRow: React.FC<HistoryRowProps> = ({ item, actions }) => {
  return (
    <tr>
      <td>{/* TODO: Implement thumbnail */}</td>
      <td>{/* TODO: Implement status */}</td>
      <td>{/* TODO: Implement TTL */}</td>
      <td>{/* TODO: Implement rating */}</td>
      <td>{/* TODO: Implement actions */}</td>
    </tr>
  );
};

export default HistoryRow;