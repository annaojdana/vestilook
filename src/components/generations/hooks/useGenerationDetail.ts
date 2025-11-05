import { useState, useEffect } from "react";
import type { GenerationDetailResponseDto } from "../../../types";
import { getGenerationDetail } from "../../../lib/vtonClient";

interface GenerationResultViewModel {
  id: string;
  status: string;
  // ... inne pola
}

const useGenerationDetail = (id: string) => {
  const [data, setData] = useState<GenerationResultViewModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response: GenerationDetailResponseDto = await getGenerationDetail(id);
        // Mapowanie DTO do GenerationResultViewModel
        const viewModel: GenerationResultViewModel = {
          id: response.id,
          status: response.status,
          // ... mapowanie innych pól
        };
        setData(viewModel);
        setError(null);
      } catch (error: unknown) {
        setError((error as Error).message);
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [id]);

  return { data, isLoading, error };
};

export default useGenerationDetail;
