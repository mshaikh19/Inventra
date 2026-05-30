import React, { useEffect, useState, useRef } from "react";
import BarcodeScannerComponent from "react-qr-barcode-scanner";

const PureBarcodeScanner = ({
  selectedDeviceId,
  onDevicesFound,
  onScanSuccess,
  onScanError,
  setScannerCameraStatus,
  setScannerCameraMessage
}) => {
  const [cameraErrorType, setCameraErrorType] = useState(null); // 'secure-context' | 'permission' | 'device-error' | null
  const [cameraErrorMsg, setCameraErrorMsg] = useState("");

  const onDevicesFoundRef = useRef(onDevicesFound);
  const onScanSuccessRef = useRef(onScanSuccess);
  const onScanErrorRef = useRef(onScanError);
  const setStatusRef = useRef(setScannerCameraStatus);
  const setMessageRef = useRef(setScannerCameraMessage);

  // Keep parent callbacks fresh
  useEffect(() => {
    onDevicesFoundRef.current = onDevicesFound;
    onScanSuccessRef.current = onScanSuccess;
    onScanErrorRef.current = onScanError;
    setStatusRef.current = setScannerCameraStatus;
    setMessageRef.current = setScannerCameraMessage;
  });

  // Silence standard zxing warning loops from console to prevent lag
  useEffect(() => {
    const originalWarn = console.warn;
    const originalError = console.error;

    const filterConsoleMsg = (...args) => {
      const msg = args.map(arg => {
        try {
          return typeof arg === "object" ? JSON.stringify(arg) : String(arg);
        } catch {
          return String(arg);
        }
      }).join(" ");

      return (
        msg.includes("Trying to play video") ||
        msg.includes("non-ReaderException") ||
        msg.includes("NotFoundException") ||
        msg.includes("unexpected error during decode") ||
        msg.includes("It was not possible to play the video")
      );
    };

    console.warn = (...args) => {
      if (filterConsoleMsg(...args)) return;
      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      if (filterConsoleMsg(...args)) return;
      originalError.apply(console, args);
    };

    return () => {
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  // Secure context validation
  useEffect(() => {
    if (window.isSecureContext === false) {
      setCameraErrorType("secure-context");
      setCameraErrorMsg("Webcam feeds are disabled on insecure HTTP connections.");
      if (setStatusRef.current) setStatusRef.current("error");
      if (setMessageRef.current) setMessageRef.current("Security block active.");
    } else {
      if (setStatusRef.current) setStatusRef.current("ready");
      if (setMessageRef.current) setMessageRef.current("Camera active. Present a barcode.");
    }
  }, []);

  // Poll for permission grant to dynamically populate camera select dropdown list with names!
  useEffect(() => {
    if (window.isSecureContext === false) return undefined;
    let active = true;

    const checkAndListDevices = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");

        const hasLabels = videoInputs.some(d => d.label && d.label.trim() !== "");
        if (hasLabels && active) {
          let activeId = selectedDeviceId;
          if (!activeId && videoInputs.length > 0) {
            const back = videoInputs.find(
              (d) =>
                d.label.toLowerCase().includes("back") ||
                d.label.toLowerCase().includes("environment") ||
                d.label.toLowerCase().includes("rear")
            );
            activeId = back ? back.deviceId : videoInputs[0].deviceId;
          }
          if (onDevicesFoundRef.current) {
            onDevicesFoundRef.current(videoInputs, activeId);
          }
        } else if (!hasLabels && active) {
          // Poll again in 800ms until permission is granted
          setTimeout(checkAndListDevices, 800);
        }
      } catch (err) {
        console.warn("Failed to query camera inputs:", err);
      }
    };

    checkAndListDevices();

    return () => {
      active = false;
    };
  }, [selectedDeviceId]);

  if (cameraErrorType) {
    return (
      <div className="absolute inset-0 bg-slate-955 flex flex-col items-center justify-center p-6 text-center select-none z-30 animate-fade-in border border-rose-500/20 rounded-2xl">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-rose-500 animate-pulse-soft" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>
        
        <h4 className="text-xs font-black uppercase tracking-[0.18em] text-rose-400">Camera Access Blocked</h4>
        <p className="text-[10px] text-slate-400 font-semibold mt-1 px-4 max-w-xs leading-relaxed">{cameraErrorMsg}</p>

        <div className="mt-4 pt-3 border-t border-slate-800/80 w-full flex flex-col gap-2">
          {cameraErrorType === "secure-context" ? (
            <div className="text-[8.5px] text-left text-slate-500 font-semibold space-y-1.5 px-3">
              <div className="text-[9px] text-slate-300 font-bold uppercase tracking-wider">💡 How to fix:</div>
              <div>• Access the app via <strong className="text-rose-500">http://localhost:5173</strong> or a secure <strong className="text-rose-500">HTTPS</strong> tunnel.</div>
              <div>• Browsers automatically block live camera streams on network IPs over standard HTTP (e.g. 192.168.x.x).</div>
              <div>• <strong>For mobile testing:</strong> Open <code className="text-rose-400 bg-slate-900 px-1 py-0.5 rounded">chrome://flags/#unsafely-treat-insecure-origin-as-secure</code> in Chrome, enable it, add your URL, and relaunch!</div>
            </div>
          ) : cameraErrorType === "permission" ? (
            <div className="text-[8.5px] text-left text-slate-500 font-semibold space-y-1.5 px-3">
              <div className="text-[9px] text-slate-300 font-bold uppercase tracking-wider">💡 How to fix:</div>
              <div>• Click the **camera icon** or padlock in your browser's address bar.</div>
              <div>• Toggle the camera permission switch back to **"Allow"** and refresh the page.</div>
            </div>
          ) : (
            <div className="text-[8.5px] text-left text-slate-500 font-semibold space-y-1.5 px-3">
              <div className="text-[9px] text-slate-300 font-bold uppercase tracking-wider">💡 How to fix:</div>
              <div>• Ensure your webcam is firmly plugged in and active in other applications.</div>
              <div>• Select another device in the dropdown menu if multiple inputs exist.</div>
            </div>
          )}
          
          <div className="text-[9.5px] text-rose-400 font-black uppercase tracking-wider mt-2.5 bg-rose-500/5 py-1 px-2 rounded-lg border border-rose-500/10">
            📸 Use "Capture Autofocus Photo" below to scan!
          </div>
        </div>
      </div>
    );
  }

  // React Scanner only component
  return (
    <div className="absolute inset-0 w-full h-full object-cover z-0 flex items-center justify-center bg-slate-950">
      <BarcodeScannerComponent
        width="100%"
        height="100%"
        videoConstraints={
          selectedDeviceId && selectedDeviceId.trim() !== ""
            ? { deviceId: { exact: selectedDeviceId } }
            : { facingMode: "environment" }
        }
        onUpdate={(err, result) => {
          if (result) {
            const text = result.getText() || result.text;
            if (text && onScanSuccessRef.current) {
              onScanSuccessRef.current(text);
            }
          } else if (err) {
            const errMsg = err.message || String(err);
            const errName = err.name || "";

            // Capture and bubble permission or connectivity errors up
            if (
              errName === "NotAllowedError" ||
              errName === "PermissionDeniedError" ||
              errMsg.toLowerCase().includes("permission") ||
              errMsg.toLowerCase().includes("allowed")
            ) {
              setCameraErrorType("permission");
              setCameraErrorMsg("Camera access permission was denied by the user.");
              if (setStatusRef.current) setStatusRef.current("error");
              if (setMessageRef.current) setMessageRef.current("Camera access blocked.");
              if (onScanErrorRef.current) onScanErrorRef.current(err);
            } else if (
              errName === "NotFoundError" ||
              errName === "DevicesNotFoundError" ||
              errMsg.toLowerCase().includes("not found")
            ) {
              setCameraErrorType("device-error");
              setCameraErrorMsg("No camera devices detected on this register/terminal.");
              if (setStatusRef.current) setStatusRef.current("error");
              if (setMessageRef.current) setMessageRef.current("Camera access blocked.");
              if (onScanErrorRef.current) onScanErrorRef.current(err);
            }
          }
        }}
      />
    </div>
  );
};

export default PureBarcodeScanner;
