import { createContext, useContext, useState } from "react";

/** Holds the in-flight upload between the Upload, Incompatible and Loading pages. */
const UploadContext = createContext(null);

export function UploadProvider({ children }) {
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [rejection, setRejection] = useState(""); // why the last file was incompatible

  const reset = () => {
    setFile(null);
    setRejection("");
  };

  return (
    <UploadContext.Provider
      value={{ file, setFile, jobDescription, setJobDescription, rejection, setRejection, reset }}
    >
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  return useContext(UploadContext);
}
