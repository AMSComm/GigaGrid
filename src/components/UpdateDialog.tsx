import React, { useEffect, useState } from "react";
import {
  IconClose,
  IconRefresh,
  IconCheckCircle,
  IconAlertCircle,
  IconExternalLink,
  IconSparkles,
  IconDownload,
} from "../icons";
import {
  type UpdateInfo,
  CURRENT_VERSION,
  checkForAppUpdates,
  installTauriUpdate,
} from "../utils/updater";

interface UpdateDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    setLoading(true);
    setError(null);
    setInstallSuccess(false);
    try {
      const res = await checkForAppUpdates();
      setUpdateInfo(res);
      if (res.error) {
        setError(res.error);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (downloading) return;
    setUpdateInfo(null);
    setError(null);
    setDownloading(false);
    setProgress(null);
    setInstallSuccess(false);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    setError(null);
    checkForAppUpdates()
      .then((res) => {
        if (!active) return;
        setUpdateInfo(res);
        if (res.error) setError(res.error);
      })
      .catch((err) => {
        if (!active) return;
        setError((err as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !downloading) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, downloading]);

  const handleInstall = async () => {
    setDownloading(true);
    setError(null);
    try {
      await installTauriUpdate((downloaded, total) => {
        if (total && total > 0) {
          setProgress(Math.round((downloaded / total) * 100));
        }
      });
      setInstallSuccess(true);
    } catch (err) {
      setError((err as Error).message);
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="update-dialog-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !downloading) handleClose();
      }}
    >
      <div className="update-dialog-container" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="update-dialog-header">
          <div className="update-dialog-title-group">
            <div className="update-dialog-icon-box">
              <IconSparkles size={18} />
            </div>
            <div>
              <h3 className="update-dialog-title">Software Update</h3>
              <p className="update-dialog-subtitle">Current version: v{CURRENT_VERSION}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={downloading}
            className="icon-btn"
            style={{ width: 24, height: 24 }}
            title="Close (Esc)"
          >
            <IconClose />
          </button>
        </div>

        {/* Body */}
        <div className="update-dialog-body">
          {loading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px 0",
                gap: 12,
                color: "#888",
              }}
            >
              <IconRefresh className="spin-icon" />
              <span style={{ fontSize: 12 }}>Checking for latest updates...</span>
            </div>
          ) : error ? (
            <div className="update-dialog-alert-error">
              <IconAlertCircle size={18} />
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>Failed to check for updates</p>
                <p style={{ margin: "4px 0 0 0", fontSize: 11, opacity: 0.9 }}>{error}</p>
              </div>
            </div>
          ) : updateInfo?.available ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="update-dialog-banner">
                <div>
                  <span style={{ fontWeight: 600, color: "var(--primary)", fontSize: 13 }}>
                    New version available: v{updateInfo.latestVersion}
                  </span>
                  <p style={{ margin: "2px 0 0 0", fontSize: 11, color: "#888" }}>
                    {updateInfo.releaseDate
                      ? `Released on ${new Date(updateInfo.releaseDate).toLocaleDateString()}`
                      : "Recommended update"}
                  </p>
                </div>
                <span className="update-dialog-badge">NEW</span>
              </div>

              {updateInfo.notes && (
                <div className="update-dialog-notes">{updateInfo.notes}</div>
              )}

              {downloading && (
                <div style={{ paddingTop: 4 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      color: "var(--fg)",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <IconRefresh className="spin-icon" />
                      Downloading and preparing to install...
                    </span>
                    <span style={{ fontFamily: "monospace", color: "var(--primary)" }}>
                      {progress !== null ? `${progress}%` : "Processing..."}
                    </span>
                  </div>
                  <div className="update-dialog-progress-bar">
                    <div
                      className="update-dialog-progress-fill"
                      style={{ width: `${progress ?? 10}%` }}
                    />
                  </div>
                  <p style={{ margin: "6px 0 0 0", fontSize: 10, color: "#888" }}>
                    The application will restart automatically after the update completes.
                  </p>
                </div>
              )}

              {installSuccess && (
                <div className="update-dialog-alert-success">
                  <IconCheckCircle size={16} />
                  <span>Update completed! Restarting application...</span>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px 0",
                gap: 8,
                textAlign: "center",
              }}
            >
              <span style={{ color: "#1e7e34" }}>
                <IconCheckCircle size={32} />
              </span>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>
                Gigagrid is up to date
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
                You are running version v{CURRENT_VERSION}.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="update-dialog-footer">
          <button
            type="button"
            onClick={handleCheck}
            disabled={loading || downloading}
            className="btn-link"
          >
            <IconRefresh className={loading ? "spin-icon" : undefined} />
            <span>Check Again</span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {updateInfo?.available && updateInfo.hasNativeUpdater && !installSuccess && (
              <button
                type="button"
                onClick={handleInstall}
                disabled={downloading}
                className="btn-primary"
              >
                <IconDownload />
                <span>{downloading ? "Updating..." : "Update & Restart"}</span>
              </button>
            )}

            {updateInfo?.available &&
              (!updateInfo.hasNativeUpdater || updateInfo.downloadUrl) &&
              !downloading && (
                <a
                  href={updateInfo.downloadUrl || "https://github.com/AMSComm/GigaGrid/releases"}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary"
                  style={{ textDecoration: "none" }}
                >
                  <IconExternalLink size={13} />
                  <span>View on GitHub</span>
                </a>
              )}

            <button
              type="button"
              onClick={handleClose}
              disabled={downloading}
              className="btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
