import React from "react";

interface ResultGenerationViewProps {
  generationId: string;
}

const ResultGenerationView: React.FC<ResultGenerationViewProps> = ({ generationId }) => {
  return (
    <div>
      <h1>Wynik generacji: {generationId}</h1>
      {/* Tutaj będzie logika pobierania i wyświetlania danych */}
    </div>
  );
};

export default ResultGenerationView;
