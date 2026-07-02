import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

/**
 * Early Boot Execution Routine.
 * Hydrates local storage theme preferences down into the DOM baseline 
 * before the initial paint to prevent structural layout flashes (FOUC).
 */
const initializeSystemThemeMatrix = () => {
  try {
    document.documentElement.classList.remove("dark");
  } catch (error) {
    console.error("Theme configuration hydration aborted:", error);
  }
};

// Execute theme synchronization phase prior to root assembly allocation
initializeSystemThemeMatrix();

// 1. Fetch Target Mount Root Canvas Point from HTML Document Bounding Tree
const mountTargetElement = document.getElementById("root");

if (!mountTargetElement) {
  throw new Error(
    "CRITICAL BOOTSTRAP FAILURE: Target root container element '#root' could not be located inside index.html document. " +
    "Execution routine aborted."
  );
}

// 2. Instantiate Concurrent Mode Virtual Fiber Tree Layer
const concurrentRootInstance = ReactDOM.createRoot(mountTargetElement);

concurrentRootInstance.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);