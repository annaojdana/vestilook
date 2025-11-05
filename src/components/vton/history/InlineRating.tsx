import React from "react";

interface InlineRatingProps {
  value: number | null;
  onRate: (rating: number) => void;
  disabled: boolean;
  isSubmitting: boolean;
}

const InlineRating: React.FC<InlineRatingProps> = ({ value, onRate, disabled, isSubmitting }) => {
  return (
    <div>
      <h2>Inline Rating</h2>
      {/* TODO: Implement inline rating */}
    </div>
  );
};

export default InlineRating;