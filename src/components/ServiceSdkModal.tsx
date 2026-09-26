import { useEffect, useState } from "react";
import { getAgentById, getSdkSettings } from "../api";
import { getApiErrorMessage } from "../api/api";
import type { Agent, Service } from "../types";
import { Modal } from "./Modal";
import { SdkSnippets } from "./SdkSnippets";
import { LoadingState } from "./ui";

interface ServiceSdkModalProps {
  /** The service whose SDK snippets to show; null keeps the modal closed. */
  service: Service | null;
  onClose: () => void;
}

export function ServiceSdkModal({ service, onClose }: ServiceSdkModalProps) {
  return (
    <Modal
      open={!!service}
      title={service ? `SDK 串接語法－${service.name}` : "SDK 串接語法"}
      onClose={onClose}
      wide
    >
      {/* Keyed so each service starts from a fresh loading state. */}
      {service && <ServiceSdkContent key={service.id} service={service} />}
    </Modal>
  );
}

function ServiceSdkContent({ service }: { service: Service }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [cloudSdkScriptUrl, setCloudSdkScriptUrl] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const agentRes = await getAgentById(service.agentId);
        // Only a Cloud Agent's snippet needs the shared CDN URL.
        const settingsRes =
          agentRes.data.deploymentType === "Cloud"
            ? await getSdkSettings()
            : null;
        if (cancelled) return;
        setAgent(agentRes.data);
        setCloudSdkScriptUrl(settingsRes?.data.cloudSdkScriptUrl ?? null);
      } catch (err) {
        if (cancelled) return;
        const detail = getApiErrorMessage(err);
        setError(`載入 SDK 資訊時發生錯誤${detail ? `：${detail}` : ""}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [service]);

  if (loading) return <LoadingState />;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!agent) return null;

  return (
    <SdkSnippets
      serviceCode={service.code}
      deploymentType={agent.deploymentType}
      apiUrl={agent.apiUrl}
      cloudSdkScriptUrl={cloudSdkScriptUrl}
    />
  );
}
