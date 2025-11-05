import type { GenerationDetailResponseDto, GenerationDownloadResponseDto, GenerationRatingCommand } from "../types";

const API_BASE_URL = "/api/vton/generations";

export const getGenerationDetail = async (id: string): Promise<GenerationDetailResponseDto> => {
  try {
    const response = await fetch(API_BASE_URL + "/" + id);
    if (!response.ok) {
      throw new Error("Failed to fetch generation detail: " + response.status);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching generation detail:", error);
    throw error;
  }
};

export const getGenerationDownload = async (id: string): Promise<GenerationDownloadResponseDto> => {
  try {
    const response = await fetch(API_BASE_URL + "/" + id + "/download");
    if (!response.ok) {
      throw new Error("Failed to fetch generation download URL: " + response.status);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching generation download:", error);
    throw error;
  }
};

export const rateGeneration = async (id: string, rating: GenerationRatingCommand): Promise<void> => {
  try {
    const response = await fetch(API_BASE_URL + "/" + id + "/rating", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(rating),
    });
    if (!response.ok) {
      throw new Error("Failed to rate generation: " + response.status);
    }
  } catch (error) {
    console.error("Error rating generation:", error);
    throw error;
  }
};
