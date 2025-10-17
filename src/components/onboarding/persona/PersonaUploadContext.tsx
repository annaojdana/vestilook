import { createContext, useContext, type FC, type PropsWithChildren } from "react";

import type {
  ConsentRequirement,
  PersonaUploadResponseDto,
  PersonaUploadState,
  UploadConstraints,
} from "@/types.ts";
import type { UsePersonaUploaderResult } from "./usePersonaUploader.ts";

interface PersonaUploadContextValue {
  constraints: UploadConstraints;
  consent: ConsentRequirement;
  state: PersonaUploadState;
  busy: boolean;
  selectFile: (file: File) => Promise<void>;
  handleFileList: (files: FileList | File[]) => Promise<void>;
  removeFile: () => void;
  upload: () => Promise<PersonaUploadResponseDto | null>;
  resetValidation: () => void;
}

const PersonaUploadContext = createContext<PersonaUploadContextValue | null>(null);

interface PersonaUploadProviderProps extends PropsWithChildren {
  constraints: UploadConstraints;
  consent: ConsentRequirement;
  uploader: UsePersonaUploaderResult;
}

export const PersonaUploadProvider: FC<PersonaUploadProviderProps> = ({
  constraints,
  consent,
  uploader,
  children,
}) => {
  const value: PersonaUploadContextValue = {
    constraints,
    consent,
    state: uploader.state,
    busy: uploader.busy,
    selectFile: uploader.selectFile,
    handleFileList: uploader.handleFileList,
    removeFile: uploader.removeFile,
    upload: uploader.upload,
    resetValidation: uploader.resetValidation,
  };

  return <PersonaUploadContext.Provider value={value}>{children}</PersonaUploadContext.Provider>;
};

export function usePersonaUploadContext(): PersonaUploadContextValue {
  const context = useContext(PersonaUploadContext);
  if (!context) {
    throw new Error("usePersonaUploadContext must be used within PersonaUploadProvider.");
  }

  return context;
}
