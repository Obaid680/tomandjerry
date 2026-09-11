let html5QrCode = null;
let isStarting = false;
let isScanning = false;
let scanHandled = false;

function navigateToScan() {
    document.getElementById("homePage").style.display = "none";
    document.getElementById("checkInPage").style.display = "flex";
}

function navigateToHome() {
    stopCamera();
    document.getElementById("successModal").style.display = "none";
    document.getElementById("checkInPage").style.display = "none";
    document.getElementById("homePage").style.display = "flex";
}

function showCameraError(message) {
    const errorBox = document.getElementById("cameraError");
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.style.display = "block";
}

function hideCameraError() {
    const errorBox = document.getElementById("cameraError");
    if (!errorBox) return;
    errorBox.textContent = "";
    errorBox.style.display = "none";
}

function cameraErrorMessage(error) {
    const name = error && error.name ? error.name : "";
    const message = error && error.message ? error.message : "";

    if (name === "NotAllowedError" || name === "PermissionDeniedError")
        return "Camera permission was denied. Allow camera access for Gym Passport in your browser settings and try again.";

    if (name === "NotFoundError" || name === "DevicesNotFoundError")
        return "No camera was found on this device.";

    if (name === "NotReadableError" || name === "TrackStartError")
        return "The camera is busy or being used by another app. Close other camera apps and try again.";

    if (name === "SecurityError")
        return "Camera access was blocked. Make sure Gym Passport is opened through HTTPS and camera permission is allowed.";

    if (name === "OverconstrainedError")
        return "The preferred rear camera is unavailable. Please try again.";

    return message
        ? "Camera could not be started: " + message
        : "Camera could not be started. Check HTTPS and camera permission.";
}

async function startCameraScanner() {
    if (isStarting || isScanning) return;

    hideCameraError();

    const reader = document.getElementById("reader");
    const qrStatic = document.getElementById("qrStatic");
    const scanBtn = document.getElementById("scanBtn");

    if (!window.Html5Qrcode) {
        showCameraError("QR scanner library did not load. Check your internet connection and reload the app.");
        return;
    }

    if (!window.isSecureContext) {
        showCameraError("Camera access requires HTTPS. Install/open Gym Passport from its secure HTTPS address.");
        return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showCameraError("This browser does not support camera access. Use current Chrome on Android or Safari/Chrome on iPhone.");
        return;
    }

    isStarting = true;
    scanHandled = false;
    qrStatic.style.display = "none";
    reader.style.display = "block";
    scanBtn.disabled = true;
    scanBtn.innerText = "Starting camera...";

    const config = {
        fps: 10,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
            const smaller = Math.min(viewfinderWidth, viewfinderHeight);
            const size = Math.max(160, Math.min(280, Math.floor(smaller * 0.68)));
            return { width: size, height: size };
        },
        aspectRatio: 1.0,
        disableFlip: false
    };

    const onSuccess = async (decodedText) => {
        if (scanHandled) return;
        scanHandled = true;
        console.log("QR Code detected:", decodedText);
        await stopCamera();
        document.getElementById("successModal").style.display = "flex";
    };

    const onFailure = () => {};

    html5QrCode = new Html5Qrcode("reader");

    try {
        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onSuccess,
            onFailure
        );

        isScanning = true;
        isStarting = false;
        scanBtn.disabled = false;
        scanBtn.innerText = "Scanning...";
        return;

    } catch (firstError) {
        console.warn("Environment camera failed:", firstError);
    }

    try {
        const cameras = await Html5Qrcode.getCameras();

        if (!cameras || cameras.length === 0) {
            throw new Error("No camera devices were returned.");
        }

        const rear = cameras.find(camera => {
            const label = (camera.label || "").toLowerCase();
            return label.includes("back") ||
                   label.includes("rear") ||
                   label.includes("environment");
        });

        const selected = rear || cameras[cameras.length - 1];

        try { await html5QrCode.clear(); } catch (_) {}

        html5QrCode = new Html5Qrcode("reader");

        await html5QrCode.start(
            selected.id,
            config,
            onSuccess,
            onFailure
        );

        isScanning = true;
        isStarting = false;
        scanBtn.disabled = false;
        scanBtn.innerText = "Scanning...";

    } catch (error) {
        console.error("Camera start failed:", error);

        isStarting = false;
        isScanning = false;

        try { if (html5QrCode) await html5QrCode.clear(); } catch (_) {}

        html5QrCode = null;
        reader.style.display = "none";
        qrStatic.style.display = "flex";
        scanBtn.disabled = false;
        scanBtn.innerText = "Scan QR";

        showCameraError(cameraErrorMessage(error));
    }
}

async function stopCamera() {
    isStarting = false;

    if (!html5QrCode) {
        isScanning = false;
        resetScannerUI();
        return;
    }

    try {
        if (html5QrCode.isScanning) await html5QrCode.stop();
    } catch (error) {
        console.warn("Camera stop error:", error);
    }

    try {
        await html5QrCode.clear();
    } catch (error) {
        console.warn("Scanner clear error:", error);
    }

    html5QrCode = null;
    isScanning = false;
    resetScannerUI();
}

function resetScannerUI() {
    const reader = document.getElementById("reader");
    const qrStatic = document.getElementById("qrStatic");
    const scanBtn = document.getElementById("scanBtn");

    if (!reader || !qrStatic || !scanBtn) return;

    reader.style.display = "none";
    qrStatic.style.display = "flex";
    scanBtn.innerText = "Scan QR";
    scanBtn.disabled = false;
}

async function showSuccessModal() {
    if (scanHandled) return;
    scanHandled = true;
    await stopCamera();
    document.getElementById("successModal").style.display = "flex";
}

document.addEventListener("visibilitychange", () => {
    if (document.hidden && isScanning) stopCamera();
});

window.addEventListener("pagehide", () => {
    stopCamera();
});
