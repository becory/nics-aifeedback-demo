import { useEffect, useState } from "react";
import type { AgentDeploymentType } from "../types";

// Cloud Agents don't serve the SDK themselves, so their services load it from the public CDN.
const CDN_SDK_SRC =
  "https://cdn.jsdelivr.net/gh/nics-tw/aifeedback-sdk@1.0.0/dist/feedback-sdk.min.js";

const AGENT_HOST_PLACEHOLDER = "<agent-host>";

const USAGE_EXAMPLE = `async function submitFeedback(feedbackData) {
  try {
    const response = await FeedbackSDK.submit(feedbackData);
    console.log('提交成功!', response);
    // 例如：向使用者顯示成功訊息
  } catch (error) {
    console.error('提交失敗:', error);
    // 例如：根據 error.code 和 error.message 顯示錯誤訊息
    // error.code 的可能值包含 'INVALID_DATA', 'UNAUTHORIZED' 等
  }
}

// 範例呼叫
submitFeedback({
  feedbackRating: 'good',
  feedbackComment: '這個 AI 非常有幫助！',
  inferenceSec: 15.5,
});`;

function CodeBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{title}</p>
        <button type="button" onClick={handleCopy} className="cf-link text-xs">
          {copied ? "已複製" : "複製程式碼"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-slate-900 px-4 py-3 text-xs leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

interface SdkSnippetsProps {
  serviceCode: string;
  deploymentType: AgentDeploymentType;
  /** The owning Agent's ApiUrl (no trailing slash); null until an admin sets it. */
  apiUrl?: string | null;
}

export function SdkSnippets({ serviceCode, deploymentType, apiUrl }: SdkSnippetsProps) {
  const isLocal = deploymentType === "Local";
  const base = apiUrl || AGENT_HOST_PLACEHOLDER;
  const scriptSrc = isLocal ? `${base}/sdk/feedback-sdk.min.js` : CDN_SDK_SRC;

  const loadSnippet = `<script src="${scriptSrc}"></script>`;
  const initSnippet = `<script>
  FeedbackSDK.init({
    serviceId: '${serviceCode}',
    dsn: '${base}/api'
  });
</script>`;

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-700">SDK 串接語法</p>
      {!apiUrl && (
        <p className="text-xs text-amber-600">
          此服務代理尚未設定 API URL，以下語法中的 {AGENT_HOST_PLACEHOLDER} 請替換為代理的實際網址。
        </p>
      )}
      <CodeBlock
        title={isLocal ? "載入 SDK（由地端代理提供）" : "載入 SDK（CDN）"}
        code={loadSnippet}
      />
      <CodeBlock title="初始化" code={initSnippet} />
      <CodeBlock title="使用範例" code={USAGE_EXAMPLE} />
    </div>
  );
}
