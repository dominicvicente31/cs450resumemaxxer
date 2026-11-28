import { createContext, useContext, useState } from "react";

/** Holds the in-flight upload between the Upload, Incompatible and Loading pages. */
const UploadContext = createContext(null);

export function UploadProvider({ children }) {
  const [file, setFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [usePrimary, setUsePrimary] = useState(false); // evaluate the saved primary instead of a file
  const [makePrimary, setMakePrimary] = useState(false); // save this upload as the primary resume
  const [submitted, setSubmitted] = useState(false); // Loading page only runs after a submit
  const [rejection, setRejection] = useState(""); // why the last file was incompatible

  const reset = () => {
    setFile(null);
    setUsePrimary(false);
    setMakePrimary(false);
    setSubmitted(false);
    setRejection("");
  };

  return (
    <UploadContext.Provider
      value={{
        file, setFile,
        jobDescription, setJobDescription,
        usePrimary, setUsePrimary,
        makePrimary, setMakePrimary,
        submitted, setSubmitted,
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
