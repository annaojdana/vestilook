import { useState, useEffect } from 'react';
import { GenerationHistoryFilters, GenerationListResponseDto } from '../../../types';

interface UseGenerationHistoryProps {
  filters: GenerationHistoryFilters;
}

const useGenerationHistory = ({ filters }: UseGenerationHistoryProps) => {
  const [data, setData] = useState<GenerationListResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // TODO: Implement API call to fetch generation history
        const response = await fetch("/api/vton/generations");
        const result: GenerationListResponseDto = await response.json();
        setData(result);
      } catch (error: unknown) {
        setError(error as Error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [filters]);

  return { data, isLoading, error };
};

export default useGenerationHistory;