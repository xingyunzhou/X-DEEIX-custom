"use client";

import * as React from "react";

import {
  useChatSession,
  useConversationStatus,
} from "@/features/chat/context/chat-session-context";

const VIEWED_COMPLETION_DELAY_MS = 4_000;

export function useChatConversationCompletion(conversationID: string | null, ready: boolean) {
  const { acknowledgeConversationCompletion } = useChatSession();
  const status = useConversationStatus(conversationID ?? "");
  const viewedConversationIDRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (viewedConversationIDRef.current !== conversationID) {
      viewedConversationIDRef.current = null;
    }
    if (!conversationID || !ready) {
      return;
    }

    let timer: number | null = null;
    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };
    const acknowledgeVisibleCompletion = () => {
      clearTimer();
      if (document.visibilityState !== "visible" || !document.hasFocus()) {
        viewedConversationIDRef.current = null;
        return;
      }
      const alreadyViewing = viewedConversationIDRef.current === conversationID;
      viewedConversationIDRef.current = conversationID;
      if (status !== "completed") {
        return;
      }
      // 切入已完成的对话即视为已查看；停留期间完成则短暂展示绿勾。
      if (!alreadyViewing) {
        acknowledgeConversationCompletion(conversationID);
        return;
      }
      timer = window.setTimeout(() => {
        acknowledgeConversationCompletion(conversationID);
      }, VIEWED_COMPLETION_DELAY_MS);
    };

    acknowledgeVisibleCompletion();
    window.addEventListener("focus", acknowledgeVisibleCompletion);
    window.addEventListener("blur", acknowledgeVisibleCompletion);
    document.addEventListener("visibilitychange", acknowledgeVisibleCompletion);
    return () => {
      clearTimer();
      window.removeEventListener("focus", acknowledgeVisibleCompletion);
      window.removeEventListener("blur", acknowledgeVisibleCompletion);
      document.removeEventListener("visibilitychange", acknowledgeVisibleCompletion);
    };
  }, [acknowledgeConversationCompletion, conversationID, ready, status]);
}
