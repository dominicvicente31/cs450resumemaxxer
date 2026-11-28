import { createContext, useContext, useState } from "react";

/** Holds the in-flight upload between the Upload, Incompatible and Loading pages. */
const UploadContext = createContext(null);

export function UploadProvider({ children }) {
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [usePrimary, setUsePrimary] = useState(false); // evaluate the saved primary instead of a file
  const [makePrimary, setMakePrimary] = useState(false); // save this upload as the primary resume
  // The in-flight evaluation, started once by the Upload page: { promise, controller } or null.
  // The Loading page only waits on it, so re-rendering or re-mounting never sends a second request.
  const [pending, setPending] = useState(null);
  const [rejection, setRejection] = useState(""); // why the last file was incompatible

  const reset = () => {
    setFile(null);
    setUsePrimary(false);
    setMakePrimary(false);
    setPending(null);
    setRejection("");
  };

  return (
    <UploadContext.Provider
      value={{
        file, setFile,
        jobDescription, setJobDescription,
        usePrimary, setUsePrimary,
        makePrimary, setMakePrimary,
        pending, setPending,
        rejection, setRejection,
        reset,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  return useContext(UploadContext);
}
