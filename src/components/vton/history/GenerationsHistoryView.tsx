import React from "react";

interface GenerationsHistoryViewProps {
  session: any; // TODO: Określ typ sesji
}

const GenerationsHistoryView: React.FC<GenerationsHistoryViewProps> = ({ session }) => {
  return (
    <section>
      <h1>Historia Generacji</h1>
      {/* TODO: Implementacja widoku historii generacji */}
    </section>
  );
};

export default GenerationsHistoryView;
